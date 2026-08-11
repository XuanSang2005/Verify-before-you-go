import assert from 'node:assert/strict';
import test from 'node:test';
import { HealthResponseSchema } from '@vbyg/contracts';
import { buildApp } from '../src/app.js';

test('GET /api/v1/health returns a contract-valid ready response', async () => {
  const app = await buildApp({ corsOrigins: ['http://localhost:8081'], databaseCheck: async () => true });
  const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
  const payload = HealthResponseSchema.parse(response.json());
  assert.equal(response.statusCode, 200);
  assert.equal(payload.status, 'ok');
  assert.equal(payload.database, 'connected');
  await app.close();
});

test('GET /api/v1/health reports a database outage without leaking details', async () => {
  const app = await buildApp({ corsOrigins: ['http://localhost:8081'], databaseCheck: async () => false });
  const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
  const payload = HealthResponseSchema.parse(response.json());
  assert.equal(response.statusCode, 503);
  assert.equal(payload.status, 'degraded');
  assert.equal(payload.database, 'unavailable');
  await app.close();
});
