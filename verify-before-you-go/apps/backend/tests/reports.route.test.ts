import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiErrorSchema,
  ReportSubmissionResponseSchema,
  type ReportSubmissionRequest,
} from '@vbyg/contracts';

import { buildApp } from '../src/app.js';
import type {
  CreateRecruitmentReportInput,
  RecruitmentReportRecord,
  ReportsRepository,
} from '../src/modules/reports/reports.repository.js';

const privateHandle = '@private-route-handle';
const request: ReportSubmissionRequest = {
  subjectType: 'recruiter',
  identifierType: 'handle',
  identifier: privateHandle,
  behaviourIds: ['pressure'],
  description: 'The sender said only one place remained.',
  permissions: {
    useForPrivateMatching: true,
    allowRedactedPublicAlert: false,
    shareWithNamedPartner: false,
    namedPartner: '',
  },
};

function createRouteRepository() {
  const records = new Map<string, RecruitmentReportRecord>();
  const created: CreateRecruitmentReportInput[] = [];
  const repository: ReportsRepository = {
    async findByIdempotencyHash(hash) {
      return records.get(hash) ?? null;
    },
    async create(input) {
      created.push(input);
      const record = {
        publicId: input.publicId,
        idempotencyKeyHash: input.idempotencyKeyHash,
        submissionPayloadHash: input.submissionPayloadHash,
        submittedAt: input.submittedAt,
        recoveryKeyDeliveryCiphertext: input.recoveryKeyDeliveryCiphertext,
        recoveryKeyDeliverUntil: input.recoveryKeyDeliverUntil,
      };
      records.set(input.idempotencyKeyHash, record);
      return record;
    },
    async clearRecoveryKeyDelivery() {},
  };
  return { created, repository };
}

function buildReportsTestApp(repository: ReportsRepository, logger?: Parameters<typeof buildApp>[0]['logger']) {
  return buildApp({
    corsOrigins: ['http://localhost:8081'],
    databaseCheck: async () => true,
    logger,
    reportsRepository: repository,
    reportSecuritySecret: 'cm91dGUtdGVzdC1yZXBvcnQtc2VjdXJpdHktc2VjcmV0LTMyLWJ5dGVz',
  });
}

test('POST /api/v1/reports creates a real private receipt with no raw key in storage', async () => {
  const { created, repository } = createRouteRepository();
  const app = await buildReportsTestApp(repository);
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    headers: { 'idempotency-key': 'route_test_key_1234567890' },
    payload: request,
  });
  const payload = ReportSubmissionResponseSchema.parse(response.json());

  assert.equal(response.statusCode, 201);
  assert.equal(payload.report.status, 'received');
  assert.equal(payload.recoveryKeyStatus, 'delivered');
  assert.ok(payload.recoveryKey);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers.pragma, 'no-cache');
  assert.equal(created.length, 1);
  assert.notEqual(created[0]?.recoveryKeyHash, payload.recoveryKey);
  assert.doesNotMatch(JSON.stringify(created[0]), new RegExp(payload.recoveryKey.replaceAll('-', ''), 'iu'));
  await app.close();
});

test('POST /api/v1/reports rejects missing idempotency and strict-body violations generically', async () => {
  const { repository } = createRouteRepository();
  const app = await buildReportsTestApp(repository);
  const missingKey = await app.inject({ method: 'POST', url: '/api/v1/reports', payload: request });
  const unknownField = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    headers: { 'idempotency-key': 'route_test_key_1234567891' },
    payload: { ...request, rawEvidencePath: '/private/secret.png' },
  });

  assert.equal(missingKey.statusCode, 400);
  assert.equal(ApiErrorSchema.parse(missingKey.json()).error.code, 'VALIDATION_ERROR');
  assert.equal(unknownField.statusCode, 400);
  assert.doesNotMatch(unknownField.body, /private\/secret/iu);
  await app.close();
});

test('idempotent route retries do not create duplicate reports and conflicting payloads return 409', async () => {
  const { created, repository } = createRouteRepository();
  const app = await buildReportsTestApp(repository);
  const options = {
    method: 'POST' as const,
    url: '/api/v1/reports',
    headers: { 'idempotency-key': 'route_test_key_1234567892' },
    payload: request,
  };
  const first = await app.inject(options);
  const second = await app.inject(options);
  const conflict = await app.inject({ ...options, payload: { ...request, description: 'Changed details.' } });

  assert.equal(first.statusCode, 201);
  assert.deepEqual(second.json(), first.json());
  assert.equal(created.length, 1);
  assert.equal(conflict.statusCode, 409);
  assert.equal(ApiErrorSchema.parse(conflict.json()).error.code, 'REPORT_IDEMPOTENCY_CONFLICT');
  assert.equal(second.headers['cache-control'], 'no-store');
  await app.close();
});

test('report identifiers, descriptions, idempotency keys and recovery keys never appear in Fastify logs', async () => {
  const { repository } = createRouteRepository();
  let capturedLogs = '';
  const app = await buildReportsTestApp(repository, {
    level: 'info',
    stream: { write: (message) => { capturedLogs += message; } },
  });
  const submittedKey = 'private_log_key_1234567890';
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    headers: { 'idempotency-key': submittedKey },
    payload: request,
  });
  const payload = ReportSubmissionResponseSchema.parse(response.json());
  await app.close();

  assert.equal(response.statusCode, 201);
  assert.match(capturedLogs, /\/api\/v1\/reports/u);
  assert.doesNotMatch(capturedLogs, /private-route-handle|only one place|private_log_key|[A-Z2-9]{4}(?:-[A-Z2-9]{4}){5}/iu);
  assert.equal(payload.recoveryKey ? capturedLogs.includes(payload.recoveryKey) : false, false);
});

test('repository failure returns a generic retryable response without echoing private content', async () => {
  const app = await buildReportsTestApp({
    findByIdempotencyHash: async () => null,
    create: async () => { throw new Error('database failed'); },
    clearRecoveryKeyDelivery: async () => undefined,
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    headers: { 'idempotency-key': 'route_test_key_1234567893' },
    payload: request,
  });
  const payload = ApiErrorSchema.parse(response.json());

  assert.equal(response.statusCode, 500);
  assert.equal(payload.error.code, 'REPORT_SUBMISSION_FAILED');
  assert.doesNotMatch(response.body, /private-route-handle|only one place|database failed/iu);
  await app.close();
});

test('malformed requests consume the same bounded report-submission rate limit', async () => {
  const { repository } = createRouteRepository();
  const app = await buildReportsTestApp(repository);
  for (let index = 0; index < 10; index += 1) {
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { 'idempotency-key': `malformed_rate_key_${String(index).padStart(4, '0')}` },
      payload: { privateBody: `not-valid-${index}` },
    });
    assert.equal(malformed.statusCode, 400);
    assert.equal(malformed.headers['cache-control'], 'no-store');
  }
  const limited = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    headers: { 'idempotency-key': 'malformed_rate_key_valid_9999' },
    payload: request,
  });
  assert.equal(limited.statusCode, 429);
  assert.equal(ApiErrorSchema.parse(limited.json()).error.code, 'REPORT_RATE_LIMITED');
  assert.equal(limited.headers['cache-control'], 'no-store');
  await app.close();
});

test('Unicode private values never appear in database inputs, logs or API responses', async () => {
  const { created, repository } = createRouteRepository();
  let capturedLogs = '';
  const app = await buildReportsTestApp(repository, {
    level: 'info',
    stream: { write: (message) => { capturedLogs += message; } },
  });
  const privateValues = ['@nguyễn', 'người@example.vn', '+٨٤ ٩١٢ ٣٤٥ ٦٧٨', 'ＡＢ１２３４５６', '@nguy\u200bễn'];
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    headers: { 'idempotency-key': 'unicode_private_route_key_1234' },
    payload: {
      ...request,
      identifier: privateValues[0],
      description: privateValues.join(' · '),
      redactedPreview: privateValues.join(' · '),
      permissions: { ...request.permissions, allowRedactedPublicAlert: true },
    },
  });
  assert.equal(response.statusCode, 201);
  const persisted = JSON.stringify(created[0]);
  for (const value of privateValues) {
    assert.equal(persisted.includes(value), false, value);
    assert.equal(capturedLogs.includes(value), false, value);
    assert.equal(response.body.includes(value), false, value);
  }
  await app.close();
});
