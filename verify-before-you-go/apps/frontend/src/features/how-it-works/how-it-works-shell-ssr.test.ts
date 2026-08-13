import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { after, test } from 'node:test';

import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

type CommonJsLoader = (
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
) => unknown;

const nodeRequire = createRequire(import.meta.url);
const moduleLoader = Module as unknown as { _load: CommonJsLoader };
const originalLoad = moduleLoader._load;
const originalExpoOs = process.env.EXPO_OS;

(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
process.env.EXPO_OS = 'web';

moduleLoader._load = function loadForHowItWorksSsr(request, parent, isMain) {
  if (request === 'react-native') return nodeRequire('react-native-web');
  if (request === 'react-native-safe-area-context') {
    return {
      useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
    };
  }
  if (request === '@expo/vector-icons') return { Ionicons: () => null };
  if (request === 'expo-router') {
    function MockTabs({ children }: { children?: ReactNode }) {
      return children ?? null;
    }
    MockTabs.Screen = function MockTabsScreen() { return null; };
    return { Tabs: MockTabs };
  }
  return originalLoad.call(this, request, parent, isMain);
};

after(() => {
  moduleLoader._load = originalLoad;
  if (originalExpoOs === undefined) delete process.env.EXPO_OS;
  else process.env.EXPO_OS = originalExpoOs;
});

function createTabBarProps(parentRoute: 'how-it-works' | 'rewards' = 'how-it-works') {
  const routes = [
    { key: 'home-key', name: 'index', params: undefined },
    { key: 'check-key', name: 'check', params: undefined },
    { key: 'news-key', name: 'news', params: undefined },
    { key: 'quiz-key', name: 'quiz', params: undefined },
    { key: 'help-key', name: 'help', params: undefined },
    { key: 'parent-key', name: parentRoute, params: undefined },
  ];
  return {
    descriptors: Object.fromEntries(routes.map((route) => [route.key, {
      options: {
        tabBarAccessibilityLabel: route.name === 'index'
          ? 'Home'
          : `${route.name[0]?.toUpperCase()}${route.name.slice(1)}`,
      },
    }])),
    navigation: {
      emit: () => ({ defaultPrevented: false }),
      navigate: () => undefined,
    },
    state: {
      history: [],
      index: 5,
      key: 'tabs-key',
      routeNames: routes.map((route) => route.name),
      routes,
      stale: false,
      type: 'tab',
    },
  };
}

test('How It Works SSR shell exposes five tabs, one selected Home parent and a genuine Home href', async () => {
  const { FloatingTabBar } = await import('../../../app/(tabs)/_layout');
  const html = renderToStaticMarkup(React.createElement(
    FloatingTabBar,
    createTabBarProps() as unknown as Parameters<typeof FloatingTabBar>[0],
  ));

  assert.equal((html.match(/role="tab"/gu) ?? []).length, 5);
  assert.equal((html.match(/aria-selected="true"/gu) ?? []).length, 1);
  const homeTag = html.match(/<a[^>]*data-testid="floating-tab-index"[^>]*>/u)?.[0];
  assert.ok(homeTag);
  assert.match(homeTag, /href="\/"/u);
  assert.match(homeTag, /aria-selected="true"/u);
  assert.match(homeTag, /aria-label="Home"/u);
  assert.doesNotMatch(html, /floating-tab-how-it-works/u);
});

test('Rewards SSR shell exposes five tabs, one selected Home parent and no sixth Rewards tab', async () => {
  const { FloatingTabBar } = await import('../../../app/(tabs)/_layout');
  const html = renderToStaticMarkup(React.createElement(
    FloatingTabBar,
    createTabBarProps('rewards') as unknown as Parameters<typeof FloatingTabBar>[0],
  ));

  assert.equal((html.match(/role="tab"/gu) ?? []).length, 5);
  assert.equal((html.match(/aria-selected="true"/gu) ?? []).length, 1);
  const homeTag = html.match(/<a[^>]*data-testid="floating-tab-index"[^>]*>/u)?.[0];
  assert.ok(homeTag);
  assert.match(homeTag, /href="\/"/u);
  assert.match(homeTag, /aria-selected="true"/u);
  assert.doesNotMatch(html, /floating-tab-rewards/u);
});
