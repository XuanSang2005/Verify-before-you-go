import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { AlertDetailResponse } from '@vbyg/contracts';

import {
  createAlertDetailCacheCoordinator,
  createAlertListCacheCoordinator,
} from './alerts-cache';
import { AlertDetailScreen } from './AlertDetailScreen';
import { alertDetailFixture } from './alerts-test-fixtures';
import { useCommunityAlerts, type AlertsLoaderDependencies } from './use-alerts';

vi.mock('expo-router', () => ({
  router: {
    back: vi.fn(),
    canGoBack: vi.fn(() => false),
    push: vi.fn(),
    replace: vi.fn(),
  },
  useLocalSearchParams: () => ({ id: 'A-018' }),
}));

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

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
}

function createDependencies(
  fetchDetail: AlertsLoaderDependencies['fetchDetail'],
): AlertsLoaderDependencies {
  return {
    detailCacheCoordinator: createAlertDetailCacheCoordinator(),
    listCacheCoordinator: createAlertListCacheCoordinator(),
    deleteDetailCache: async () => undefined,
    deleteDetailTombstone: async () => undefined,
    fetchDetail,
    fetchList: async () => ({
      alerts: [],
      fetchedAt: '2026-08-11T00:00:00.000Z',
      syntheticContentNotice: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
    }),
    loadDetailCache: async () => null,
    loadDetailTombstone: async () => null,
    loadListCache: async () => null,
    saveDetailCache: async () => undefined,
    saveDetailTombstone: async () => undefined,
    saveListCache: async () => undefined,
  };
}

const secondAlert: AlertDetailResponse = {
  alert: {
    ...alertDetailFixture.alert,
    id: 'A-024',
    title: 'Agency licence belongs to another entity',
    maskedIdentifiers: ['LIC-•••-184'],
  },
};

async function flush() {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('CP09 detail route request authority', () => {
  it('clears the previous alert immediately when the route ID changes', async () => {
    const secondRequest = deferred<typeof secondAlert>();
    const dependencies = createDependencies(async (id) => (
      id === 'A-018' ? alertDetailFixture : secondRequest.promise
    ));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AlertDetailScreen alertId="A-018" loaderDependencies={dependencies} />);
      await flush();
    });
    expect(container.textContent).toContain('Telegram recruitment pattern.');

    await act(async () => {
      root.render(<AlertDetailScreen alertId="A-024" loaderDependencies={dependencies} />);
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('Telegram recruitment pattern.');
    expect(container.querySelector('[role="heading"]')?.textContent).toBe('Loading alert');
    expect(container.textContent).toContain(
      'No matching alert does not mean an offer is safe. Verify the offer independently.',
    );

    await act(async () => {
      secondRequest.resolve(secondAlert);
      await flush();
    });
    expect(container.textContent).toContain('Agency licence belongs to another entity.');
    await act(async () => root.unmount());
    container.remove();
  });

  it('ignores a late response for the previous route ID', async () => {
    const firstRequest = deferred<typeof alertDetailFixture>();
    const secondRequest = deferred<typeof secondAlert>();
    const dependencies = createDependencies(async (id) => (
      id === 'A-018' ? firstRequest.promise : secondRequest.promise
    ));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AlertDetailScreen alertId="A-018" loaderDependencies={dependencies} />);
      await Promise.resolve();
    });
    await act(async () => {
      root.render(<AlertDetailScreen alertId="A-024" loaderDependencies={dependencies} />);
      await Promise.resolve();
    });
    await act(async () => {
      firstRequest.resolve(alertDetailFixture);
      await flush();
    });

    expect(container.textContent).not.toContain('Telegram recruitment pattern.');
    expect(container.querySelector('[role="heading"]')?.textContent).toBe('Loading alert');

    await act(async () => {
      secondRequest.resolve(secondAlert);
      await flush();
    });
    expect(container.textContent).toContain('Agency licence belongs to another entity.');
    await act(async () => root.unmount());
    container.remove();
  });

  it('supersedes an unmounted list request before it can mutate cache', async () => {
    const listRequest = deferred<Awaited<ReturnType<AlertsLoaderDependencies['fetchList']>>>();
    let saveCount = 0;
    const dependencies = createDependencies(async () => alertDetailFixture);
    dependencies.fetchList = async () => listRequest.promise;
    dependencies.saveListCache = async () => { saveCount += 1; };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    function ListProbe() {
      const state = useCommunityAlerts(dependencies);
      return <div data-testid="list-state">{state.status}</div>;
    }

    await act(async () => {
      root.render(<ListProbe />);
      await Promise.resolve();
    });
    await act(async () => root.unmount());
    listRequest.resolve({
      alerts: [],
      fetchedAt: '2026-08-11T00:00:00.000Z',
      syntheticContentNotice: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
    });
    await flush();

    expect(saveCount).toBe(0);
    container.remove();
  });
});
