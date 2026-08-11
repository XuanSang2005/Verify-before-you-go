import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyReportDraft, toggleReportBehaviour, updateReportDraft } from '../features/reports/report-model';
import {
  createReportSubmissionRequest,
  ReportSubmissionError,
  submitPrivateReport,
} from './reports';

const responsePayload = {
  report: {
    reportId: 'R-23456789ABCDEFGH',
    submittedAt: '2026-08-11T10:00:00.000Z',
    status: 'received',
    statusLabel: 'Received — not yet reviewed.',
    privateIntakeNotice: 'This private receipt does not mean the report has been reviewed, verified or published.',
  },
  recoveryKey: '2345-6789-ABCD-EFGH-JKLM-NPQR-ST',
  recoveryKeyStatus: 'delivered',
};

test('frontend report request includes reviewed structured facts but never local evidence paths', () => {
  const draft = updateReportDraft(
    toggleReportBehaviour(createEmptyReportDraft('2026-08-11T09:00:00.000Z'), 'pressure'),
    {
      identifier: '@example_recruiter',
      identifierType: 'handle',
      evidence: [{
        id: 'evidence-one',
        uri: 'file:///private/report-image.png',
        fileName: 'report-image.png',
        mimeType: 'image/png',
        addedAt: '2026-08-11T09:01:00.000Z',
      }],
    },
    '2026-08-11T09:02:00.000Z',
  );
  const request = createReportSubmissionRequest(draft);
  const serialized = JSON.stringify(request);
  assert.equal('evidence' in request, false);
  assert.doesNotMatch(serialized, /file:\/\/|report-image/iu);
  assert.match(request.redactedPreview ?? '', /handle ending/iu);
});

test('disabled partner sharing is canonicalized before the request and idempotency fingerprint boundary', () => {
  const base = toggleReportBehaviour(createEmptyReportDraft('2026-08-11T09:00:00.000Z'), 'pressure');
  const previouslyEnabled = updateReportDraft(base, {
    identifier: '@example_recruiter',
    identifierType: 'handle',
    permissions: {
      ...base.permissions,
      shareWithNamedPartner: true,
      namedPartner: 'Private partner name',
    },
  });
  const disabled = updateReportDraft(previouslyEnabled, {
    permissions: {
      ...previouslyEnabled.permissions,
      shareWithNamedPartner: false,
      namedPartner: 'Private partner name',
    },
  });
  const clean = updateReportDraft(base, {
    identifier: '@example_recruiter',
    identifierType: 'handle',
  });
  const disabledRequest = createReportSubmissionRequest(disabled);
  const cleanRequest = createReportSubmissionRequest(clean);
  assert.equal(disabled.permissions.namedPartner, '');
  assert.equal(disabledRequest.permissions.namedPartner, '');
  assert.doesNotMatch(JSON.stringify(disabledRequest), /Private partner name/u);
  assert.deepEqual(disabledRequest, cleanRequest);
});

test('report API sends the stable idempotency header and validates a real receipt', async () => {
  let captured: RequestInit | undefined;
  const result = await submitPrivateReport(
    {
      subjectType: 'recruiter',
      identifierType: 'handle',
      identifier: '@example_recruiter',
      behaviourIds: ['pressure'],
      description: '',
      redactedPreview: 'Messaging handle ending ••••iter',
      permissions: {
        useForPrivateMatching: true,
        allowRedactedPublicAlert: false,
        shareWithNamedPartner: false,
        namedPartner: '',
      },
    },
    'frontend_test_key_1234567890',
    async (_url, init) => {
      captured = init;
      return new Response(JSON.stringify(responsePayload), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    },
  );
  assert.equal((captured?.headers as Record<string, string>)['idempotency-key'], 'frontend_test_key_1234567890');
  assert.equal(result.report.reportId, responsePayload.report.reportId);
});

test('report API distinguishes network, HTTP and invalid-receipt failures', async () => {
  const validRequest = {
    subjectType: 'recruiter' as const,
    identifierType: 'handle' as const,
    identifier: '@example_recruiter',
    behaviourIds: ['pressure' as const],
    description: '',
    permissions: {
      useForPrivateMatching: true,
      allowRedactedPublicAlert: false,
      shareWithNamedPartner: false,
      namedPartner: '',
    },
  };
  await assert.rejects(
    submitPrivateReport(validRequest, 'frontend_test_key_1234567891', async () => { throw new Error('offline'); }),
    (error: unknown) => error instanceof ReportSubmissionError && error.kind === 'network',
  );
  await assert.rejects(
    submitPrivateReport(validRequest, 'frontend_test_key_1234567892', async () => new Response(JSON.stringify({
      error: { code: 'REPORT_SUBMISSION_FAILED', message: 'Try again.', requestId: 'request-1' },
    }), { status: 500 })),
    (error: unknown) => error instanceof ReportSubmissionError && error.kind === 'http' && error.status === 500,
  );
  await assert.rejects(
    submitPrivateReport(validRequest, 'frontend_test_key_1234567893', async () => new Response(JSON.stringify({ fake: true }), { status: 201 })),
    (error: unknown) => error instanceof ReportSubmissionError && error.kind === 'invalid-response',
  );
});

test('report API accepts receipt metadata when the bounded recovery-key delivery has expired', async () => {
  const result = await submitPrivateReport(
    {
      subjectType: 'recruiter',
      identifierType: 'handle',
      identifier: '@example_recruiter',
      behaviourIds: ['pressure'],
      description: '',
      permissions: {
        useForPrivateMatching: true,
        allowRedactedPublicAlert: false,
        shareWithNamedPartner: false,
        namedPartner: '',
      },
    },
    'frontend_test_key_1234567894',
    async () => new Response(JSON.stringify({
      ...responsePayload,
      recoveryKey: null,
      recoveryKeyStatus: 'unavailable',
    }), { status: 201 }),
  );
  assert.equal(result.recoveryKey, null);
  assert.equal(result.recoveryKeyStatus, 'unavailable');
});
