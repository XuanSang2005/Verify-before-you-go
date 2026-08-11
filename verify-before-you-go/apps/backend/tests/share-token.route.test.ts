import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiErrorSchema,
  ShareTokenCreationResponseSchema,
  ShareTokenVerificationResponseSchema,
} from '@vbyg/contracts';

import { buildApp } from '../src/app.js';

const SECRET = 'c2hhcmUtdG9rZW4tcm91dGUtc2VjcmV0LXdpdGgtNDAteHl6LWJ5dGVzLWVudHJvcHk';

async function createApp(logger?: Parameters<typeof buildApp>[0]['logger']) {
  return buildApp({
    corsOrigins: ['http://localhost:8081'],
    databaseCheck: async () => true,
    logger,
    reportSecuritySecret: SECRET,
  });
}

test('share token endpoints issue and verify only the signed privacy-safe summary', async () => {
  const app = await createApp();
  const creation = await app.inject({
    method: 'POST',
    url: '/api/v1/share-tokens',
    payload: {
      schemaVersion: 1,
      findingIds: ['urgency-pressure', 'shortened-link'],
      demo: false,
    },
  });
  const created = ShareTokenCreationResponseSchema.parse(creation.json());
  const verification = await app.inject({
    method: 'POST',
    url: '/api/v1/share-tokens/verify',
    payload: { token: created.token },
  });
  const verified = ShareTokenVerificationResponseSchema.parse(verification.json());

  assert.equal(creation.statusCode, 201);
  assert.equal(verification.statusCode, 200);
  assert.deepEqual(verified.findingIds, ['urgency-pressure', 'shortened-link']);
  assert.equal(verified.demo, false);
  assert.equal(creation.headers['cache-control'], 'no-store');
  assert.equal(verification.headers['cache-control'], 'no-store');
  await app.close();
});

test('share endpoints reject unexpected fields, malformed tokens and tampering generically', async () => {
  const app = await createApp();
  const unexpected = await app.inject({
    method: 'POST',
    url: '/api/v1/share-tokens',
    payload: {
      schemaVersion: 1,
      findingIds: ['urgency-pressure'],
      demo: false,
      postingText: 'private posting text',
    },
  });
  const malformed = await app.inject({
    method: 'POST',
    url: '/api/v1/share-tokens/verify',
    payload: { token: 'unsigned' },
  });

  assert.equal(unexpected.statusCode, 400);
  assert.equal(malformed.statusCode, 400);
  assert.equal(ApiErrorSchema.parse(unexpected.json()).error.code, 'VALIDATION_ERROR');
  assert.equal(ApiErrorSchema.parse(malformed.json()).error.code, 'VALIDATION_ERROR');
  assert.doesNotMatch(unexpected.body, /private posting text/u);
  await app.close();
});

test('share values and tokens do not appear in captured Fastify logs', async () => {
  let capturedLogs = '';
  const privateValues = ['person@example.com', '@private-handle', 'AB1234567'];
  const app = await createApp({
    level: 'info',
    stream: { write: (message) => { capturedLogs += message; } },
  });
  const creation = await app.inject({
    method: 'POST',
    url: '/api/v1/share-tokens',
    payload: { schemaVersion: 1, findingIds: ['identity-document-request'], demo: true },
  });
  const created = ShareTokenCreationResponseSchema.parse(creation.json());
  await app.inject({
    method: 'POST',
    url: '/api/v1/share-tokens/verify',
    payload: { token: created.token },
  });
  await app.inject({
    method: 'POST',
    url: '/api/v1/share-tokens',
    payload: {
      schemaVersion: 1,
      findingIds: ['urgency-pressure'],
      demo: false,
      postingText: privateValues.join(' '),
    },
  });
  await app.close();

  assert.match(capturedLogs, /\/api\/v1\/share-tokens/u);
  assert.doesNotMatch(capturedLogs, /identity-document-request/u);
  assert.equal(capturedLogs.includes(created.token), false);
  for (const privateValue of privateValues) assert.equal(capturedLogs.includes(privateValue), false);
});
