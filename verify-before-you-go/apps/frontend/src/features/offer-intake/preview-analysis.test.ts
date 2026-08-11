import assert from 'node:assert/strict';
import test from 'node:test';

import { ANALYSIS_RULE_VERSION, type AnalyseOfferResponse } from '@vbyg/contracts';

import type { OfferDraft } from './model';
import {
  ANALYSIS_STATUS_MESSAGES,
  PreviewAnalysisCoordinator,
  shouldAnimateScanBeam,
} from './preview-analysis';

const draft: OfferDraft = {
  text: 'URGENT hiring at Acme Ltd.',
  link: '',
  saveRecentMetadata: false,
};

const analysis: AnalyseOfferResponse = {
  analysisId: 'analysis-0123456789abcdef',
  ruleVersion: ANALYSIS_RULE_VERSION,
  observedSignalCount: 0,
  checkedRuleCount: 9,
  findings: [],
  markedPassages: [],
  unknownInformation: ['The employer identity remains unverified.'],
  safetyStatement: 'These are observed signals, not a verdict. Verify the employer, recruiter and offer through independent official sources before acting.',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

test('fast success waits for the minimum preview dwell', async () => {
  const dwell = deferred<void>();
  const coordinator = new PreviewAnalysisCoordinator(
    async () => analysis,
    () => dwell.promise,
  );
  const attempt = coordinator.start(draft, false);
  let settled = false;
  void attempt.completion.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);

  dwell.resolve();
  assert.equal(await attempt.completion, analysis);
});

test('slow success waits for the real analysis after the dwell is complete', async () => {
  const response = deferred<AnalyseOfferResponse>();
  const coordinator = new PreviewAnalysisCoordinator(
    () => response.promise,
    async () => undefined,
  );
  const attempt = coordinator.start(draft, false);
  let settled = false;
  void attempt.completion.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);

  response.resolve(analysis);
  assert.equal(await attempt.completion, analysis);
});

test('reduced motion skips the artificial dwell but still waits for the response', async () => {
  let dwellCalls = 0;
  const coordinator = new PreviewAnalysisCoordinator(
    async () => analysis,
    async () => { dwellCalls += 1; },
  );
  const attempt = coordinator.start(draft, true);
  assert.equal(await attempt.completion, analysis);
  assert.equal(dwellCalls, 0);
});

test('a retry invalidates and aborts an older response even when the request ignores abort', async () => {
  const responses = [deferred<AnalyseOfferResponse>(), deferred<AnalyseOfferResponse>()];
  let call = 0;
  const coordinator = new PreviewAnalysisCoordinator(
    () => responses[call++].promise,
    async () => undefined,
  );

  const first = coordinator.start(draft, false);
  const second = coordinator.start(draft, false);
  assert.equal(first.signal.aborted, true);
  responses[0].resolve(analysis);
  assert.equal(await first.completion, analysis);
  assert.equal(coordinator.isCurrent(first.id), false);

  responses[1].resolve(analysis);
  assert.equal(await second.completion, analysis);
  assert.equal(coordinator.isCurrent(second.id), true);
});

test('cancel aborts the active request and prevents a late completion from being current', async () => {
  const response = deferred<AnalyseOfferResponse>();
  const coordinator = new PreviewAnalysisCoordinator(
    () => response.promise,
    async () => undefined,
  );
  const attempt = coordinator.start(draft, false);
  coordinator.cancel();
  assert.equal(attempt.signal.aborted, true);
  response.resolve(analysis);
  assert.equal(await attempt.completion, analysis);
  assert.equal(coordinator.isCurrent(attempt.id), false);
});

test('scan motion only runs for measured, scannable content in the analysing phase', () => {
  assert.equal(shouldAnimateScanBeam('analysing', false, 320, true), true);
  assert.equal(shouldAnimateScanBeam('ready', false, 320, true), false);
  assert.equal(shouldAnimateScanBeam('error', false, 320, true), false);
  assert.equal(shouldAnimateScanBeam('analysing', true, 320, true), false);
  assert.equal(shouldAnimateScanBeam('analysing', false, 0, true), false);
  assert.equal(shouldAnimateScanBeam('analysing', false, 320, false), false);
});

test('analysis statuses use the required educational sequence and settle on waiting', () => {
  assert.deepEqual(ANALYSIS_STATUS_MESSAGES, [
    'READING SUBMITTED TEXT',
    'MATCHING OBSERVED SIGNALS',
    'PREPARING CHECK STEPS',
    'WAITING FOR THE LOCAL ANALYSIS SERVICE',
  ]);
});
