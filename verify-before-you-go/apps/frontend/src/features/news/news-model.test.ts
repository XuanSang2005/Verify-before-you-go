import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterNewsStories,
  formatNewsDate,
  getCompactNewsCardCopy,
  getNewsMetadata,
  NEWS_PROTOTYPE_SLUGS,
  newsFilters,
  shouldUseTwoColumnNewsCards,
} from './news-model';

const story = {
  slug: 'story',
  category: 'scam-watch',
  title: 'Story',
  dek: 'Summary',
  sourceStatus: 'synthetic-prototype',
  sourceStatusLabel: 'Synthetic pattern only',
  syntheticLabel: 'Synthetic prototype',
  readingMinutes: 3,
  isFeatured: false,
  publishedAt: '2026-08-03T02:00:00.000Z',
  reviewedAt: '2026-08-08T02:00:00.000Z',
} as const;

test('news filters include every required newsroom category', () => {
  assert.deepEqual(newsFilters.map((filter) => filter.label), [
    'For you', 'Hiring', 'Scam Watch', 'Guides', 'MIL explainers',
  ]);
  assert.equal(filterNewsStories([story], 'scam-watch').length, 1);
  assert.equal(filterNewsStories([story], 'guide').length, 0);
});

test('news metadata exposes publication, review and reading time', () => {
  assert.equal(formatNewsDate(story.publishedAt), '03 Aug 2026');
  assert.equal(getNewsMetadata(story), 'Published 03 Aug 2026 · Reviewed 08 Aug 2026 · 3 min');
});

test('every deterministic seed slug has a static detail path', () => {
  assert.equal(NEWS_PROTOTYPE_SLUGS.length, 6);
  assert.equal(new Set(NEWS_PROTOTYPE_SLUGS).size, NEWS_PROTOTYPE_SLUGS.length);
});

test('compact list copy is short while canonical detail data remains untouched', () => {
  const copies = NEWS_PROTOTYPE_SLUGS.map((slug) => getCompactNewsCardCopy({ ...story, slug }));
  assert.deepEqual(copies[1], {
    title: 'Company impersonation: check the sender',
    dek: 'Use the employer’s official contact.',
  });
  assert.equal(copies[2]?.title, 'Seasonal work: six fields to verify');
  assert.deepEqual(copies[3], {
    title: 'No database match does not mean safe',
    dek: 'A missing entry does not prove safety.',
  });
  assert.deepEqual(copies[4], {
    title: 'Check fees before paying',
    dek: 'Confirm recipient, amount and refund terms.',
  });
  for (const copy of copies) {
    const words = copy.dek.trim().split(/\s+/).length;
    assert.ok(words <= 14, `${copy.dek} has ${words} words`);
  }
  assert.equal(story.title, 'Story');
  assert.equal(story.dek, 'Summary');
});

test('compact cards become equal tablet columns without changing the mobile stack', () => {
  assert.equal(shouldUseTwoColumnNewsCards(360), false);
  assert.equal(shouldUseTwoColumnNewsCards(390), false);
  assert.equal(shouldUseTwoColumnNewsCards(768), true);
});
