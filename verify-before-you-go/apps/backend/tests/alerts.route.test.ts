import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AlertDetailResponseSchema,
  AlertListResponseSchema,
  ApiErrorSchema,
  type AlertDetail,
  type AlertListQuery,
} from '@vbyg/contracts';

import { buildApp } from '../src/app.js';
import type { AlertsRepository } from '../src/modules/alerts/alerts.repository.js';
import { seedCommunityAlerts } from '../src/modules/alerts/alerts.seed-data.js';

const alerts: AlertDetail[] = seedCommunityAlerts.map((alert) => ({
  ...alert,
  syntheticLabel: 'Synthetic demo data',
  safetyStatement: 'This reviewed record is not a verdict and does not establish fraud.',
  firstReportedAt: alert.firstReportedAt.toISOString(),
  reviewedAt: alert.reviewedAt.toISOString(),
}));

function matchesQuery(alert: AlertDetail, query: AlertListQuery): boolean {
  const search = query.search?.toLocaleLowerCase('en');
  return (!query.location || alert.location === query.location)
    && (!query.category || alert.category === query.category)
    && (!search || [
      alert.id,
      alert.title,
      alert.locationLabel,
      alert.summary,
      ...alert.maskedIdentifiers,
    ].some((value) => value.toLocaleLowerCase('en').includes(search)));
}

function createTestAlertsRepository(): AlertsRepository {
  return {
    async list(query) {
      return alerts
        .filter((alert) => matchesQuery(alert, query))
        .toSorted((left, right) => right.reviewedAt.localeCompare(left.reviewedAt));
    },
    async findById(id) {
      return alerts.find((alert) => alert.id === id) ?? null;
    },
  };
}

function buildAlertsTestApp() {
  return buildApp({
    alertsRepository: createTestAlertsRepository(),
    corsOrigins: ['http://localhost:8081'],
    databaseCheck: async () => true,
  });
}

function createUnsafeAlertsRepository(maskedIdentifier: string): AlertsRepository {
  const unsafeAlert = { ...alerts[0]!, maskedIdentifiers: [maskedIdentifier] };
  return {
    list: async () => [unsafeAlert],
    findById: async () => unsafeAlert,
  };
}

test('GET /api/v1/alerts returns reviewed synthetic summaries without private evidence', async () => {
  const app = await buildAlertsTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/alerts' });
  const payload = AlertListResponseSchema.parse(response.json());

  assert.equal(response.statusCode, 200);
  assert.equal(payload.alerts.length, seedCommunityAlerts.length);
  assert.ok(payload.alerts.every((alert) => alert.syntheticLabel === 'Synthetic demo data'));
  assert.ok(payload.alerts.every((alert) => alert.maskedIdentifiers.every((value) => /[•*]/.test(value))));
  assert.equal('observedEvidence' in (payload.alerts[0] ?? {}), false);
  await app.close();
});

test('GET /api/v1/alerts applies search, location and category filters', async () => {
  const app = await buildAlertsTestApp();
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/alerts?search=passport&location=cambodia&category=off-platform-contact',
  });
  const payload = AlertListResponseSchema.parse(response.json());

  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload.alerts.map((alert) => alert.id), ['A-018']);
  await app.close();
});

test('GET /api/v1/alerts accepts masked identifier searches', async () => {
  const app = await buildAlertsTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/alerts?search=5519' });
  const payload = AlertListResponseSchema.parse(response.json());

  assert.deepEqual(payload.alerts.map((alert) => alert.id), ['A-036']);
  await app.close();
});

test('GET /api/v1/alerts rejects unsupported filter values', async () => {
  const app = await buildAlertsTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/alerts?location=unknown' });
  const payload = ApiErrorSchema.parse(response.json());

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
  await app.close();
});

test('GET /api/v1/alerts rejects unsupported query parameters', async () => {
  const app = await buildAlertsTestApp();
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/alerts?search=telegram&unexpected=private-value',
  });
  const payload = ApiErrorSchema.parse(response.json());

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
  assert.doesNotMatch(JSON.stringify(payload), /private-value/);
  await app.close();
});

test('alert search values are redacted from Fastify request logs', async () => {
  let capturedLogs = '';
  const app = await buildApp({
    alertsRepository: createTestAlertsRepository(),
    corsOrigins: ['http://localhost:8081'],
    databaseCheck: async () => true,
    logger: {
      level: 'info',
      stream: { write: (message) => { capturedLogs += message; } },
    },
  });
  const submittedHandle = '@private-search-handle';
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/alerts?search=${encodeURIComponent(submittedHandle)}`,
  });

  assert.equal(response.statusCode, 200);
  await app.close();
  assert.match(capturedLogs, /\/api\/v1\/alerts/);
  assert.doesNotMatch(capturedLogs, /private-search-handle|%40private-search-handle/);
});

test('list endpoint fails closed for unmasked and weakly masked repository values', async () => {
  for (const unsafeIdentifier of [
    '@fully-visible-handle',
    '@mostly-visible•',
    'person@example.test********',
    '@visible-handle•*•*',
    '+1 ** 1234',
    '+84 •• 731',
    '+855 ** 408',
  ]) {
    const app = await buildApp({
      alertsRepository: createUnsafeAlertsRepository(unsafeIdentifier),
      corsOrigins: ['http://localhost:8081'],
      databaseCheck: async () => true,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/alerts' });
    const payload = ApiErrorSchema.parse(response.json());

    assert.equal(response.statusCode, 500);
    assert.equal(payload.error.code, 'INTERNAL_ERROR');
    assert.doesNotMatch(JSON.stringify(payload), new RegExp(unsafeIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await app.close();
  }
});

test('detail endpoint fails closed for unmasked and weakly masked repository values', async () => {
  for (const unsafeIdentifier of [
    'identity@example.test',
    'identity@example.test*',
    '+855123456789••••••',
    '@visible●•*•',
    '+1 ** 1234',
    '+84 •• 731',
    '+855 ** 408',
  ]) {
    const app = await buildApp({
      alertsRepository: createUnsafeAlertsRepository(unsafeIdentifier),
      corsOrigins: ['http://localhost:8081'],
      databaseCheck: async () => true,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/alerts/A-018' });
    const payload = ApiErrorSchema.parse(response.json());

    assert.equal(response.statusCode, 500);
    assert.equal(payload.error.code, 'INTERNAL_ERROR');
    assert.doesNotMatch(
      JSON.stringify(payload),
      new RegExp(unsafeIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    await app.close();
  }
});

test('GET /api/v1/alerts/:id returns observed evidence, unknowns and verification guidance', async () => {
  const app = await buildAlertsTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/alerts/A-018' });
  const payload = AlertDetailResponseSchema.parse(response.json());

  assert.equal(response.statusCode, 200);
  assert.equal(payload.alert.compatibleReportCount, 4);
  assert.ok(payload.alert.observedEvidence.length >= 3);
  assert.ok(payload.alert.unknownInformation.length >= 2);
  assert.ok(payload.alert.verificationSteps.length >= 3);
  assert.match(payload.alert.safetyStatement, /not a verdict/i);
  await app.close();
});

test('GET /api/v1/alerts/:id returns a privacy-safe 404', async () => {
  const app = await buildAlertsTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/alerts/A-999' });
  const payload = ApiErrorSchema.parse(response.json());

  assert.equal(response.statusCode, 404);
  assert.equal(payload.error.code, 'COMMUNITY_ALERT_NOT_FOUND');
  assert.doesNotMatch(JSON.stringify(payload), /postgres|prisma|filesystem|stack|private evidence/i);
  await app.close();
});
