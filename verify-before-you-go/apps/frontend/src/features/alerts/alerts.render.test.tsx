import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FloatingTabBar } from '../../../app/(tabs)/_layout';
import AlertDetailRoute from '../../../app/(tabs)/alerts/[id]';
import { AlertDetailScreen } from './AlertDetailScreen';
import { CommunityAlertsScreen } from './CommunityAlertsScreen';

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn(() => false),
  push: vi.fn(),
  replace: vi.fn(),
}));

const hookFixtures = vi.hoisted(() => ({
  detailMode: 'ready' as 'ready' | 'loading' | 'error' | 'not-found',
  listMode: 'ready' as 'ready' | 'api-empty' | 'offline' | 'error',
  detail: {
    response: {
      alert: {
        id: 'A-018',
        title: 'Telegram recruitment pattern',
        location: 'cambodia',
        locationLabel: 'Sihanoukville, Cambodia',
        category: 'off-platform-contact',
        categoryLabel: 'Off-platform contact',
        moderationStatus: 'corroborated-pattern',
        moderationStatusLabel: 'Corroborated pattern',
        summary: 'Four compatible reports mention a passport request before written terms.',
        compatibleReportCount: 4,
        maskedIdentifiers: ['@••••••2026'],
        syntheticLabel: 'Synthetic demo data',
        firstReportedAt: '2026-07-21T02:00:00.000Z',
        reviewedAt: '2026-07-30T02:00:00.000Z',
        observedEvidence: ['A passport copy was requested before a signed contract.'],
        unknownInformation: ['Who controls the masked handle.'],
        verificationSteps: [
          'Ask for the legal company name.',
          'Use an independently found contact.',
          'Delay sharing identity documents.',
        ],
        sourceNotes: ['Synthetic prototype data with masked identifiers.'],
        safetyStatement: 'This reviewed record is not a verdict and does not establish fraud.',
      },
    },
    retry: vi.fn(),
    status: 'ready' as const,
  },
  list: {
    response: {
      alerts: [{
        id: 'A-018',
        title: 'Telegram recruitment pattern',
        location: 'cambodia',
        locationLabel: 'Sihanoukville, Cambodia',
        category: 'off-platform-contact',
        categoryLabel: 'Off-platform contact',
        moderationStatus: 'corroborated-pattern',
        moderationStatusLabel: 'Corroborated pattern',
        summary: 'Four compatible reports mention a passport request before written terms.',
        compatibleReportCount: 4,
        maskedIdentifiers: ['@••••••2026'],
        syntheticLabel: 'Synthetic demo data',
        firstReportedAt: '2026-07-21T02:00:00.000Z',
        reviewedAt: '2026-07-30T02:00:00.000Z',
      }],
      fetchedAt: '2026-08-10T02:00:00.000Z',
      syntheticContentNotice: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
    },
    retry: vi.fn(),
    status: 'ready' as const,
  },
}));

vi.mock('expo-router', () => {
  function MockTabs({ children }: { children?: ReactNode }) { return children ?? null; }
  function MockTabsScreen() { return null; }
  const Tabs = Object.assign(MockTabs, { Screen: MockTabsScreen });
  function MockStack({ children }: { children?: ReactNode }) { return children ?? null; }
  function MockStackScreen() { return null; }
  const Stack = Object.assign(MockStack, { Screen: MockStackScreen });
  return {
    Stack,
    Tabs,
    router: routerMocks,
    useLocalSearchParams: () => ({ id: 'A-018' }),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('./use-alerts', () => ({
  useCommunityAlert: () => {
    if (hookFixtures.detailMode === 'loading') {
      return { retry: hookFixtures.detail.retry, status: 'loading' as const };
    }
    if (hookFixtures.detailMode === 'error') {
      return { message: 'Alert service failed.', retry: hookFixtures.detail.retry, status: 'error' as const };
    }
    if (hookFixtures.detailMode === 'not-found') {
      return { message: 'The reviewed alert was not found.', retry: hookFixtures.detail.retry, status: 'not-found' as const };
    }
    return hookFixtures.detail;
  },
  useCommunityAlerts: () => {
    if (hookFixtures.listMode === 'api-empty') {
      return { ...hookFixtures.list, response: { ...hookFixtures.list.response, alerts: [] }, status: 'empty' as const };
    }
    if (hookFixtures.listMode === 'offline') {
      return {
        ...hookFixtures.list,
        cachedAt: '2026-08-10T03:00:00.000Z',
        message: 'Offline · showing saved alerts',
        status: 'offline' as const,
      };
    }
    if (hookFixtures.listMode === 'error') {
      return { message: 'Alerts could not be reached.', retry: hookFixtures.list.retry, status: 'error' as const };
    }
    return hookFixtures.list;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderAtWidth(node: ReactNode, width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return { container, root };
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

async function setTextInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) throw new Error('HTML input value setter is unavailable');
  await act(async () => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function createAlertsTabBarProps() {
  const routes = [
    { key: 'home-key', name: 'index', params: undefined },
    { key: 'check-key', name: 'check', params: undefined },
    { key: 'news-key', name: 'news', params: undefined },
    { key: 'quiz-key', name: 'quiz', params: undefined },
    { key: 'help-key', name: 'help', params: undefined },
    { key: 'alerts-key', name: 'alerts', params: undefined },
    { key: 'alert-detail-key', name: 'alerts/[id]', params: { id: 'A-018' } },
  ];
  return {
    descriptors: Object.fromEntries(routes.map((route) => [route.key, {
      options: {
        tabBarAccessibilityLabel: route.name === 'index'
          ? 'Home'
          : `${route.name[0]?.toUpperCase()}${route.name.slice(1)}`,
      },
    }])),
    navigation: { emit: vi.fn(() => ({ defaultPrevented: false })), navigate: vi.fn() },
    state: {
      history: [],
      index: 6,
      key: 'tabs-key',
      routeNames: routes.map((route) => route.name),
      routes,
      stale: false,
      type: 'tab',
    },
  };
}

beforeEach(() => {
  hookFixtures.detailMode = 'ready';
  hookFixtures.listMode = 'ready';
  routerMocks.push.mockClear();
  routerMocks.replace.mockClear();
});

describe.each([360, 390, 768, 1024])('CP09 rendered community alerts at %ipx', (width) => {
  it('renders the compact Screen 12 hierarchy with full-width search and location-only filters', async () => {
    const harness = await renderAtWidth(<CommunityAlertsScreen />, width);
    expect(harness.container.querySelector('[role="heading"]')?.textContent).toBe('Check an alert.');
    expect(harness.container.textContent).not.toContain('Verify Before You Go');
    expect(harness.container.textContent).toContain('No match does not mean an offer is safe.');
    expect(harness.container.querySelector('[aria-label^="Search reviewed alerts"]')).not.toBeNull();
    expect(harness.container.textContent).not.toContain('All patterns');
    expect(harness.container.textContent).not.toContain('Documents');
    expect(harness.container.textContent).not.toContain('Contact channel');
    expect(harness.container.textContent).not.toContain('Licence');
    expect(harness.container.textContent).not.toContain('Payment');
    expect(harness.container.querySelector('[data-testid^="alerts-category-"]')).toBeNull();

    const searchControl = harness.container.querySelector<HTMLElement>('[data-testid="alerts-search-control"]');
    const mascot = harness.container.querySelector<HTMLElement>('[data-testid="alerts-guide-mascot"]');
    const editorialPanel = harness.container.querySelector<HTMLElement>('[data-testid="alerts-patterns-panel"]');
    if (!searchControl || !mascot || !editorialPanel) throw new Error('Search or editorial mascot composition was not rendered');
    expect(searchControl.contains(mascot)).toBe(false);
    expect(editorialPanel.contains(mascot)).toBe(true);
    expect(window.getComputedStyle(searchControl).width).toBe('100%');

    const allPlaces = harness.container.querySelector<HTMLElement>('[data-testid="alerts-location-all"]');
    const vietnam = harness.container.querySelector<HTMLElement>('[data-testid="alerts-location-vietnam"]');
    if (!allPlaces || !vietnam) throw new Error('Location filters were not rendered');
    expect(allPlaces.getAttribute('role')).toBe('button');
    expect(allPlaces.getAttribute('aria-pressed')).toBe('true');
    expect(vietnam.getAttribute('aria-pressed')).toBe('false');
    expect(Number.parseFloat(window.getComputedStyle(vietnam).minHeight)).toBeGreaterThanOrEqual(48);

    await act(async () => vietnam.focus());
    await act(async () => {
      vietnam.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
    });
    expect(vietnam.getAttribute('aria-pressed')).toBe('true');
    expect(harness.container.textContent).toContain('No matching reviewed record');
    await cleanup(harness.container, harness.root);
  });

  it('filters by search and location, then Clear filters resets both controls', async () => {
    const harness = await renderAtWidth(<CommunityAlertsScreen />, width);
    const search = harness.container.querySelector<HTMLInputElement>('[data-testid="alerts-search-input"]');
    const allPlaces = harness.container.querySelector<HTMLElement>('[data-testid="alerts-location-all"]');
    const vietnam = harness.container.querySelector<HTMLElement>('[data-testid="alerts-location-vietnam"]');
    if (!search || !allPlaces || !vietnam) throw new Error('Search and location controls were not rendered');

    await setTextInput(search, 'Telegram');
    expect(harness.container.querySelector('[data-testid="alert-card-A-018"]')).not.toBeNull();
    const clearSearch = harness.container.querySelector<HTMLElement>('[data-testid="alerts-search-clear"]');
    if (!clearSearch) throw new Error('Clear search control was not rendered');
    expect(Number.parseFloat(window.getComputedStyle(clearSearch).width)).toBeGreaterThanOrEqual(48);

    await act(async () => vietnam.click());
    expect(harness.container.textContent).toContain('No matching reviewed record');
    const clearFilters = harness.container.querySelector<HTMLElement>('[aria-label="Clear filters"]');
    if (!clearFilters) throw new Error('Clear filters control was not rendered');
    expect(Number.parseFloat(window.getComputedStyle(clearFilters).minHeight)).toBeGreaterThanOrEqual(48);
    await act(async () => clearFilters.click());

    expect(search.value).toBe('');
    expect(allPlaces.getAttribute('aria-pressed')).toBe('true');
    expect(vietnam.getAttribute('aria-pressed')).toBe('false');
    expect(harness.container.querySelector('[data-testid="alert-card-A-018"]')).not.toBeNull();
    await cleanup(harness.container, harness.root);
  });

  it('opens a masked result card through the canonical detail route', async () => {
    const harness = await renderAtWidth(<CommunityAlertsScreen />, width);
    const card = harness.container.querySelector<HTMLElement>('[data-testid="alert-card-A-018"]');
    if (!card) throw new Error('Alert result card was not rendered');
    expect(card.getAttribute('aria-label')).toContain('Synthetic demo');
    expect(card.getAttribute('aria-label')).toContain('compatible reports');
    expect(card.getAttribute('aria-label')).not.toContain('@synthetic-recruiter');
    expect(Number.parseFloat(window.getComputedStyle(card).minHeight)).toBeGreaterThanOrEqual(48);

    await act(async () => card.click());
    expect(routerMocks.push).toHaveBeenCalledWith({ pathname: '/alerts/[id]', params: { id: 'A-018' } });
    await cleanup(harness.container, harness.root);
  });
});

describe('CP09 rendered alert detail', () => {
  it.each([
    ['loading', 'Loading alert'],
    ['error', 'Alert unavailable'],
    ['not-found', 'Not found'],
  ] as const)('gives the %s state an accessible heading and independent-verification warning', async (mode, heading) => {
    hookFixtures.detailMode = mode;
    const harness = await renderAtWidth(<AlertDetailScreen />, 390);
    expect(harness.container.querySelector('[role="heading"]')?.textContent).toBe(heading);
    expect(harness.container.textContent).toContain(
      'No matching alert does not mean an offer is safe. Verify the offer independently.',
    );
    await cleanup(harness.container, harness.root);
  });

  it('directly renders observed evidence, unknowns, guidance and masked review metadata', async () => {
    const harness = await renderAtWidth(<AlertDetailScreen />, 390);
    expect(harness.container.querySelector('[role="heading"]')?.textContent).toBe('Telegram recruitment pattern.');
    expect(harness.container.textContent).toContain('What was observed');
    expect(harness.container.textContent).toContain('What remains unconfirmed');
    expect(harness.container.textContent).toContain('Verify your own offer');
    expect(harness.container.textContent).toContain('@••••••2026');
    expect(harness.container.textContent).toContain('This is not a finding of fraud.');
    expect(harness.container.textContent).not.toContain('@synthetic-recruiter');
    await cleanup(harness.container, harness.root);
  });

  it('uses back/replace safely and sends the primary CTA to the Offer Checker', async () => {
    routerMocks.push.mockClear();
    routerMocks.replace.mockClear();
    const harness = await renderAtWidth(<AlertDetailScreen />, 390);
    const back = harness.container.querySelector<HTMLElement>('[aria-label="Back to community alerts"]');
    const check = harness.container.querySelector<HTMLElement>('[data-testid="alert-detail-check-offer"]');
    if (!back || !check) throw new Error('Alert detail actions were not rendered');
    await act(async () => back.click());
    expect(routerMocks.replace).toHaveBeenCalledWith('/alerts');
    await act(async () => check.click());
    expect(routerMocks.push).toHaveBeenCalledWith('/check');
    await cleanup(harness.container, harness.root);
  });
});

describe('CP09 revised list states and shared navigation', () => {
  it('distinguishes API-empty from filtered-empty and never offers an ineffective clear action', async () => {
    hookFixtures.listMode = 'api-empty';
    const harness = await renderAtWidth(<CommunityAlertsScreen />, 390);
    expect(harness.container.textContent).toContain('No reviewed alerts available');
    expect(harness.container.textContent).not.toContain('Clear filters');
    expect(harness.container.textContent).toContain('No match does not mean an offer is safe.');
    await cleanup(harness.container, harness.root);
    hookFixtures.listMode = 'ready';
  });

  it.each(['offline', 'error'] as const)('keeps the safety statement visible in the %s state', async (mode) => {
    hookFixtures.listMode = mode;
    const harness = await renderAtWidth(<CommunityAlertsScreen />, 390);
    expect(harness.container.textContent).toContain('No match does not mean an offer is safe.');
    await cleanup(harness.container, harness.root);
    hookFixtures.listMode = 'ready';
  });

  it.each([360, 390])('renders exactly five shared 48px tabs for Alerts at %ipx', async (width) => {
    const props = createAlertsTabBarProps() as unknown as Parameters<typeof FloatingTabBar>[0];
    const harness = await renderAtWidth(<FloatingTabBar {...props} />, width);
    const tabs = [...harness.container.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual(['Home', 'Check', 'News', 'Quiz', 'Help']);
    expect(harness.container.querySelector('[data-testid="floating-tab-alerts"]')).toBeNull();
    for (const tab of tabs) {
      expect(Number.parseFloat(window.getComputedStyle(tab).minHeight)).toBeGreaterThanOrEqual(48);
    }
    await cleanup(harness.container, harness.root);
  });

  it('renders the alert detail route directly inside the shared tab route tree', async () => {
    const harness = await renderAtWidth(<AlertDetailRoute />, 390);
    expect(harness.container.querySelector('[role="heading"]')?.textContent).toBe('Telegram recruitment pattern.');
    expect(harness.container.textContent).toContain('What remains unconfirmed');
    await cleanup(harness.container, harness.root);
  });
});
