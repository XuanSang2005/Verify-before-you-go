import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ReportIdempotencyKeySchema,
  ReportStatusLookupRequestSchema,
  ReportStatusLookupResponseSchema,
  ReportSubmissionRequestSchema,
  ReportSubmissionResponseSchema,
} from './reports.js';

const validRequest = {
  subjectType: 'recruiter',
  identifierType: 'handle',
  identifier: '@recruiter_example',
  behaviourIds: ['identity-document-request', 'pressure'],
  description: 'The sender requested a passport image before sharing a written contract.',
  redactedPreview: 'Messaging handle hidden. Passport number hidden.',
  permissions: {
    useForPrivateMatching: true,
    allowRedactedPublicAlert: false,
    shareWithNamedPartner: false,
    namedPartner: '',
  },
} as const;

test('report submission contract accepts a strict structured private report', () => {
  const parsed = ReportSubmissionRequestSchema.parse(validRequest);
  assert.equal(parsed.identifier, '@recruiter_example');
  assert.equal(parsed.behaviourIds.length, 2);
});

test('report submission contract rejects duplicate behaviours, unknown fields and unnamed partner consent', () => {
  assert.equal(ReportSubmissionRequestSchema.safeParse({
    ...validRequest,
    behaviourIds: ['pressure', 'pressure'],
  }).success, false);
  assert.equal(ReportSubmissionRequestSchema.safeParse({ ...validRequest, unexpected: true }).success, false);
  assert.equal(ReportSubmissionRequestSchema.safeParse({
    ...validRequest,
    permissions: { ...validRequest.permissions, shareWithNamedPartner: true },
  }).success, false);
  assert.equal(ReportSubmissionRequestSchema.safeParse({
    ...validRequest,
    permissions: { ...validRequest.permissions, namedPartner: 'Hidden partner' },
  }).success, false);
});

test('report receipt requires a public-safe ID, 130-bit formatted key and honest initial status', () => {
  const payload = ReportSubmissionResponseSchema.parse({
    report: {
      reportId: 'R-23456789ABCDEFGH',
      submittedAt: '2026-08-11T10:00:00.000Z',
      status: 'received',
      statusLabel: 'Received — not yet reviewed.',
      privateIntakeNotice: 'This private receipt does not mean the report has been reviewed, verified or published.',
    },
    recoveryKey: '2345-6789-ABCD-EFGH-JKLM-NPQR-ST',
    recoveryKeyStatus: 'delivered',
  });
  assert.equal(payload.report.status, 'received');
  assert.equal(ReportSubmissionResponseSchema.safeParse({
    ...payload,
    recoveryKey: '7K4P-N2QX',
  }).success, false);
  assert.equal(ReportSubmissionResponseSchema.safeParse({
    ...payload,
    recoveryKey: null,
    recoveryKeyStatus: 'unavailable',
  }).success, true);
  assert.equal(ReportSubmissionResponseSchema.safeParse({
    ...payload,
    recoveryKey: null,
    recoveryKeyStatus: 'delivered',
  }).success, false);
});

test('idempotency keys must be bounded URL-safe values', () => {
  assert.equal(ReportIdempotencyKeySchema.safeParse('abcdefghijklmnopqrst').success, true);
  assert.equal(ReportIdempotencyKeySchema.safeParse('short').success, false);
  assert.equal(ReportIdempotencyKeySchema.safeParse('private key with spaces').success, false);
});

test('report status lookup accepts only exact report and recovery credential formats', () => {
  const valid = {
    reportId: 'R-23456789ABCDEFGH',
    recoveryKey: '2345-6789-ABCD-EFGH-JKLM-NPQR-ST',
  };
  assert.deepEqual(ReportStatusLookupRequestSchema.parse(valid), valid);
  assert.equal(ReportStatusLookupRequestSchema.safeParse({ ...valid, reportId: 'R-1234' }).success, false);
  assert.equal(ReportStatusLookupRequestSchema.safeParse({ ...valid, recoveryKey: '2345-6789' }).success, false);
  assert.equal(ReportStatusLookupRequestSchema.safeParse({ ...valid, privateEvidence: 'hidden' }).success, false);
});

test('report status response is minimal, strict and limited to recoverable states', () => {
  const valid = {
    reportId: 'R-23456789ABCDEFGH',
    submittedAt: '2026-08-11T10:00:00.000Z',
    status: 'under-review',
    updatedAt: '2026-08-12T10:00:00.000Z',
    nextStep: 'Review is in progress. Check again later for an update.',
  };
  assert.deepEqual(ReportStatusLookupResponseSchema.parse(valid), valid);
  assert.equal(ReportStatusLookupResponseSchema.safeParse({ ...valid, status: 'reviewed' }).success, false);
  assert.equal(ReportStatusLookupResponseSchema.safeParse({ ...valid, recoveryKeyHash: 'private' }).success, false);
  assert.equal(ReportStatusLookupResponseSchema.safeParse({ ...valid, privateDescription: 'private' }).success, false);
});
