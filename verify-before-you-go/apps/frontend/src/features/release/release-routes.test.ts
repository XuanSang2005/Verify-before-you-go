import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { homeActionCards, homeUtilityLinks, primaryHomeAction, tabRoutes } from '../home/home-content';

const frontendRoot = new URL('../../../', import.meta.url);

const applicationScreens = [
  ['Homepage', 'app/(tabs)/index.tsx'],
  ['Offer Checker', 'app/(tabs)/check/index.tsx'],
  ['Posting Preview', 'app/check/preview.tsx'],
  ['Analysis Overview', 'app/check/result.tsx'],
  ['Finding Detail', 'app/check/finding/[id].tsx'],
  ['Verification Checklist', 'app/(tabs)/check/checklist.tsx'],
  ['MIL Scenario Practice', 'app/learn/scenario.tsx'],
  ['Recruitment Newsroom', 'app/(tabs)/news/index.tsx'],
  ['Interactive MIL Quiz', 'app/(tabs)/quiz.tsx'],
  ['Community Alerts', 'app/(tabs)/alerts/index.tsx'],
  ['Alert Detail', 'app/(tabs)/alerts/[id].tsx'],
  ['Report Details', 'app/(tabs)/reports/new.tsx'],
  ['Privacy Review', 'app/(tabs)/reports/privacy.tsx'],
  ['Report Receipt', 'app/(tabs)/reports/receipt.tsx'],
  ['Share to Protect', 'app/(tabs)/share/preview.tsx'],
  ['Recipient View', 'app/(tabs)/share/recipient.tsx'],
  ['My Reports', 'app/(tabs)/reports/index.tsx'],
  ['Help and Emergency Contacts', 'app/(tabs)/help.tsx'],
  ['How It Works', 'app/(tabs)/how-it-works.tsx'],
  ['Demo Voucher Reward', 'app/(tabs)/rewards/voucher.tsx'],
] as const;

test('the release manifest exposes all 20 implemented application screens without route placeholders', () => {
  assert.equal(applicationScreens.length, 20);

  for (const [name, relativePath] of applicationScreens) {
    const routeUrl = new URL(relativePath, frontendRoot);
    assert.equal(existsSync(routeUrl), true, `${name} route is missing: ${relativePath}`);
    const source = readFileSync(routeUrl, 'utf8');
    assert.doesNotMatch(source, /PlaceholderScreen|UNFINISHED LOCAL PROTOTYPE/u, `${name} is still a placeholder`);
  }
});

test('CP16 preserves subordinate static routes and the canonical launch route', () => {
  for (const relativePath of [
    'app/(tabs)/news/[slug].tsx',
    'app/(tabs)/alerts/[id].tsx',
    'app/check/finding/[id].tsx',
  ]) {
    const source = readFileSync(new URL(relativePath, frontendRoot), 'utf8');
    assert.match(source, /generateStaticParams/u, `${relativePath} must export known static paths`);
  }

  const rootLayout = readFileSync(new URL('app/_layout.tsx', frontendRoot), 'utf8');
  assert.match(rootLayout, /initialRouteName: '\(tabs\)'/u);
  assert.doesNotMatch(rootLayout, /onboarding|onboardingComplete/u);
});

test('CP16 keeps exactly five canonical tabs and every major workflow on the Homepage', () => {
  assert.deepEqual(tabRoutes.map(({ name }) => name), ['Home', 'Check', 'News', 'Quiz', 'Help']);
  assert.deepEqual(tabRoutes.map(({ href }) => href), ['/', '/check', '/news', '/quiz', '/help']);

  const homepageDestinations = new Set<string>([
    primaryHomeAction.href,
    ...homeActionCards.map(({ href }) => href),
    ...homeUtilityLinks.map(({ href }) => href),
  ]);
  for (const route of ['/check', '/news', '/quiz', '/alerts', '/reports/new', '/reports', '/help', '/how-it-works']) {
    assert.equal(homepageDestinations.has(route), true, `Homepage is missing ${route}`);
  }
});
