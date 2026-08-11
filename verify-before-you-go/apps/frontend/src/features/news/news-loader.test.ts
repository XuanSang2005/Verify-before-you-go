import assert from 'node:assert/strict';
import test from 'node:test';

import type { NewsDetailResponse, NewsListResponse } from '@vbyg/contracts';

import { NewsApiError } from '@/api/news';

import {
  loadNewsDetailState,
  loadNewsroomState,
  type NewsLoaderDependencies,
} from './use-news';

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

const list: NewsListResponse = {
  stories: [summary],
  fetchedAt: '2026-08-10T02:00:00.000Z',
  syntheticContentNotice: 'These stories are synthetic prototype content, not live reporting or official advice.',
};

const detail: NewsDetailResponse = {
  story: {
    ...summary,
    eyebrow: 'Guide · Demo',
    bodySections: ['Check independently.'],
    verificationSteps: ['Find an official source.'],
    sourceNotes: ['Synthetic prototype content.'],
  },
};

function newsError(kind: 'network' | 'http' | 'invalid-response', status?: number) {
  return new NewsApiError({ kind, message: `Synthetic ${kind} failure.`, status });
}

function createDependencies(overrides: Partial<NewsLoaderDependencies> = {}): NewsLoaderDependencies {
  return {
    deleteDetailCache: async () => undefined,
    fetchDetail: async () => detail,
    fetchList: async () => list,
    loadDetailCache: async () => null,
    loadListCache: async () => null,
    saveDetailCache: async () => undefined,
    saveListCache: async () => undefined,
    ...overrides,
  };
}

test('network failure uses saved list content and is the only offline state', async () => {
  const state = await loadNewsroomState(createDependencies({
    fetchList: async () => { throw newsError('network'); },
    loadListCache: async () => ({ schemaVersion: 1, cachedAt: '2026-08-10T03:00:00.000Z', data: list }),
  }));

  assert.equal(state.status, 'offline');
  assert.equal(state.response?.stories[0]?.slug, 'cached-story');
  assert.match(state.message ?? '', /^Offline/);
});

test('cached detail is deleted and never rendered after HTTP 404', async () => {
  let deletedSlug = '';
  const state = await loadNewsDetailState('cached-story', createDependencies({
    deleteDetailCache: async (slug) => { deletedSlug = slug; },
    fetchDetail: async () => { throw newsError('http', 404); },
    loadDetailCache: async () => ({ schemaVersion: 1, cachedAt: '2026-08-10T03:00:00.000Z', data: detail }),
  }));

  assert.equal(deletedSlug, 'cached-story');
  assert.equal(state.status, 'not-found');
  assert.equal(state.response, undefined);
  assert.match(state.message ?? '', /^Not found/);
});

test('HTTP 500 with cache is labelled service unavailable rather than offline', async () => {
  const state = await loadNewsDetailState('cached-story', createDependencies({
    fetchDetail: async () => { throw newsError('http', 500); },
    loadDetailCache: async () => ({ schemaVersion: 1, cachedAt: '2026-08-10T03:00:00.000Z', data: detail }),
  }));

  assert.equal(state.status, 'service-unavailable');
  assert.equal(state.response?.story.slug, 'cached-story');
  assert.equal(state.message, 'Service unavailable · showing saved copy');
});

test('invalid response enters error state even when a saved copy exists', async () => {
  const state = await loadNewsroomState(createDependencies({
    fetchList: async () => { throw newsError('invalid-response'); },
    loadListCache: async () => ({ schemaVersion: 1, cachedAt: '2026-08-10T03:00:00.000Z', data: list }),
  }));

  assert.equal(state.status, 'error');
  assert.equal(state.response, undefined);
  assert.match(state.message ?? '', /invalid-response/);
});
