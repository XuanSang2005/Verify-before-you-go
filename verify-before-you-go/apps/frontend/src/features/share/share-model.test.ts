import assert from 'node:assert/strict';
import test from 'node:test';

import type { AnalyseOfferResponse, AnalysisFindingId } from '@vbyg/contracts';

import {
  buildPrivateShareText,
  createRecipientShareParams,
  createSafeShareSummary,
  demoFindingIds,
  getPreviewObservations,
  getRecipientChecks,
  parseRecipientShareParams,
  SHARE_EXPIRY_MS,
} from './share-model';

const NOW = Date.UTC(2026, 7, 11, 12, 0, 0);

function analysisWithPrivateEvidence(ids: AnalysisFindingId[]): AnalyseOfferResponse {
  return {
    analysisId: 'analysis-0123456789abcdef',
    ruleVersion: 'vbyg-analysis-2026.08.1',
    observedSignalCount: ids.length,
    checkedRuleCount: 9,
    findings: ids.map((id) => ({
      id,
      observedPattern: 'Contact person@example.com or @john-doe with passport AB1234567',
      evidence: {
        kind: 'passage' as const,
        source: 'postingText' as const,
        text: 'person@example.com @john-doe AB1234567',
        start: 0,
        end: 43,
      },
      explanation: 'Private explanation person@example.com',
      unknownInformation: ['Private unknown @john-doe'],
      verificationSteps: ['Private step AB1234567'],
    })),
    markedPassages: ids.map((findingId) => ({
      findingId,
      text: 'person@example.com',
      start: 0,
      end: 18,
    })),
    unknownInformation: ['Passport AB1234567'],
    safetyStatement: 'These are observed signals, not a verdict. Verify the employer, recruiter and offer through independent official sources before acting.',
    screenshotNote: 'IMG_2041.JPG GPS 10.1,104.2',
  };
}

test('builds a privacy-safe summary from allowlisted finding IDs only', () => {
  const summary = createSafeShareSummary(analysisWithPrivateEvidence([
    'identity-document-request',
    'off-platform-contact',
  ]), NOW);
  const params = createRecipientShareParams(summary);
  const shareText = buildPrivateShareText(summary);
  const publicOutput = JSON.stringify({ summary, params, shareText });

  assert.deepEqual(summary.findingIds, ['identity-document-request', 'off-platform-contact']);
  assert.equal(summary.expiresAt, new Date(NOW + SHARE_EXPIRY_MS).toISOString());
  for (const privateValue of ['person@example.com', '@john-doe', 'AB1234567', 'IMG_2041.JPG', '10.1,104.2']) {
    assert.doesNotMatch(publicOutput, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('uses the exact prototype demo hierarchy when no transient analysis exists', () => {
  const summary = createSafeShareSummary(undefined, NOW);
  assert.equal(summary.demo, true);
  assert.deepEqual(summary.findingIds, demoFindingIds);
  assert.deepEqual(getPreviewObservations(summary), [
    'Passport requested before contract',
    'Company name and address missing',
    'Contact limited to Telegram',
  ]);
  assert.deepEqual(getRecipientChecks(summary), [
    'The legal company is not named.',
    'A passport is requested before a contract.',
    'Flight and housing would be controlled by the recruiter.',
  ]);
});

test('round-trips a strict versioned recipient payload and rejects tampering', () => {
  const summary = createSafeShareSummary(analysisWithPrivateEvidence(['urgency-pressure']), NOW);
  const params = createRecipientShareParams(summary);
  assert.deepEqual(parseRecipientShareParams(params, NOW), { status: 'ready', summary });

  assert.deepEqual(parseRecipientShareParams({ ...params, v: '2' }, NOW), { status: 'invalid' });
  assert.deepEqual(parseRecipientShareParams({ ...params, signals: 'urgency-pressure,urgency-pressure' }, NOW), { status: 'invalid' });
  assert.deepEqual(parseRecipientShareParams({ ...params, signals: 'urgency-pressure,@john-doe' }, NOW), { status: 'invalid' });
  assert.deepEqual(parseRecipientShareParams({ ...params, expires: ['1786450000000'] }, NOW), { status: 'invalid' });
});

test('supports a zero-signal summary without implying safety', () => {
  const summary = createSafeShareSummary(analysisWithPrivateEvidence([]), NOW);
  const params = createRecipientShareParams(summary);
  assert.equal(params.signals, 'none');
  assert.deepEqual(parseRecipientShareParams(params, NOW), { status: 'ready', summary });
  assert.match(buildPrivateShareText(summary), /not a verdict/i);
  assert.doesNotMatch(buildPrivateShareText(summary), /safe offer|offer is safe/i);
});

test('marks a valid payload expired only after its bounded expiry', () => {
  const summary = createSafeShareSummary(analysisWithPrivateEvidence(['shortened-link']), NOW);
  const params = createRecipientShareParams(summary);
  assert.equal(parseRecipientShareParams(params, NOW + SHARE_EXPIRY_MS).status, 'ready');
  assert.equal(parseRecipientShareParams(params, NOW + SHARE_EXPIRY_MS + 1).status, 'expired');
});
