import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchNewsStories,
  fetchNewsStory,
  NewsApiError,
  type NewsFetch,
} from './news';

const summary = {
  slug: 'verify-before-paying',
  category: 'guide',
  title: 'Verify before paying.',
  dek: 'Synthetic guidance.',
  sourceStatus: 'synthetic-prototype',
  sourceStatusLabel: 'Synthetic pattern only',
  syntheticLabel: 'Synthetic prototype',
  readingMinutes: 3,
  isFeatured: true,
  publishedAt: '2026-08-03T02:00:00.000Z',
  reviewedAt: '2026-08-08T02:00:00.000Z',
} as const;

test('news API client requests canonical list filters and validates responses', async () => {
  let requestedUrl = '';
  const fetchImpl: NewsFetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      stories: [summary],
      fetchedAt: '2026-08-10T02:00:00.000Z',
      syntheticContentNotice: 'These stories are synthetic prototype content, not live reporting or official advice.',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const response = await fetchNewsStories('guide', fetchImpl);
  assert.match(requestedUrl, /\/news\?category=guide$/);
  assert.equal(response.stories[0]?.syntheticLabel, 'Synthetic prototype');
});

test('news detail client validates educational detail content', async () => {
  const fetchImpl: NewsFetch = async () => new Response(JSON.stringify({
    story: {
      ...summary,
      eyebrow: 'Guide · Demo',
      bodySections: ['Check the legal entity.'],
      verificationSteps: ['Find an official source independently.'],
      sourceNotes: ['Synthetic prototype content.'],
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const response = await fetchNewsStory('verify-before-paying', fetchImpl);
  assert.equal(response.story.bodySections.length, 1);
});

test('news API client distinguishes HTTP and network failures', async () => {
  const apiFailure: NewsFetch = async () => new Response(JSON.stringify({
    error: { code: 'NEWS_STORY_NOT_FOUND', message: 'Story not found.', requestId: 'request-1' },
  }), { status: 404, headers: { 'content-type': 'application/json' } });
  await assert.rejects(
    () => fetchNewsStory('missing', apiFailure),
    (error) => error instanceof NewsApiError
      && error.kind === 'http'
      && error.status === 404
      && error.code === 'NEWS_STORY_NOT_FOUND',
  );

  const networkFailure: NewsFetch = async () => { throw new Error('offline'); };
  await assert.rejects(
    () => fetchNewsStories(undefined, networkFailure),
    (error) => error instanceof NewsApiError && error.kind === 'network',
  );
});

test('news API client rejects invalid success payloads as invalid responses', async () => {
  const invalidResponse: NewsFetch = async () => new Response(JSON.stringify({ stories: 'not-an-array' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  await assert.rejects(
    () => fetchNewsStories(undefined, invalidResponse),
    (error) => error instanceof NewsApiError && error.kind === 'invalid-response',
  );
});
