import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiErrorSchema,
  NewsDetailResponseSchema,
  NewsListResponseSchema,
  type NewsCategory,
  type NewsStoryDetail,
} from '@vbyg/contracts';

import { buildApp } from '../src/app.js';
import type { NewsRepository } from '../src/modules/news/news.repository.js';
import { seedNewsStories } from '../src/modules/news/news.seed-data.js';

const stories: NewsStoryDetail[] = seedNewsStories.map((story) => ({
  ...story,
  syntheticLabel: 'Synthetic prototype',
  publishedAt: story.publishedAt.toISOString(),
  reviewedAt: story.reviewedAt.toISOString(),
}));

function createTestNewsRepository(): NewsRepository {
  return {
    async list(category?: NewsCategory) {
      return stories
        .filter((story) => !category || story.category === category)
        .toSorted((left, right) => Number(right.isFeatured) - Number(left.isFeatured)
          || right.publishedAt.localeCompare(left.publishedAt));
    },
    async findBySlug(slug) {
      return stories.find((story) => story.slug === slug) ?? null;
    },
  };
}

function buildNewsTestApp() {
  return buildApp({
    corsOrigins: ['http://localhost:8081'],
    databaseCheck: async () => true,
    newsRepository: createTestNewsRepository(),
  });
}

test('GET /api/v1/news returns featured-first synthetic summaries', async () => {
  const app = await buildNewsTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/news' });
  const payload = NewsListResponseSchema.parse(response.json());

  assert.equal(response.statusCode, 200);
  assert.equal(payload.stories.length, seedNewsStories.length);
  const firstStory = payload.stories[0];
  assert.ok(firstStory);
  assert.equal(firstStory.isFeatured, true);
  assert.ok(payload.stories.every((story) => story.syntheticLabel === 'Synthetic prototype'));
  assert.equal('bodySections' in firstStory, false);
  await app.close();
});

test('GET /api/v1/news filters canonical categories', async () => {
  const app = await buildNewsTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/news?category=guide' });
  const payload = NewsListResponseSchema.parse(response.json());

  assert.equal(response.statusCode, 200);
  assert.ok(payload.stories.length >= 2);
  assert.ok(payload.stories.every((story) => story.category === 'guide'));
  await app.close();
});

test('GET /api/v1/news rejects unknown filters with the common error contract', async () => {
  const app = await buildNewsTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/news?category=official-alert' });
  const payload = ApiErrorSchema.parse(response.json());

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
  await app.close();
});

test('GET /api/v1/news/:slug returns the complete educational story', async () => {
  const app = await buildNewsTestApp();
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/news/verify-recruiter-before-fee-or-document',
  });
  const payload = NewsDetailResponseSchema.parse(response.json());

  assert.equal(response.statusCode, 200);
  assert.equal(payload.story.isFeatured, true);
  assert.ok(payload.story.bodySections.length >= 2);
  assert.ok(payload.story.verificationSteps.length >= 3);
  assert.match(payload.story.sourceNotes.join(' '), /synthetic/i);
  await app.close();
});

test('GET /api/v1/news/:slug returns 404 without leaking storage details', async () => {
  const app = await buildNewsTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/v1/news/not-found' });
  const payload = ApiErrorSchema.parse(response.json());

  assert.equal(response.statusCode, 404);
  assert.equal(payload.error.code, 'NEWS_STORY_NOT_FOUND');
  assert.doesNotMatch(JSON.stringify(payload), /postgres|prisma|filesystem|stack/i);
  await app.close();
});
