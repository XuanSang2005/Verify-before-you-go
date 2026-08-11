import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ANALYSIS_RULE_VERSION,
  AnalyseOfferRequestSchema,
  AnalyseOfferResponseSchema,
} from './analysis.js';

test('analysis request requires transient input and accepts screenshot-only review', () => {
  assert.equal(AnalyseOfferRequestSchema.safeParse({}).success, false);
  assert.equal(AnalyseOfferRequestSchema.safeParse({ screenshotProvided: true }).success, true);
  assert.equal(AnalyseOfferRequestSchema.safeParse({ postingText: 'A posting' }).success, true);
});

test('analysis request allows only complete HTTP links', () => {
  assert.equal(AnalyseOfferRequestSchema.safeParse({ recruitmentLink: 'https://example.org/job' }).success, true);
  assert.equal(AnalyseOfferRequestSchema.safeParse({ recruitmentLink: 'javascript:alert(1)' }).success, false);
});

test('analysis request preserves raw posting whitespace for marked offsets', () => {
  const raw = '  URGENT hiring at Acme Ltd.';
  const parsed = AnalyseOfferRequestSchema.parse({ postingText: raw });
  assert.equal(parsed.postingText, raw);
});

test('analysis response contract models observations without a verdict field', () => {
  const parsed = AnalyseOfferResponseSchema.parse({
    analysisId: 'analysis-0123456789abcdef',
    ruleVersion: ANALYSIS_RULE_VERSION,
    observedSignalCount: 0,
    checkedRuleCount: 9,
    findings: [],
    markedPassages: [],
    unknownInformation: ['The employer identity has not been independently confirmed.'],
    safetyStatement:
      'These are observed signals, not a verdict. Verify the employer, recruiter and offer through independent official sources before acting.',
  });
  assert.equal('verdict' in parsed, false);
  assert.equal('score' in parsed, false);
});
