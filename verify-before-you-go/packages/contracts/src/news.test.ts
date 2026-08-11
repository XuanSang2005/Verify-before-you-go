import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NewsDetailResponseSchema,
  NewsListQuerySchema,
  NewsListResponseSchema,
} from './news.js';

const summary = {
  slug: 'verify-before-paying',
  category: 'guide',
  title: 'Verify before paying.',
  dek: 'A synthetic editorial guide.',
  sourceStatus: 'synthetic-source-list',
  sourceStatusLabel: 'Demo source list reviewed',
  syntheticLabel: 'Synthetic prototype',
  readingMinutes: 4,
  isFeatured: true,
  publishedAt: '2026-08-03T02:00:00.000Z',
  reviewedAt: '2026-08-08T02:00:00.000Z',
} as const;

test('news list query accepts only canonical categories', () => {
  assert.deepEqual(NewsListQuerySchema.parse({ category: 'scam-watch' }), { category: 'scam-watch' });
  assert.equal(NewsListQuerySchema.safeParse({ category: 'alerts' }).success, false);
});

test('news list explicitly labels every local story as synthetic', () => {
  const response = NewsListResponseSchema.parse({
    stories: [summary],
    fetchedAt: '2026-08-10T02:00:00.000Z',
    syntheticContentNotice: 'These stories are synthetic prototype content, not live reporting or official advice.',
  });
  assert.equal(response.stories[0].syntheticLabel, 'Synthetic prototype');
});

test('news detail includes educational copy, verification steps and source notes', () => {
  const response = NewsDetailResponseSchema.parse({
    story: {
      ...summary,
      eyebrow: 'Editorial guide · Demo',
      bodySections: ['Start with the legal employer identity.'],
      verificationSteps: ['Find the official channel independently.'],
      sourceNotes: ['All names and examples are synthetic.'],
    },
  });
  assert.equal(response.story.verificationSteps.length, 1);
});
