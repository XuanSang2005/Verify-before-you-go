import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { after, test } from 'node:test';

import userEvent from '@testing-library/user-event';
import { JSDOM } from 'jsdom';
import React, { type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

type CommonJsLoader = (
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
) => unknown;

type ExpoRouterLink = ComponentType<{
  asChild?: boolean;
  children: ReactNode;
  href: string;
}>;

const nodeRequire = createRequire(import.meta.url);
const moduleLoader = Module as unknown as { _load: CommonJsLoader };
const originalLoad = moduleLoader._load;
const originalExpoOs = process.env.EXPO_OS;
let actualBaseLink: ExpoRouterLink | undefined;

(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
process.env.EXPO_OS = 'web';

moduleLoader._load = function loadForWebSsr(request, parent, isMain) {
  if (request.endsWith('.png')) {
    return { uri: 'data:image/png;base64,iVBORw0KGgo=' };
  }
  if (request === 'react-native') return nodeRequire('react-native-web');
  if (request === 'react-native-safe-area-context') {
    return {
      SafeAreaProvider: ({ children }: { children?: ReactNode }) => children ?? null,
      SafeAreaView: ({ children }: { children?: ReactNode }) => children ?? null,
      useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
    };
  }
  if (request === '@expo/vector-icons') return { Ionicons: () => null };
  if (request === 'expo-status-bar') return { StatusBar: () => null };
  if (request === 'expo') return { requireOptionalNativeModule: () => null };
  if (request === 'expo/dom') return {};
  if (request === 'expo-constants') {
    return { __esModule: true, default: { expoConfig: {}, manifest2: null } };
  }
  if (request === 'expo-linking') {
    return {
      addEventListener: () => ({ remove: () => undefined }),
      createURL: (path: string) => path,
      getInitialURL: async () => null,
      parse: () => ({}),
    };
  }
  if (request === 'expo-modules-core') return { Platform: { OS: 'web' } };
  if (request === 'expo-router') {
    actualBaseLink ??= (nodeRequire('expo-router/build/link/BaseExpoRouterLink') as {
      BaseExpoRouterLink: ExpoRouterLink;
    }).BaseExpoRouterLink;
    return {
      Link: actualBaseLink,
      useLocalSearchParams: () => ({}),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

after(() => {
  moduleLoader._load = originalLoad;
  if (originalExpoOs === undefined) delete process.env.EXPO_OS;
  else process.env.EXPO_OS = originalExpoOs;
});

const recipientModule = import('./ShareRecipientScreen');
const shareModelModule = import('./share-model');

async function getReadyExperience() {
  const [{ ShareRecipientExperience }, { toVerifiedSafeShareSummary }] = await Promise.all([
    recipientModule,
    shareModelModule,
  ]);
  const summary = toVerifiedSafeShareSummary({
    schemaVersion: 1,
    findingIds: ['urgency-pressure'],
    checkedRuleCount: 9,
    demo: false,
    issuedAt: '2026-08-12T00:00:00.000Z',
    expiresAt: '2026-08-19T00:00:00.000Z',
  });
  return React.createElement(ShareRecipientExperience, { summary });
}

test('recipient SSR uses Expo Router Slot with real anchors and flattened styles', async () => {
  const { ShareRecipientController } = await recipientModule;
  const unavailableHtml = renderToStaticMarkup(
    React.createElement(ShareRecipientController, { params: {} }),
  );
  const readyHtml = renderToStaticMarkup(await getReadyExperience());

  assert.match(unavailableHtml, /<h[1-6][^>]*>This shared summary is unavailable\.<\/h[1-6]>/);
  assert.match(unavailableHtml, /<a[^>]*href="\/check"/);
  assert.match(readyHtml, /<a[^>]*href="\/check\/checklist"/);
  assert.match(readyHtml, /<a[^>]*href="\/help"/);

  for (const html of [unavailableHtml, readyHtml]) {
    assert.doesNotMatch(html, /Switched to client rendering/);
    assert.doesNotMatch(html, /passing an array of styles/);
    assert.doesNotMatch(html, /0:\[object Object\]|\[object Object\]/);
  }
});

test('recipient anchors activate from Enter and keep the expected destinations', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://example.test/share/recipient',
  });
  const browserGlobals = {
    document: dom.window.document,
    navigator: dom.window.navigator,
    window: dom.window,
  };
  const previousDescriptors = new Map(
    Object.keys(browserGlobals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(browserGlobals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true });
  }
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;

  const container = dom.window.document.querySelector<HTMLDivElement>('#root');
  assert.ok(container);
  const root = createRoot(container);
  try {
    const readyExperience = await getReadyExperience();
    React.act(() => root.render(readyExperience));
    const keyboard = userEvent.setup({ document: dom.window.document });

    for (const destination of ['/check/checklist', '/help']) {
      const anchor: HTMLAnchorElement | null = container.querySelector(`a[href="${destination}"]`);
      assert.ok(anchor);
      let activated = false;
      anchor.addEventListener('click', (event: MouseEvent) => {
        activated = true;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true, once: true });
      await React.act(async () => {
        anchor.focus();
        await keyboard.keyboard('{Enter}');
      });
      assert.equal(activated, true);
    }
  } finally {
    React.act(() => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previousDescriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  }
});
