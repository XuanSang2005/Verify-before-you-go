import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const listSource = readFileSync(new URL('./CommunityAlertsScreen.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./AlertDetailScreen.tsx', import.meta.url), 'utf8');
const listRoute = readFileSync(new URL('../../../app/(tabs)/alerts/index.tsx', import.meta.url), 'utf8');
const detailRoute = readFileSync(new URL('../../../app/(tabs)/alerts/[id].tsx', import.meta.url), 'utf8');
const alertsLayout = readFileSync(new URL('../../../app/(tabs)/alerts/_layout.tsx', import.meta.url), 'utf8');
const tabsLayout = readFileSync(new URL('../../../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');

test('CP09 replaces the placeholder with headerless Screen 12 and Screen 13 routes', () => {
  assert.match(listRoute, /CommunityAlertsScreen/);
  assert.match(detailRoute, /AlertDetailScreen/);
  assert.match(alertsLayout, /headerShown: false/);
  assert.doesNotMatch(`${listSource}\n${detailSource}`, /AppHeader|PrototypeHeader|Get help|checkpoint="CP09"/);
  assert.match(listSource, /Check an alert\./);
  assert.match(detailSource, /What was observed/);
  assert.match(detailSource, /What remains unconfirmed/);
  assert.match(detailSource, /Verify your own offer/);
  assert.match(tabsLayout, /name="alerts"/);
  assert.match(tabsLayout, /href: null/);
  assert.match(tabsLayout, /primaryTabRouteNames = \['index', 'check', 'news', 'quiz', 'help'\]/);
});

test('CP09 exposes exact disclaimer, moderation metadata and canonical follow-up routes', () => {
  assert.match(listSource, /No match does not mean an offer is safe\./);
  assert.match(detailSource, /This is not a finding of fraud\./);
  assert.match(detailSource, /Not a verdict/);
  assert.match(detailSource, /Last reviewed/);
  assert.match(detailSource, /router\.push\('\/check'\)/);
  assert.match(detailSource, /router\.push\('\/reports\/new'\)/);
  assert.match(detailSource, /router\.canGoBack\(\)/);
});

test('CP09 has known static detail paths and only the approved location filter', () => {
  assert.match(detailRoute, /generateStaticParams/);
  assert.match(detailRoute, /ALERT_PROTOTYPE_IDS/);
  assert.match(listSource, /alerts-search-input/);
  assert.match(listSource, /alertLocationFilters/);
  assert.doesNotMatch(listSource, /alertCategoryFilters|alerts-category|setCategory|onCategoryChange/);
  assert.match(listSource, /filterCommunityAlerts\(allAlerts, \{ location, search \}\)/);
  assert.match(listSource, /'aria-pressed': selected/);
});

test('community alerts keeps the exact Screen 12 mascot pixels inside the editorial panel', () => {
  const mascot = readFileSync(new URL('../../../assets/mascots/alerts-guide-screen12.png', import.meta.url));
  assert.equal(
    createHash('sha256').update(mascot).digest('hex'),
    '0b5d98c2160ae6540f21160366bf221822a3fc70f3ccf730725defa390a79413',
  );
  assert.match(listSource, /alerts-guide-screen12\.png/);
  assert.match(listSource, /accessible=\{false\}/);
  assert.match(listSource, /resizeMode="contain"/);
  assert.match(listSource, /testID="alerts-patterns-panel"/);
  assert.match(listSource, /editorialMascotFrame: \{ width: 112, height: 84/);
  assert.doesNotMatch(listSource, /searchRow|mascotFrame: \{ width: 74/);
});

test('CP09 uses intrinsic content, horizontal clipping contracts and no visible text below 11px', () => {
  assert.doesNotMatch(`${listSource}\n${detailSource}`, /numberOfLines|ellipsizeMode/);
  const fontSizes = [...`${listSource}\n${detailSource}`.matchAll(/fontSize:\s*(\d+)/g)]
    .map((match) => Number(match[1]));
  assert.ok(fontSizes.length > 0);
  assert.ok(fontSizes.every((size) => size >= 11));
  assert.match(listSource, /contentFrame: \{ minWidth: 0, width: '100%', maxWidth: 720/);
  assert.match(listSource, /searchField: \{ minWidth: 0, width: '100%', minHeight: 48/);
  assert.match(listSource, /filterChip: \{ minHeight: 48/);
  assert.match(detailSource, /contentFrame: \{ minWidth: 0, width: '100%', maxWidth: 720/);
});
