import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { describe, expect, it, vi } from 'vitest';

import type { NewsDetailResponse } from '@vbyg/contracts';

import { FloatingTabBar } from '../../../app/(tabs)/_layout';
import NewsDetailRoute from '../../../app/(tabs)/news/[slug]';

const mockedDetail = vi.hoisted(() => ({
  story: {
    slug: 'direct-refresh-story',
    category: 'guide',
    title: 'Direct refresh synthetic story.',
    dek: 'A rendered direct-route regression fixture.',
    eyebrow: 'Guide · Demo',
    bodySections: ['The detail route rendered without first visiting the newsroom list.'],
    verificationSteps: ['Verify the source independently.'],
    sourceNotes: ['Synthetic prototype content.'],
    sourceStatus: 'synthetic-prototype',
    sourceStatusLabel: 'Synthetic pattern only',
    syntheticLabel: 'Synthetic prototype',
    readingMinutes: 3,
    isFeatured: false,
    publishedAt: '2026-08-03T02:00:00.000Z',
    reviewedAt: '2026-08-08T02:00:00.000Z',
  },
})) as NewsDetailResponse;

vi.mock('expo-router', () => {
  function MockTabs({ children }: { children?: ReactNode }) {
    return children ?? null;
  }
  function MockTabsScreen() {
    return null;
  }
  const Tabs = Object.assign(MockTabs, { Screen: MockTabsScreen });
  function MockStack({ children }: { children?: ReactNode }) {
    return children ?? null;
  }
  function MockStackScreen() {
    return null;
  }
  const Stack = Object.assign(MockStack, { Screen: MockStackScreen });
  return {
    Stack,
    Tabs,
    router: {
      back: vi.fn(),
      canGoBack: () => false,
      push: vi.fn(),
      replace: vi.fn(),
    },
    useLocalSearchParams: () => ({ slug: 'direct-refresh-story' }),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: function MockSafeAreaProvider({ children }: { children?: ReactNode }) { return children ?? null; },
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('./use-news', async () => {
  const actual = await vi.importActual<typeof import('./use-news')>('./use-news');
  return {
    ...actual,
    useNewsStory: () => ({
      response: mockedDetail,
      retry: vi.fn(),
      status: 'ready' as const,
    }),
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

async function renderAtWidth(node: ReactNode, width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <SafeAreaProvider initialMetrics={{
        ...initialMetrics,
        frame: { ...initialMetrics.frame, width },
      }}>
        {node}
      </SafeAreaProvider>,
    );
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return { container, root };
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

function createTabBarProps() {
  const routes = [
    { key: 'home-key', name: 'index', params: undefined },
    { key: 'check-key', name: 'check', params: undefined },
    { key: 'news-key', name: 'news', params: undefined },
    { key: 'quiz-key', name: 'quiz', params: undefined },
    { key: 'help-key', name: 'help', params: undefined },
    { key: 'detail-key', name: 'news/[slug]', params: { slug: 'direct-refresh-story' } },
  ];
  const descriptors = Object.fromEntries(routes.map((route) => [route.key, {
    options: { tabBarAccessibilityLabel: route.name === 'index' ? 'Home' : `${route.name[0]?.toUpperCase()}${route.name.slice(1)}` },
  }]));

  return {
    descriptors,
    navigation: {
      emit: vi.fn(() => ({ defaultPrevented: false })),
      navigate: vi.fn(),
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

describe.each([360, 390])('CP07 rendered nested News navigation at %ipx', (width) => {
  it('renders exactly five 48px primary tabs and keeps News selected on detail', async () => {
    const props = createTabBarProps() as unknown as Parameters<typeof FloatingTabBar>[0];
    const harness = await renderAtWidth(
      <FloatingTabBar {...props} />,
      width,
    );
    const tabs = [...harness.container.querySelectorAll<HTMLElement>('[role="tab"]')];

    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Home', 'Check', 'News', 'Quiz', 'Help',
    ]);
    expect(harness.container.querySelector('[data-testid="floating-tab-news"]')?.getAttribute('aria-selected')).toBe('true');
    expect(harness.container.querySelector('[data-testid="floating-tab-news/[slug]"]')).toBeNull();
    for (const tab of tabs) {
      expect(Number.parseFloat(window.getComputedStyle(tab).minHeight)).toBeGreaterThanOrEqual(48);
    }

    await cleanup(harness.container, harness.root);
  });

  it('renders the article detail route directly without list navigation', async () => {
    const harness = await renderAtWidth(<NewsDetailRoute />, width);
    const heading = harness.container.querySelector<HTMLElement>('[role="heading"]');
    expect(heading?.textContent).toBe('Direct refresh synthetic story.');
    expect(harness.container.textContent).toContain('The detail route rendered without first visiting the newsroom list.');
    expect(harness.container.textContent).toContain('Synthetic pattern only');
    expect(harness.container.textContent).toContain('Published');
    expect(harness.container.textContent).toContain('Reviewed');
    await cleanup(harness.container, harness.root);
  });
});
