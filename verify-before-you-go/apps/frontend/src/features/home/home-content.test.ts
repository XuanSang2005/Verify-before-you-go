import assert from 'node:assert/strict';
import test from 'node:test';

import { homeActionCards, homeFeatures, homeUtilityLinks, primaryHomeAction, tabRoutes } from './home-content';

test('keeps the canonical five-tab order', () => {
  assert.deepEqual(tabRoutes.map((tab) => tab.name), ['Home', 'Check', 'News', 'Quiz', 'Help']);
  assert.deepEqual(tabRoutes.map((tab) => tab.href), ['/', '/check', '/news', '/quiz', '/help']);
});

test('makes every required Homepage workflow reachable', () => {
  const routes = new Set<string>([
    primaryHomeAction.href,
    ...homeActionCards.map((item) => item.href),
    ...homeFeatures.map((item) => item.href),
    ...homeUtilityLinks.map((item) => item.href),
  ]);

  for (const route of ['/check', '/news', '/quiz', '/alerts', '/reports/new', '/reports', '/help', '/how-it-works']) {
    assert.ok(routes.has(route), `Missing Homepage entry point for ${route}`);
  }
  assert.equal(routes.has('/onboarding'), false);
});

test('labels the pre-backend Homepage editorial content as synthetic demo content', () => {
  assert.ok(homeFeatures.every((feature) => feature.metadata.toLowerCase().includes('synthetic demo')));
});
