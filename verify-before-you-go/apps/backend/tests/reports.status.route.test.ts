import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiErrorSchema, ReportStatusLookupResponseSchema } from '@vbyg/contracts';

import { buildApp } from '../src/app.js';
import { createReportRateLimit } from '../src/modules/reports/reports.route.js';
import type {
  ReportsRepository,
  RecruitmentReportStatusRecord,
} from '../src/modules/reports/reports.repository.js';
import { hashRecoveryKey } from '../src/modules/reports/reports.security.js';

const reportId = 'R-23456789ABCDEFGH';
const unknownReportId = 'R-23456789ABCDEFGJ';
const recoveryKey = '2345-6789-ABCD-EFGH-JKLM-NPQR-ST';
const wrongRecoveryKey = '2345-6789-ABCD-EFGH-JKLM-NPQR-SU';

function createRepository(record: RecruitmentReportStatusRecord | null): ReportsRepository {
  return {
    findByIdempotencyHash: async () => null,
    findStatusByPublicId: async (requestedId) => requestedId === record?.publicId ? record : null,
    create: async () => { throw new Error('not used'); },
    clearRecoveryKeyDelivery: async () => undefined,
    clearExpiredRecoveryKeyDeliveries: async () => 0,
  };
}

function buildStatusApp(
  repository: ReportsRepository,
  logger?: Parameters<typeof buildApp>[0]['logger'],
) {
  return buildApp({
    corsOrigins: ['http://localhost:8081'],
    databaseCheck: async () => true,
    logger,
    reportsRepository: repository,
    reportSecuritySecret: 'c3RhdHVzLXJvdXRlLXRlc3Qtc2VjcmV0LWF0LWxlYXN0LTMyLWJ5dGVz',
  });
}

async function createRecord(
  status: RecruitmentReportStatusRecord['status'] = 'RECEIVED',
): Promise<RecruitmentReportStatusRecord> {
  return {
    publicId: reportId,
    recoveryKeyHash: await hashRecoveryKey(recoveryKey, Buffer.alloc(16, 11)),
    status,
    submittedAt: new Date('2026-08-11T10:00:00.000Z'),
    updatedAt: new Date('2026-08-12T11:30:00.000Z'),
  };
}

test('POST /api/v1/reports/status returns only minimal status data for all supported states', async () => {
  for (const status of ['RECEIVED', 'UNDER_REVIEW', 'MORE_EVIDENCE_NEEDED'] as const) {
    const app = await buildStatusApp(createRepository(await createRecord(status)));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/status',
      payload: { reportId, recoveryKey },
    });
    const payload = ReportStatusLookupResponseSchema.parse(response.json());

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers.pragma, 'no-cache');
    assert.deepEqual(Object.keys(payload).sort(), [
      'nextStep',
      'reportId',
      'status',
      'submittedAt',
      'updatedAt',
    ]);
    assert.equal(response.body.includes(recoveryKey), false);
    assert.doesNotMatch(response.body, /privateIdentifier|privateDescription|ciphertext|recoveryKeyHash/iu);
    await app.close();
  }
});

test('wrong recovery key and unknown report ID return indistinguishable generic responses', async () => {
  const app = await buildStatusApp(createRepository(await createRecord()));
  const common = {
    method: 'POST' as const,
    url: '/api/v1/reports/status',
  };
  const wrongKey = await app.inject({
    ...common,
    payload: { reportId, recoveryKey: wrongRecoveryKey },
  });
  const unknownId = await app.inject({
    ...common,
    payload: { reportId: unknownReportId, recoveryKey },
  });

  assert.equal(wrongKey.statusCode, 404);
  assert.equal(unknownId.statusCode, 404);
  const wrongError = ApiErrorSchema.parse(wrongKey.json()).error;
  const unknownError = ApiErrorSchema.parse(unknownId.json()).error;
  assert.deepEqual(
    { code: wrongError.code, message: wrongError.message },
    { code: unknownError.code, message: unknownError.message },
  );
  assert.equal(wrongError.code, 'REPORT_STATUS_UNAVAILABLE');
  assert.doesNotMatch(wrongKey.body, new RegExp(`${reportId}|${wrongRecoveryKey}`, 'u'));
  assert.doesNotMatch(unknownId.body, new RegExp(`${unknownReportId}|${recoveryKey}`, 'u'));
  await app.close();
});

test('client request-ID headers cannot place report credentials in logs or error responses', async () => {
  let capturedLogs = '';
  const app = await buildStatusApp(createRepository(await createRecord()), {
    level: 'info',
    stream: { write: (message) => { capturedLogs += message; } },
  });
  const wrongKey = await app.inject({
    method: 'POST',
    url: '/api/v1/reports/status',
    headers: { 'x-request-id': recoveryKey },
    payload: { reportId, recoveryKey: wrongRecoveryKey },
  });
  const unknownId = await app.inject({
    method: 'POST',
    url: '/api/v1/reports/status',
    headers: { 'x-request-id': unknownReportId },
    payload: { reportId: unknownReportId, recoveryKey },
  });
  await app.close();

  for (const response of [wrongKey, unknownId]) {
    const error = ApiErrorSchema.parse(response.json()).error;
    assert.equal(response.statusCode, 404);
    assert.equal(error.code, 'REPORT_STATUS_UNAVAILABLE');
    assert.match(error.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
    assert.notEqual(error.requestId, recoveryKey);
    assert.notEqual(error.requestId, unknownReportId);
    assert.equal(response.body.includes(recoveryKey), false);
    assert.equal(response.body.includes(reportId), false);
    assert.equal(response.body.includes(unknownReportId), false);
  }
  assert.equal(capturedLogs.includes(recoveryKey), false);
  assert.equal(capturedLogs.includes(reportId), false);
  assert.equal(capturedLogs.includes(unknownReportId), false);
});

test('status lookup is strict and malformed requests consume its early bounded rate limit', async () => {
  const app = await buildStatusApp(createRepository(null));
  for (let index = 0; index < 6; index += 1) {
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/status',
      payload: { reportId: `not-valid-${index}`, recoveryKey, unexpected: true },
    });
    assert.equal(malformed.statusCode, 400);
    assert.equal(malformed.headers['cache-control'], 'no-store');
  }
  const limited = await app.inject({
    method: 'POST',
    url: '/api/v1/reports/status',
    payload: { reportId, recoveryKey },
  });

  assert.equal(limited.statusCode, 429);
  assert.equal(ApiErrorSchema.parse(limited.json()).error.code, 'REPORT_STATUS_RATE_LIMITED');
  assert.equal(limited.headers['cache-control'], 'no-store');
  await app.close();
});

test('status rate-limit buckets expire and evict within their memory bound', () => {
  const rateLimit = createReportRateLimit(1, 100, 2);
  assert.equal(rateLimit.consume('address-a', 0), true);
  assert.equal(rateLimit.consume('address-a', 1), false);
  assert.equal(rateLimit.consume('address-b', 2), true);
  assert.equal(rateLimit.consume('address-c', 3), true);
  // Adding C evicts the oldest bucket A rather than growing beyond two keys.
  assert.equal(rateLimit.consume('address-a', 4), true);
  // All remaining buckets expire at the configured boundary.
  assert.equal(rateLimit.consume('address-a', 104), true);
});

test('status lookup rejects query credentials and never records body values in Fastify logs', async () => {
  let capturedLogs = '';
  const app = await buildStatusApp(createRepository(await createRecord()), {
    level: 'info',
    stream: { write: (message) => { capturedLogs += message; } },
  });
  const queryCredential = await app.inject({
    method: 'POST',
    url: `/api/v1/reports/status?recoveryKey=${recoveryKey}`,
    payload: { reportId, recoveryKey },
  });
  const success = await app.inject({
    method: 'POST',
    url: '/api/v1/reports/status',
    payload: { reportId, recoveryKey },
  });
  await app.close();

  assert.equal(queryCredential.statusCode, 400);
  assert.equal(success.statusCode, 200);
  assert.match(capturedLogs, /\/api\/v1\/reports\/status/u);
  assert.equal(capturedLogs.includes(reportId), false);
  assert.equal(capturedLogs.includes(recoveryKey), false);
  assert.doesNotMatch(capturedLogs, /recoveryKeyHash|privateIdentifier|privateDescription|request.*body/iu);
});

test('repository failure returns a no-store generic unavailable response', async () => {
  const repository = createRepository(null);
  repository.findStatusByPublicId = async () => { throw new Error(`database leaked ${reportId}`); };
  const app = await buildStatusApp(repository);
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/reports/status',
    payload: { reportId, recoveryKey },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(ApiErrorSchema.parse(response.json()).error.code, 'REPORT_STATUS_SERVICE_UNAVAILABLE');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.includes(reportId), false);
  assert.equal(response.body.includes(recoveryKey), false);
  assert.doesNotMatch(response.body, /database leaked/iu);
  await app.close();
});
