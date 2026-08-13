import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import { fetchNewsStories } from '@/api/news';
import { loadNewsroomState, type NewsLoaderDependencies } from '@/features/news/use-news';

const staticOrigin = process.env.CP16_STATIC_ORIGIN ?? 'http://localhost:8082';
const apiOrigin = process.env.CP16_API_ORIGIN ?? 'http://localhost:4000';
const expectedApiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/u, '');
const lanOrigin = process.env.CP16_LAN_ORIGIN;
const runtimeFetch: typeof fetch = (input, init) => fetch(input, {
  ...init,
  signal: init?.signal ?? AbortSignal.timeout(5_000),
});
const invalidHtmlPatterns = [
  /Switched to client rendering/iu,
  /passing an array of styles/iu,
  /0:\[object Object\]|\[object Object\]/u,
  /UNFINISHED LOCAL PROTOTYPE/iu,
];

const cleanRoutes = [
  { route: '/help', marker: 'data-testid="support-directory-screen"', heading: '>Get help<' },
  { route: '/reports/new', marker: 'data-testid="report-draft-screen"', heading: '>Report what you observed.<' },
  { route: '/alerts/A-018', marker: 'data-testid="community-alert-detail-screen"', heading: '>Loading alert<' },
  {
    route: '/news/verify-recruiter-before-fee-or-document',
    marker: 'data-testid="news-story-detail"',
    heading: 'aria-label="Loading synthetic newsroom story"',
  },
] as const;

test('CP16 static preview serves route-specific SSR bodies without fallback output', async () => {
  const fallbackResponse = await runtimeFetch(`${staticOrigin}/__cp16-route-that-must-not-exist`);
  assert.equal(fallbackResponse.status, 404, 'The generic fallback route must remain a 404');
  const fallbackBody = await fallbackResponse.text();

  for (const { heading, marker, route } of cleanRoutes) {
    const response = await runtimeFetch(`${staticOrigin}${route}`);
    assert.equal(response.status, 200, `${route} returned ${response.status}`);
    const body = await response.text();
    assert.equal(body.includes(marker), true, `${route} is missing its route marker`);
    assert.equal(body.includes(heading), true, `${route} is missing its route heading`);
    for (const pattern of invalidHtmlPatterns) {
      assert.equal(pattern.test(body), false, `${route} contains invalid SSR output: ${pattern.source}`);
    }
    assert.equal(body === fallbackBody, false, `${route} returned the generic fallback document`);
  }
});

test('CP16 backend authorizes localhost and current LAN static-preview origins', async () => {
  assert.ok(lanOrigin, 'CP16_LAN_ORIGIN is required for the runtime CORS regression');
  for (const origin of ['http://localhost:8082', lanOrigin]) {
    const response = await runtimeFetch(`${apiOrigin}/api/v1/news`, {
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
    fetchList: () => fetchNewsStories(undefined, runtimeFetch),
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

test('CP16 export contains exactly one absolute API origin and it is the expected URL', async () => {
  const staticDirectory = new URL('../../../dist/', import.meta.url);
  const files = await readdir(new URL('_expo/static/js/web/', staticDirectory));
  const bundles = await Promise.all(
    files.filter((file) => file.endsWith('.js')).map((file) => readFile(new URL(`_expo/static/js/web/${file}`, staticDirectory), 'utf8')),
  );
  const output = bundles.join('\n');
  const apiOrigins = new Set(output.match(/https?:\/\/(?:[a-z\d.-]+|\[[\da-f:]+\])(?::\d+)?\/api\/v1/giu) ?? []);
  assert.deepEqual([...apiOrigins].sort(), [expectedApiBaseUrl]);
});
