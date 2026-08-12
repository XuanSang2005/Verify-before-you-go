import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchSupportDirectory,
  SupportApiError,
  type SupportFetch,
} from './support';

const response = {
  schemaVersion: 1,
  contacts: [{
    id: 'support-cambodia-1288',
    country: 'cambodia',
    countryLabel: 'Cambodia',
    kind: 'emergency',
    title: 'Anti-trafficking hotline',
    description: 'Human-trafficking reporting short code.',
    displayValue: '1288',
    actionUri: 'tel:1288',
    actionLabel: 'Call 1288',
    accessMode: 'cellular',
    accessLabel: 'No data · cellular service required',
    dataStatus: 'reviewed-reference',
    dataStatusLabel: 'Reviewed emergency reference',
    sourceOwner: 'Telecommunication Regulator of Cambodia',
    sourceUrl: 'https://www.trc.gov.kh/en/resources/emergency-numbers/',
    languages: [],
    languageStatus: 'unconfirmed',
    hours: 'Availability not independently confirmed',
    lastReviewedAt: '2026-08-12T00:00:00.000Z',
    nextReviewAt: '2026-09-12T00:00:00.000Z',
    reviewStatus: 'current',
    sortOrder: 10,
  }],
  fetchedAt: '2026-08-12T00:00:00.000Z',
  directoryNotice: 'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.',
} as const;

test('support API loads the complete country pack by default and allows an explicit country filter', async () => {
  const urls: string[] = [];
  const fetchImpl: SupportFetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify(response), { status: 200 });
  };
  await fetchSupportDirectory(undefined, fetchImpl);
  await fetchSupportDirectory('cambodia', fetchImpl);
  assert.match(urls[0] ?? '', /\/support-contacts$/);
  assert.match(urls[1] ?? '', /\/support-contacts\?country=cambodia$/);
});

test('support API distinguishes network, HTTP and invalid response errors', async () => {
  await assert.rejects(
    () => fetchSupportDirectory(undefined, async () => { throw new Error('offline'); }),
    (error) => error instanceof SupportApiError && error.kind === 'network',
  );
  await assert.rejects(
    () => fetchSupportDirectory(undefined, async () => new Response(JSON.stringify({
      error: { code: 'FAILED', message: 'Failed.', requestId: 'opaque-id' },
    }), { status: 500 })),
    (error) => error instanceof SupportApiError && error.kind === 'http' && error.status === 500,
  );
  await assert.rejects(
    () => fetchSupportDirectory(undefined, async () => new Response(JSON.stringify({ contacts: 'invalid' }), { status: 200 })),
    (error) => error instanceof SupportApiError && error.kind === 'invalid-response',
  );
  const terminatedResponse = new Response(null, { status: 200 });
  Object.defineProperty(terminatedResponse, 'json', {
    value: async () => { throw new TypeError('terminated'); },
  });
  await assert.rejects(
    () => fetchSupportDirectory(undefined, async () => terminatedResponse),
    (error) => error instanceof SupportApiError && error.kind === 'network',
  );
  await assert.rejects(
    () => fetchSupportDirectory(undefined, async () => new Response('{broken', { status: 200 })),
    (error) => error instanceof SupportApiError && error.kind === 'invalid-response',
  );
});
