import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const listSource = readFileSync(new URL('./NewsroomScreen.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./NewsDetailScreen.tsx', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('./use-news.ts', import.meta.url), 'utf8');
const modelSource = readFileSync(new URL('./news-model.ts', import.meta.url), 'utf8');
const listRoute = readFileSync(new URL('../../../app/(tabs)/news/index.tsx', import.meta.url), 'utf8');
const detailRoute = readFileSync(new URL('../../../app/(tabs)/news/[slug].tsx', import.meta.url), 'utf8');
const newsLayout = readFileSync(new URL('../../../app/(tabs)/news/_layout.tsx', import.meta.url), 'utf8');

test('newsroom placeholder is replaced by headerless Screen 18 composition', () => {
  assert.match(listRoute, /NewsroomScreen/);
  assert.doesNotMatch(`${listSource}\n${detailSource}`, /AppHeader|PrototypeHeader|Get help|checkpoint="CP07"/);
  assert.match(listSource, /Work and recruitment brief\./);
  assert.match(listSource, /Editorial desk · Synthetic prototype/);
  assert.match(listSource, /FeaturedStory/);
});

test('newsroom exposes required filters, metadata and follow-up routes', () => {
  assert.match(listSource, /accessibilityRole="button"/);
  assert.match(listSource, /'aria-pressed': selected/);
  assert.match(modelSource, /Published/);
  assert.match(modelSource, /Reviewed/);
  assert.match(listSource, /sourceStatusLabel/);
  assert.match(listSource, /router\.push\('\/alerts'\)/);
  assert.match(listSource, /router\.push\('\/check\/checklist'\)/);
});

test('newsroom implements loading, empty, offline and error states with retry', () => {
  for (const status of ['loading', 'ready', 'empty', 'offline', 'service-unavailable', 'not-found', 'error']) {
    assert.match(hookSource, new RegExp(`'${status}'`));
  }
  assert.match(listSource, /NewsLoadingState/);
  assert.match(listSource, /No stories in this section/);
  assert.match(listSource, /Offline · showing saved summaries/);
  assert.match(listSource, /Newsroom unavailable/);
  assert.match(listSource, /Retry/);
});

test('news detail has known static paths and never presents a verdict', () => {
  assert.match(newsLayout, /<Stack/);
  assert.match(newsLayout, /headerShown: false/);
  assert.match(detailRoute, /generateStaticParams/);
  assert.match(detailRoute, /NEWS_PROTOTYPE_SLUGS/);
  assert.match(detailSource, /How to check it yourself/);
  assert.match(detailSource, /Source notes/);
  assert.match(detailSource, /not a verdict/i);
  assert.match(detailSource, /router\.canGoBack\(\)/);
});

test('newsroom uses the exact unmodified Screen 18 presenter mascot', () => {
  const mascot = readFileSync(new URL('../../../assets/mascots/news-presenter-v3.png', import.meta.url));
  assert.equal(
    createHash('sha256').update(mascot).digest('hex'),
    '68a269e1beb6b07cd832f8bde5d9e559d7119d891a35889f4aec9b15363a5bc8',
  );
  assert.match(listSource, /news-presenter-v3\.png/);
  assert.match(listSource, /accessible=\{false\}/);
});

test('newsroom has no truncation or visible text below 11px', () => {
  assert.doesNotMatch(`${listSource}\n${detailSource}`, /numberOfLines|ellipsizeMode/);
  const fontSizes = [...`${listSource}\n${detailSource}`.matchAll(/fontSize:\s*(\d+)/g)]
    .map((match) => Number(match[1]));
  assert.ok(fontSizes.length > 0);
  assert.ok(fontSizes.every((size) => size >= 11));
  assert.match(listSource, /cardTitle: \{[^}]*fontSize: 14, lineHeight: 19/);
  assert.match(listSource, /cardDek: \{[^}]*fontSize: 12, lineHeight: 18/);
});
