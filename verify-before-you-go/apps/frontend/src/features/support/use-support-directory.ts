import type { SupportDirectoryResponse } from '@vbyg/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchSupportDirectory,
  isSupportApiError,
} from '@/api/support';

import { bundledSupportDirectory } from './support-bundle';
import {
  loadCachedSupportDirectory,
  commitStagedSupportDirectoryIfAuthoritative,
  stageCachedSupportDirectory,
  type CachedSupportDirectory,
} from './support-cache';
import {
  supportDirectoryCoordinator,
  SupportDirectoryCoordinator,
  type SupportRequestAuthority,
} from './support-coordinator';

export type SupportDirectoryLoadStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline'
  | 'service-unavailable'
  | 'error';

export type SupportDirectoryFallbackKind = 'cache' | 'bundle';

export type SupportDirectoryState = {
  status: SupportDirectoryLoadStatus;
  response?: SupportDirectoryResponse;
  cachedAt?: string;
  bundledAt?: string;
  fallbackKind?: SupportDirectoryFallbackKind;
  fallbackNotice?: string;
  message?: string;
  refreshing?: boolean;
  savedOffline?: boolean;
  storageMessage?: string;
  savingOffline?: boolean;
};

export type SupportDirectoryDependencies = {
  fetchDirectory: typeof fetchSupportDirectory;
  loadCache: typeof loadCachedSupportDirectory;
  stageCache: typeof stageCachedSupportDirectory;
  commitCache: typeof commitStagedSupportDirectoryIfAuthoritative;
  coordinator?: SupportDirectoryCoordinator;
};

const defaultDependencies: SupportDirectoryDependencies = {
  fetchDirectory: fetchSupportDirectory,
  loadCache: loadCachedSupportDirectory,
  stageCache: stageCachedSupportDirectory,
  commitCache: commitStagedSupportDirectoryIfAuthoritative,
  coordinator: supportDirectoryCoordinator,
};

export class SupersededSupportDirectoryAttemptError extends Error {
  constructor() {
    super('The support-directory request was superseded.');
    this.name = 'SupersededSupportDirectoryAttemptError';
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function assertAuthority(
  coordinator: SupportDirectoryCoordinator,
  authority: SupportRequestAuthority,
) {
  if (!coordinator.isRequestAuthoritative(authority)) {
    throw new SupersededSupportDirectoryAttemptError();
  }
}

function selectFallback(cache: CachedSupportDirectory | null) {
  if (cache) {
    const cacheTime = new Date(cache.data.fetchedAt).getTime();
    const bundleTime = new Date(bundledSupportDirectory.response.fetchedAt).getTime();
    if (cacheTime > bundleTime) {
      return {
        kind: 'cache' as const,
        response: cache.data,
        timestamp: cache.cachedAt,
      };
    }
  }
  return {
    kind: 'bundle' as const,
    response: bundledSupportDirectory.response,
    timestamp: bundledSupportDirectory.bundledAt,
  };
}

async function readFallback(
  dependencies: SupportDirectoryDependencies,
  coordinator: SupportDirectoryCoordinator,
  authority: SupportRequestAuthority,
) {
  let cache: CachedSupportDirectory | null = null;
  let cacheReadFailed = false;
  try {
    cache = await coordinator.readAtMutationBoundary(dependencies.loadCache);
  } catch {
    cacheReadFailed = true;
  }
  assertAuthority(coordinator, authority);
  return { ...selectFallback(cache), cacheReadFailed };
}

export async function loadSupportDirectoryState(
  dependencies: SupportDirectoryDependencies = defaultDependencies,
  authority?: SupportRequestAuthority,
): Promise<SupportDirectoryState> {
  const coordinator = dependencies.coordinator ?? supportDirectoryCoordinator;
  const requestAuthority = authority ?? coordinator.beginRequest();

  try {
    const response = await dependencies.fetchDirectory();
    assertAuthority(coordinator, requestAuthority);
    try {
      const saved = await coordinator.saveForRequest(
        requestAuthority,
        response,
        dependencies.stageCache,
        dependencies.commitCache,
      );
      assertAuthority(coordinator, requestAuthority);
      if (!saved) throw new Error('The offline support snapshot was not retained.');
      return {
        status: response.contacts.length ? 'ready' : 'empty',
        response,
        savedOffline: true,
      };
    } catch (error) {
      if (error instanceof SupersededSupportDirectoryAttemptError) throw error;
      assertAuthority(coordinator, requestAuthority);
      return {
        status: response.contacts.length ? 'ready' : 'empty',
        response,
        savedOffline: false,
        storageMessage: 'Contacts loaded, but this device could not update the offline copy.',
      };
    }
  } catch (error) {
    if (error instanceof SupersededSupportDirectoryAttemptError) throw error;
    assertAuthority(coordinator, requestAuthority);

    if (isSupportApiError(error) && error.kind === 'network') {
      const fallback = await readFallback(dependencies, coordinator, requestAuthority);
      return {
        status: 'offline',
        response: fallback.response,
        cachedAt: fallback.kind === 'cache' ? fallback.timestamp : undefined,
        bundledAt: fallback.kind === 'bundle' ? fallback.timestamp : undefined,
        fallbackKind: fallback.kind,
        message: fallback.kind === 'cache'
          ? 'Offline · showing saved contacts'
          : 'Offline · showing bundled contacts',
        savedOffline: fallback.kind === 'cache',
        fallbackNotice: fallback.kind === 'bundle'
          ? bundledSupportDirectory.availabilityNotice
          : fallback.cacheReadFailed
            ? 'Saved contacts are shown, but storage could not be rechecked.'
            : undefined,
      };
    }

    if (isSupportApiError(error) && error.kind === 'http' && (error.status ?? 0) >= 500) {
      const fallback = await readFallback(dependencies, coordinator, requestAuthority);
      return {
        status: 'service-unavailable',
        response: fallback.response,
        cachedAt: fallback.kind === 'cache' ? fallback.timestamp : undefined,
        bundledAt: fallback.kind === 'bundle' ? fallback.timestamp : undefined,
        fallbackKind: fallback.kind,
        message: fallback.kind === 'cache'
          ? 'Service unavailable · showing saved contacts'
          : 'Service unavailable · showing bundled contacts',
        savedOffline: fallback.kind === 'cache',
        fallbackNotice: fallback.kind === 'bundle'
          ? bundledSupportDirectory.availabilityNotice
          : undefined,
      };
    }

    return {
      status: 'error',
      message: errorMessage(error, 'The support directory could not be loaded.'),
    };
  }
}

export function useSupportDirectory(
  dependencies: SupportDirectoryDependencies = defaultDependencies,
) {
  const coordinator = dependencies.coordinator ?? supportDirectoryCoordinator;
  const stableDependencies = useMemo(() => dependencies, [dependencies]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SupportDirectoryState>({ status: 'loading' });
  const saveInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const activeRequestAuthorityRef = useRef<SupportRequestAuthority | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const authority = coordinator.beginRequest();
    activeRequestAuthorityRef.current = authority;
    void loadSupportDirectoryState(stableDependencies, authority).then((nextState) => {
      if (mountedRef.current && coordinator.isRequestAuthoritative(authority)) {
        setState(nextState);
      }
    }).catch((error: unknown) => {
      if (error instanceof SupersededSupportDirectoryAttemptError) return;
      if (mountedRef.current && coordinator.isRequestAuthoritative(authority)) {
        setState({ status: 'error', message: errorMessage(error, 'The support directory could not be loaded.') });
      }
    });
    return () => {
      coordinator.revokeRequest(authority);
      if (activeRequestAuthorityRef.current === authority) {
        activeRequestAuthorityRef.current = undefined;
      }
    };
  }, [attempt, coordinator, stableDependencies]);

  const retry = useCallback(() => {
    if (state.refreshing) return;
    setState((current) => current.status === 'offline' || current.status === 'service-unavailable'
      ? { ...current, refreshing: true }
      : { status: 'loading' });
    setAttempt((value) => value + 1);
  }, [state.refreshing]);

  const saveOffline = useCallback(async () => {
    if (!state.response || state.refreshing || saveInFlightRef.current) return;
    const response = state.response;
    const responseRevision = response.fetchedAt;
    const authority = activeRequestAuthorityRef.current;
    if (authority === undefined) return;
    saveInFlightRef.current = true;
    setState((current) => ({
      ...current,
      savingOffline: true,
      storageMessage: 'Saving contacts on this device…',
    }));
    try {
      const saved = await coordinator.saveManual(
        authority,
        responseRevision,
        response,
        dependencies.stageCache,
        dependencies.commitCache,
      );
      if (!mountedRef.current) return;
      setState((current) => saved ? ({
        ...current,
        savedOffline: true,
        savingOffline: false,
        storageMessage: 'Saved to this device for offline access.',
      }) : ({
        ...current,
        savingOffline: false,
        storageMessage: 'A newer directory update replaced this save. Save again if needed.',
      }));
    } catch {
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        savedOffline: false,
        savingOffline: false,
        storageMessage: 'Could not save contacts on this device. Try again.',
      }));
    } finally {
      saveInFlightRef.current = false;
    }
  }, [coordinator, dependencies.commitCache, dependencies.stageCache, state.refreshing, state.response]);

  return { ...state, retry, saveOffline };
}
