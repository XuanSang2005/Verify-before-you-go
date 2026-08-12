import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import { fetchNewsStories } from '@/api/news';
import { loadNewsroomState, type NewsLoaderDependencies } from '@/features/news/use-news';

const staticOrigin = process.env.CP16_STATIC_ORIGIN ?? 'http://localhost:8082';
const apiOrigin = process.env.CP16_API_ORIGIN ?? 'http://localhost:4000';
const expectedApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const lanOrigin = process.env.CP16_LAN_ORIGIN;
const retiredLanIp = '192.168.1.17';

test('CP16 static preview serves clean release routes directly', async () => {
  for (const route of [
    '/help',
    '/reports/new',
    '/alerts/A-018',
    '/news/verify-recruiter-before-fee-or-document',
  ]) {
    const response = await fetch(`${staticOrigin}${route}`);
    assert.equal(response.status, 200, `${route} returned ${response.status}`);
  }
});

test('CP16 backend authorizes localhost and current LAN static-preview origins', async () => {
  assert.ok(lanOrigin, 'CP16_LAN_ORIGIN is required for the runtime CORS regression');
  for (const origin of ['http://localhost:8082', lanOrigin]) {
    const response = await fetch(`${apiOrigin}/api/v1/news`, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'GET',
      },
    });
    assert.equal(response.status, 204, `${origin} preflight returned ${response.status}`);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
});

test('CP16 newsroom reaches ready state with real backend stories', async () => {
  const dependencies: NewsLoaderDependencies = {
    deleteDetailCache: async () => undefined,
    fetchDetail: async () => { throw new Error('Not used'); },
    fetchList: () => fetchNewsStories(),
    loadDetailCache: async () => null,
    loadListCache: async () => null,
    saveDetailCache: async () => undefined,
    saveListCache: async () => undefined,
  };
  const state = await loadNewsroomState(dependencies);
  assert.equal(state.status, 'ready');
  assert.ok(state.response && state.response.stories.length > 0);
  assert.ok(state.response.stories.some(({ slug }) => slug === 'verify-recruiter-before-fee-or-document'));
});

test('CP16 export embeds only the expected current API base URL', async () => {
  const staticDirectory = new URL('../../../dist/', import.meta.url);
  const files = await readdir(new URL('_expo/static/js/web/', staticDirectory));
  const bundles = await Promise.all(
    files.filter((file) => file.endsWith('.js')).map((file) => readFile(new URL(`_expo/static/js/web/${file}`, staticDirectory), 'utf8')),
  );
  const output = bundles.join('\n');
  assert.match(output, new RegExp(expectedApiBaseUrl.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.doesNotMatch(output, new RegExp(retiredLanIp.replaceAll('.', '\\.'), 'u'));
});
