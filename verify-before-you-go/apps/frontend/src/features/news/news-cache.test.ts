import assert from 'node:assert/strict';
import test from 'node:test';

import type { NewsDetailResponse, NewsListResponse } from '@vbyg/contracts';

import {
  loadCachedNewsDetail,
  loadCachedNewsList,
  saveCachedNewsDetail,
  saveCachedNewsList,
  type NewsCacheStoragePort,
} from './news-cache';

const summary = {
  slug: 'cached-story',
  category: 'guide',
  title: 'Cached synthetic story.',
  dek: 'Previously loaded content.',
  sourceStatus: 'synthetic-prototype',
  sourceStatusLabel: 'Synthetic pattern only',
  syntheticLabel: 'Synthetic prototype',
  readingMinutes: 3,
  isFeatured: true,
  publishedAt: '2026-08-03T02:00:00.000Z',
  reviewedAt: '2026-08-08T02:00:00.000Z',
} as const;

function createStorage(): NewsCacheStoragePort & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => { values.delete(key); },
    setItem: async (key, value) => { values.set(key, value); },
  };
}

test('news summaries remain available from versioned offline cache', async () => {
  const storage = createStorage();
  const data: NewsListResponse = {
    stories: [summary],
    fetchedAt: '2026-08-10T02:00:00.000Z',
    syntheticContentNotice: 'These stories are synthetic prototype content, not live reporting or official advice.',
  };
  await saveCachedNewsList(data, storage, '2026-08-10T03:00:00.000Z');
  const cached = await loadCachedNewsList(storage);
  assert.equal(cached?.data.stories[0]?.slug, 'cached-story');
  assert.equal(cached?.cachedAt, '2026-08-10T03:00:00.000Z');
});

test('news detail cache stores only public API content', async () => {
  const storage = createStorage();
  const detail: NewsDetailResponse = {
    story: {
      ...summary,
      eyebrow: 'Guide · Demo',
      bodySections: ['Public educational paragraph.'],
      verificationSteps: ['Verify independently.'],
      sourceNotes: ['Synthetic prototype content.'],
    },
  };
  await saveCachedNewsDetail('cached-story', detail, storage, '2026-08-10T03:00:00.000Z');
  const cached = await loadCachedNewsDetail('cached-story', storage);
  assert.equal(cached?.data.story.syntheticLabel, 'Synthetic prototype');
  assert.doesNotMatch(JSON.stringify(storage.values), /recovery|passport|private evidence/i);
});

test('corrupt or unsupported news cache is ignored safely', async () => {
  const storage = createStorage();
  storage.values.set('@vbyg/news/list/v1', '{broken');
  assert.equal(await loadCachedNewsList(storage), null);
  storage.values.set('@vbyg/news/list/v1', JSON.stringify({ schemaVersion: 99, data: {} }));
  assert.equal(await loadCachedNewsList(storage), null);
});

test('storage failures reject so UI can fall back to the API or error state', async () => {
  const storage: NewsCacheStoragePort = {
    getItem: async () => { throw new Error('read failed'); },
    removeItem: async () => { throw new Error('remove failed'); },
    setItem: async () => { throw new Error('write failed'); },
  };
  await assert.rejects(() => loadCachedNewsList(storage), /read failed/);
  await assert.rejects(() => saveCachedNewsList({
    stories: [],
    fetchedAt: '2026-08-10T02:00:00.000Z',
    syntheticContentNotice: 'These stories are synthetic prototype content, not live reporting or official advice.',
  }, storage), /write failed/);
});
