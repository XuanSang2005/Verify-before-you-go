import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSignedShareToken,
  ShareTokenApiError,
  verifySignedShareToken,
} from './share';

const TOKEN = `v1.${'a'.repeat(80)}.${'b'.repeat(43)}`;
const verified = {
  schemaVersion: 1,
  findingIds: ['urgency-pressure'],
  checkedRuleCount: 9,
  demo: false,
  issuedAt: '2026-08-11T12:00:00.000Z',
  expiresAt: '2026-08-18T12:00:00.000Z',
};

test('frontend creates and verifies a signed token using strict minimal bodies', async () => {
  const requests: { url: string; body: unknown }[] = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    const body = requests.length === 1
      ? { token: TOKEN, expiresAt: verified.expiresAt }
      : verified;
    return new Response(JSON.stringify(body), { status: requests.length === 1 ? 201 : 200 });
  };

  const created = await createSignedShareToken({
    schemaVersion: 1,
    findingIds: ['urgency-pressure'],
    demo: false,
  }, fetchImplementation);
  const result = await verifySignedShareToken(created.token, fetchImplementation);

  assert.equal(created.token, TOKEN);
  assert.deepEqual(result, verified);
  assert.deepEqual(requests.map((request) => request.body), [
    { schemaVersion: 1, findingIds: ['urgency-pressure'], demo: false },
    { token: TOKEN },
  ]);
  assert.doesNotMatch(JSON.stringify(requests), /postingText|evidence|screenshot|reportId|recoveryKey/u);
});

test('frontend token API distinguishes network, HTTP and invalid responses', async () => {
  await assert.rejects(
    createSignedShareToken({ schemaVersion: 1, findingIds: [], demo: false }, async () => { throw new Error('offline'); }),
    (error: unknown) => error instanceof ShareTokenApiError && error.kind === 'network',
  );
  await assert.rejects(
    verifySignedShareToken(TOKEN, async () => new Response(JSON.stringify({
      error: { code: 'SHARE_TOKEN_EXPIRED', message: 'Expired.', requestId: 'request-1' },
    }), { status: 410 })),
    (error: unknown) => error instanceof ShareTokenApiError && error.kind === 'http' && error.status === 410,
  );
  await assert.rejects(
    verifySignedShareToken(TOKEN, async () => new Response(JSON.stringify({ findingIds: ['urgency-pressure'] }), { status: 200 })),
    (error: unknown) => error instanceof ShareTokenApiError && error.kind === 'invalid-response',
  );
});
