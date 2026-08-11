import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnalysisFinding } from '@vbyg/contracts';

import { orderFindingsForPresentation } from './finding-order';

const common = {
  observedPattern: 'Observed pattern',
  explanation: 'Explanation',
  unknownInformation: ['Unknown'],
  verificationSteps: ['Verify'],
};

test('numbers posting passages in reading order and keeps absence evidence last', () => {
  const findings = [
    {
      ...common,
      id: 'identity-document-request',
      evidence: { kind: 'passage', source: 'postingText', text: 'passport', start: 80, end: 88 },
    },
    {
      ...common,
      id: 'missing-employer-identity',
      evidence: { kind: 'absence', description: 'No employer identity' },
    },
    {
      ...common,
      id: 'urgency-pressure',
      evidence: { kind: 'passage', source: 'postingText', text: 'urgent', start: 2, end: 8 },
    },
  ] satisfies AnalysisFinding[];

  assert.deepEqual(
    orderFindingsForPresentation(findings).map((finding) => finding.id),
    ['urgency-pressure', 'identity-document-request', 'missing-employer-identity'],
  );
});

test('keeps a URL-field finding in the openable presentation list', () => {
  const findings = [
    {
      ...common,
      id: 'shortened-link',
      evidence: { kind: 'passage', source: 'recruitmentLink', text: 'https://bit.ly/role', start: 0, end: 19 },
    },
  ] satisfies AnalysisFinding[];

  const entries = orderFindingsForPresentation(findings);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.id, 'shortened-link');
  assert.equal(entries[0]?.evidence.kind, 'passage');
  if (entries[0]?.evidence.kind === 'passage') assert.equal(entries[0].evidence.source, 'recruitmentLink');
});
