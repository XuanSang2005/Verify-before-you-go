import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiErrorSchema,
  SupportDirectoryResponseSchema,
  type SupportCountry,
} from '@vbyg/contracts';

import { buildApp } from '../src/app.js';
import type {
  SupportContactRecord,
  SupportRepository,
} from '../src/modules/support/support.repository.js';
import { seedSupportContacts } from '../src/modules/support/support.seed-data.js';
import { listSupportContacts } from '../src/modules/support/support.service.js';

const records: SupportContactRecord[] = seedSupportContacts.map(({ isActive, ...contact }) => {
  assert.equal(isActive, true);
  return contact;
});

function createTestSupportRepository(): SupportRepository {
  return {
    async list(country?: SupportCountry) {
      return records.filter((record) => !country || record.country === country);
    },
  };
}

function buildSupportTestApp() {
  return buildApp({
    corsOrigins: ['http://localhost:8081'],
    databaseCheck: async () => true,
    supportRepository: createTestSupportRepository(),
  });
}

test('GET /api/v1/support-contacts returns both country packs with explicit status metadata', async () => {
  const app = await buildSupportTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/support-contacts' });
  const payload = SupportDirectoryResponseSchema.parse(response.json());

  assert.equal(response.statusCode, 200);
  assert.equal(payload.schemaVersion, 1);
  assert.deepEqual(new Set(payload.contacts.map((contact) => contact.country)), new Set(['cambodia', 'vietnam']));
  assert.ok(payload.contacts.some((contact) => contact.kind === 'emergency'));
  assert.ok(payload.contacts.some((contact) => contact.kind === 'embassy'));
  assert.ok(payload.contacts.some((contact) => contact.kind === 'organization'));
  assert.ok(payload.contacts.every((contact) => contact.accessMode === 'cellular' || contact.accessMode === 'internet'));
  await app.close();
});

test('GET /api/v1/support-contacts filters one allowlisted country and rejects unknown parameters', async () => {
  const app = await buildSupportTestApp();
  const filtered = await app.inject({ method: 'GET', url: '/api/v1/support-contacts?country=vietnam' });
  const payload = SupportDirectoryResponseSchema.parse(filtered.json());
  assert.ok(payload.contacts.length > 0);
  assert.ok(payload.contacts.every((contact) => contact.country === 'vietnam'));

  const unknownCountry = await app.inject({ method: 'GET', url: '/api/v1/support-contacts?country=other' });
  assert.equal(unknownCountry.statusCode, 400);
  assert.equal(ApiErrorSchema.parse(unknownCountry.json()).error.code, 'VALIDATION_ERROR');

  const unknownParameter = await app.inject({ method: 'GET', url: '/api/v1/support-contacts?location=cambodia' });
  assert.equal(unknownParameter.statusCode, 400);
  await app.close();
});

test('support service marks expired records review-due instead of silently authoritative', async () => {
  const response = await listSupportContacts(
    createTestSupportRepository(),
    { country: 'cambodia' },
    () => new Date('2026-10-01T00:00:00.000Z'),
  );
  assert.ok(response.contacts.every((contact) => contact.reviewStatus === 'review-due'));
});
