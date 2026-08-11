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
  toVerifiedSafeShareSummary,
} from './share-model';

const VALID_TOKEN = `v1.${'a'.repeat(80)}.${'b'.repeat(43)}`;

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
  ]));
  const params = createRecipientShareParams(VALID_TOKEN);
  const shareText = buildPrivateShareText(summary);
  const publicOutput = JSON.stringify({ summary, params, shareText });

  assert.deepEqual(summary.findingIds, ['identity-document-request', 'off-platform-contact']);
  assert.deepEqual(params, { token: VALID_TOKEN });
  for (const privateValue of ['person@example.com', '@john-doe', 'AB1234567', 'IMG_2041.JPG', '10.1,104.2']) {
    assert.doesNotMatch(publicOutput, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('uses the exact prototype demo hierarchy when no transient analysis exists', () => {
  const summary = createSafeShareSummary(undefined);
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

test('accepts one canonical token parameter and rejects unknown, repeated or overlong parameters', () => {
  const params = createRecipientShareParams(VALID_TOKEN);
  assert.deepEqual(parseRecipientShareParams(params), { status: 'ready', token: VALID_TOKEN });
  assert.deepEqual(parseRecipientShareParams({ ...params, demo: '1' }), { status: 'invalid' });
  assert.deepEqual(parseRecipientShareParams({ token: [VALID_TOKEN, VALID_TOKEN] }), { status: 'invalid' });
  assert.deepEqual(parseRecipientShareParams({ token: `${VALID_TOKEN}x` }), { status: 'invalid' });
  assert.deepEqual(parseRecipientShareParams({
    token: `v1.${'a'.repeat(2_200)}.${'b'.repeat(43)}`,
  }), { status: 'invalid' });
  assert.deepEqual(parseRecipientShareParams({
    v: '1',
    signals: 'urgency-pressure',
    expires: '1786450000000',
    demo: '0',
  }), { status: 'invalid' });
});

test('supports a zero-signal summary without implying safety', () => {
  const summary = createSafeShareSummary(analysisWithPrivateEvidence([]));
  assert.match(buildPrivateShareText(summary), /not a verdict/i);
  assert.doesNotMatch(buildPrivateShareText(summary), /safe offer|offer is safe/i);
});

test('uses only backend-verified timestamps for recipient expiry copy', () => {
  const summary = toVerifiedSafeShareSummary({
    schemaVersion: 1,
    findingIds: ['shortened-link'],
    checkedRuleCount: 9,
    demo: false,
    issuedAt: '2026-08-11T12:00:00.000Z',
    expiresAt: '2026-08-18T12:00:00.000Z',
  });
  assert.equal(summary.expiresAt, '2026-08-18T12:00:00.000Z');
  assert.deepEqual(summary.findingIds, ['shortened-link']);
});
