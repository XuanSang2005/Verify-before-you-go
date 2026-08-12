import type { SupportDirectoryResponse } from '@vbyg/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchSupportDirectory,
  isSupportApiError,
} from '@/api/support';

import {
  loadCachedSupportDirectory,
  saveCachedSupportDirectory,
} from './support-cache';

export type SupportDirectoryLoadStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline'
  | 'service-unavailable'
  | 'error';

export type SupportDirectoryState = {
  status: SupportDirectoryLoadStatus;
  response?: SupportDirectoryResponse;
  cachedAt?: string;
  message?: string;
  refreshing?: boolean;
  savedOffline?: boolean;
  storageMessage?: string;
  savingOffline?: boolean;
};

export type SupportDirectoryDependencies = {
  fetchDirectory: typeof fetchSupportDirectory;
  loadCache: typeof loadCachedSupportDirectory;
  saveCache: typeof saveCachedSupportDirectory;
};

const defaultDependencies: SupportDirectoryDependencies = {
  fetchDirectory: fetchSupportDirectory,
  loadCache: loadCachedSupportDirectory,
  saveCache: saveCachedSupportDirectory,
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function loadSupportDirectoryState(
  dependencies: SupportDirectoryDependencies = defaultDependencies,
): Promise<SupportDirectoryState> {
  let cached = null;
  let cacheReadFailed = false;
  try {
    cached = await dependencies.loadCache();
  } catch {
    cacheReadFailed = true;
  }

  try {
    const response = await dependencies.fetchDirectory();
    try {
      await dependencies.saveCache(response);
      return {
        status: response.contacts.length ? 'ready' : 'empty',
        response,
        savedOffline: true,
      };
    } catch {
      return {
        status: response.contacts.length ? 'ready' : 'empty',
        response,
        savedOffline: false,
        storageMessage: 'Contacts loaded, but this device could not update the offline copy.',
      };
    }
  } catch (error) {
    if (isSupportApiError(error) && error.kind === 'network') {
      if (cached) {
        return {
          status: 'offline',
          response: cached.data,
          cachedAt: cached.cachedAt,
          message: 'Offline · showing saved contacts',
          savedOffline: true,
        };
      }
      return {
        status: 'error',
        message: cacheReadFailed
          ? 'The support directory is offline and saved contacts could not be read on this device.'
          : error.message,
      };
    }

    if (isSupportApiError(error) && error.kind === 'http' && (error.status ?? 0) >= 500 && cached) {
      return {
        status: 'service-unavailable',
        response: cached.data,
        cachedAt: cached.cachedAt,
        message: 'Service unavailable · showing saved contacts',
        savedOffline: true,
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
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SupportDirectoryState>({ status: 'loading' });
  const saveInFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void loadSupportDirectoryState(dependencies).then((nextState) => {
      if (active) setState(nextState);
    });
    return () => { active = false; };
  }, [attempt, dependencies]);

  const retry = useCallback(() => {
    if (state.refreshing) return;
    setState((current) => current.status === 'offline' || current.status === 'service-unavailable'
      ? { ...current, refreshing: true }
      : { status: 'loading' });
    setAttempt((value) => value + 1);
  }, [state.refreshing]);

  const saveOffline = useCallback(async () => {
    if (!state.response || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setState((current) => ({
      ...current,
      savingOffline: true,
      storageMessage: 'Saving contacts on this device…',
    }));
    try {
      await dependencies.saveCache(state.response);
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        savedOffline: true,
        savingOffline: false,
        storageMessage: 'Saved to this device for offline access.',
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
  }, [dependencies, state.response]);

  return { ...state, retry, saveOffline };
}
