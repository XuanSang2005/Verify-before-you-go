import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SHARE_TOKEN_MAX_LIFETIME_MS,
  ShareSummaryRequestSchema,
  ShareTokenClaimsSchema,
  ShareTokenVerificationRequestSchema,
  ShareTokenVerificationResponseSchema,
} from './share.js';

const issuedAt = '2026-08-11T12:00:00.000Z';

test('share summary accepts only versioned allowlisted findings and a demo flag', () => {
  assert.deepEqual(ShareSummaryRequestSchema.parse({
    schemaVersion: 1,
    findingIds: ['urgency-pressure', 'shortened-link'],
    demo: false,
  }), {
    schemaVersion: 1,
    findingIds: ['urgency-pressure', 'shortened-link'],
    demo: false,
  });
  assert.equal(ShareSummaryRequestSchema.safeParse({
    schemaVersion: 1,
    findingIds: ['urgency-pressure', 'urgency-pressure'],
    demo: false,
  }).success, false);
  assert.equal(ShareSummaryRequestSchema.safeParse({
    schemaVersion: 1,
    findingIds: ['urgency-pressure'],
    demo: false,
    postingText: 'private posting',
  }).success, false);
});

test('share claims reject expired structure and lifetimes beyond seven days', () => {
  const base = {
    schemaVersion: 1 as const,
    findingIds: ['urgency-pressure' as const],
    demo: false,
    issuedAt,
  };
  assert.equal(ShareTokenClaimsSchema.safeParse({
    ...base,
    expiresAt: new Date(Date.parse(issuedAt) + SHARE_TOKEN_MAX_LIFETIME_MS).toISOString(),
  }).success, true);
  assert.equal(ShareTokenClaimsSchema.safeParse({
    ...base,
    expiresAt: new Date(Date.parse(issuedAt) + SHARE_TOKEN_MAX_LIFETIME_MS + 1).toISOString(),
  }).success, false);
  assert.equal(ShareTokenVerificationResponseSchema.safeParse({
    ...base,
    expiresAt: new Date(Date.parse(issuedAt) + SHARE_TOKEN_MAX_LIFETIME_MS + 1).toISOString(),
    checkedRuleCount: 9,
  }).success, false);
  assert.equal(ShareTokenClaimsSchema.safeParse({ ...base, expiresAt: issuedAt }).success, false);
});

test('share token requests reject malformed, overlong and unexpected material', () => {
  assert.equal(ShareTokenVerificationRequestSchema.safeParse({ token: 'unsigned' }).success, false);
  assert.equal(ShareTokenVerificationRequestSchema.safeParse({
    token: `v1.${'a'.repeat(2_100)}.${'b'.repeat(43)}`,
  }).success, false);
  assert.equal(ShareTokenVerificationRequestSchema.safeParse({
    token: `v1.${'a'.repeat(40)}.${'b'.repeat(43)}`,
    evidence: 'private',
  }).success, false);
});
