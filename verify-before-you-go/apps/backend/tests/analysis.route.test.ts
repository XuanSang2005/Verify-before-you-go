import assert from 'node:assert/strict';
import test from 'node:test';

import { AnalyseOfferResponseSchema, ApiErrorSchema } from '@vbyg/contracts';

import { buildApp } from '../src/app.js';

test('POST /api/v1/checks/analyse returns a contract-valid transient analysis', async () => {
  const app = await buildApp({ corsOrigins: ['http://localhost:8081'], databaseCheck: async () => true });
  const payload = {
    postingText: 'URGENT: Contact us on Telegram today and send a passport photo.',
    recruitmentLink: 'https://jobs.example.org/posting',
    screenshotProvided: false,
  };
  const response = await app.inject({ method: 'POST', url: '/api/v1/checks/analyse', payload });
  const analysis = AnalyseOfferResponseSchema.parse(response.json());
  assert.equal(response.statusCode, 200);
  assert.ok(analysis.observedSignalCount >= 3);
  assert.equal('postingText' in analysis, false);
  await app.close();
});

test('POST /api/v1/checks/analyse uses the consistent validation error contract', async () => {
  const app = await buildApp({ corsOrigins: ['http://localhost:8081'], databaseCheck: async () => true });
  const response = await app.inject({ method: 'POST', url: '/api/v1/checks/analyse', payload: {} });
  const error = ApiErrorSchema.parse(response.json());
  assert.equal(response.statusCode, 400);
  assert.equal(error.error.code, 'VALIDATION_ERROR');
  assert.ok(error.error.requestId);
  await app.close();
});

test('POST /api/v1/checks/analyse does not depend on database availability', async () => {
  const app = await buildApp({ corsOrigins: ['http://localhost:8081'], databaseCheck: async () => false });
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/checks/analyse',
    payload: { screenshotProvided: true },
  });
  assert.equal(response.statusCode, 200);
  await app.close();
});

test('POST /api/v1/checks/analyse preserves raw text when calculating offsets', async () => {
  const app = await buildApp({ corsOrigins: ['http://localhost:8081'], databaseCheck: async () => true });
  const raw = '  URGENT hiring at Acme Ltd.';
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/checks/analyse',
    payload: { postingText: raw, screenshotProvided: false },
  });
  const analysis = AnalyseOfferResponseSchema.parse(response.json());
  const passage = analysis.markedPassages.find((item) => item.findingId === 'urgency-pressure');
  assert.ok(passage);
  assert.equal(raw.slice(passage.start, passage.end), passage.text);
  await app.close();
});
