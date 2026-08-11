import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import {
  SHARE_TOKEN_MAX_LIFETIME_MS,
  ShareTokenVerificationResponseSchema,
  type ShareTokenClaims,
} from '@vbyg/contracts';

import {
  deriveShareTokenSigningKey,
  ExpiredShareTokenError,
  InvalidShareTokenError,
  issueShareToken,
  verifyShareToken,
} from '../src/modules/shares/share-token.service.js';

const SECRET = 'c2hhcmUtdG9rZW4tdGVzdC1zZWNyZXQtd2l0aC00MC1ieXRlcy1vZi1lbnRyb3B5';
const NOW = new Date('2026-08-11T12:00:00.000Z');

test('signed share token round-trips strict allowlisted claims with a seven-day maximum', () => {
  const issued = issueShareToken({
    schemaVersion: 1,
    findingIds: ['urgency-pressure', 'shortened-link'],
    demo: false,
  }, SECRET, { now: () => NOW });
  const verified = verifyShareToken(issued.token, SECRET, NOW);

  assert.deepEqual(ShareTokenVerificationResponseSchema.parse(verified), {
    schemaVersion: 1,
    findingIds: ['urgency-pressure', 'shortened-link'],
    demo: false,
    issuedAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + SHARE_TOKEN_MAX_LIFETIME_MS).toISOString(),
    checkedRuleCount: 9,
  });
});

test('changing findings, demo, expiry or any signature byte is rejected', () => {
  const { token } = issueShareToken({
    schemaVersion: 1,
    findingIds: ['urgency-pressure'],
    demo: false,
  }, SECRET, { now: () => NOW });
  const mutations = [
    mutatePayload(token, (claims) => ({ ...claims, findingIds: ['shortened-link'] })),
    mutatePayload(token, (claims) => ({ ...claims, demo: true })),
    mutatePayload(token, (claims) => ({
      ...claims,
      expiresAt: new Date(Date.parse(claims.expiresAt) - 1_000).toISOString(),
    })),
    `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`,
  ];

  for (const mutation of mutations) {
    assert.throws(() => verifyShareToken(mutation, SECRET, NOW), InvalidShareTokenError);
  }
});

test('expired and validly signed over-seven-day tokens fail closed', () => {
  const issued = issueShareToken({
    schemaVersion: 1,
    findingIds: [],
    demo: false,
  }, SECRET, { now: () => NOW });
  assert.throws(
    () => verifyShareToken(
      issued.token,
      SECRET,
      new Date(NOW.getTime() + SHARE_TOKEN_MAX_LIFETIME_MS),
    ),
    ExpiredShareTokenError,
  );

  const overLifetimeClaims: ShareTokenClaims = {
    schemaVersion: 1,
    findingIds: ['urgency-pressure'],
    demo: false,
    issuedAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + SHARE_TOKEN_MAX_LIFETIME_MS + 1).toISOString(),
  };
  assert.throws(
    () => verifyShareToken(signUncheckedClaims(overLifetimeClaims), SECRET, NOW),
    InvalidShareTokenError,
  );
});

test('token payload contains no private recruitment material', () => {
  const privateValues = [
    'person@example.com',
    '@private-handle',
    'AB1234567',
    'R-23456789ABCDEFGH',
    '2345-6789-ABCD-EFGH-JKLM-NPQR-ST',
  ];
  const { token } = issueShareToken({
    schemaVersion: 1,
    findingIds: ['identity-document-request'],
    demo: false,
  }, SECRET, { now: () => NOW });
  const decoded = Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8');
  for (const privateValue of privateValues) {
    assert.doesNotMatch(`${token}\n${decoded}`, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
});

function mutatePayload(
  token: string,
  mutate: (claims: ShareTokenClaims) => ShareTokenClaims,
): string {
  const [version, payload, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as ShareTokenClaims;
  const mutatedPayload = Buffer.from(JSON.stringify(mutate(claims)), 'utf8').toString('base64url');
  return `${version}.${mutatedPayload}.${signature}`;
}

function signUncheckedClaims(claims: ShareTokenClaims): string {
  const payload = Buffer.from(JSON.stringify({
    schemaVersion: claims.schemaVersion,
    findingIds: claims.findingIds,
    demo: claims.demo,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  }), 'utf8').toString('base64url');
  const signature = createHmac('sha256', deriveShareTokenSigningKey(SECRET))
    .update('share-token-signing-v1\0', 'utf8')
    .update(payload, 'ascii')
    .digest('base64url');
  return `v1.${payload}.${signature}`;
}
