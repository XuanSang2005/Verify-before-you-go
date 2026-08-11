import type { AlertDetailResponse, AlertListResponse } from '@vbyg/contracts';
import { useEffect, useState } from 'react';

import {
  fetchCommunityAlert,
  fetchCommunityAlerts,
  isAlertsApiError,
} from '@/api/alerts';

import {
  alertDetailCacheCoordinator,
  alertListCacheCoordinator,
  deleteAlertDetailTombstone,
  deleteCachedAlertDetail,
  loadAlertDetailTombstone,
  loadCachedAlertDetail,
  loadCachedAlertList,
  saveAlertDetailTombstone,
  saveCachedAlertDetail,
  saveCachedAlertList,
} from './alerts-cache';

export type AlertsLoadStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline'
  | 'service-unavailable'
  | 'not-found'
  | 'error';

export type AlertsListState = {
  status: Exclude<AlertsLoadStatus, 'not-found'>;
  response?: AlertListResponse;
  cachedAt?: string;
  message?: string;
  refreshing?: boolean;
};

export type AlertDetailState = {
  status: Exclude<AlertsLoadStatus, 'empty'>;
  response?: AlertDetailResponse;
  cachedAt?: string;
  message?: string;
  refreshing?: boolean;
};

export type SupersededAlertsState = { status: 'superseded' };

export type AlertsLoaderDependencies = {
  detailCacheCoordinator: typeof alertDetailCacheCoordinator;
  listCacheCoordinator: typeof alertListCacheCoordinator;
  deleteDetailTombstone: typeof deleteAlertDetailTombstone;
  deleteDetailCache: typeof deleteCachedAlertDetail;
  fetchDetail: typeof fetchCommunityAlert;
  fetchList: typeof fetchCommunityAlerts;
  loadDetailTombstone: typeof loadAlertDetailTombstone;
  loadDetailCache: typeof loadCachedAlertDetail;
  loadListCache: typeof loadCachedAlertList;
  saveDetailTombstone: typeof saveAlertDetailTombstone;
  saveDetailCache: typeof saveCachedAlertDetail;
  saveListCache: typeof saveCachedAlertList;
};

const defaultDependencies: AlertsLoaderDependencies = {
  detailCacheCoordinator: alertDetailCacheCoordinator,
  listCacheCoordinator: alertListCacheCoordinator,
  deleteDetailTombstone: deleteAlertDetailTombstone,
  deleteDetailCache: deleteCachedAlertDetail,
  fetchDetail: fetchCommunityAlert,
  fetchList: fetchCommunityAlerts,
  loadDetailTombstone: loadAlertDetailTombstone,
  loadDetailCache: loadCachedAlertDetail,
  loadListCache: loadCachedAlertList,
  saveDetailTombstone: saveAlertDetailTombstone,
  saveDetailCache: saveCachedAlertDetail,
  saveListCache: saveCachedAlertList,
};

const supersededState: SupersededAlertsState = { status: 'superseded' };

function isSupersededState(value: unknown): value is SupersededAlertsState {
  return Boolean(value && typeof value === 'object' && 'status' in value && value.status === 'superseded');
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function loadAlertsListState(
  dependencies: AlertsLoaderDependencies = defaultDependencies,
  requestGeneration = dependencies.listCacheCoordinator.beginRequest(),
): Promise<AlertsListState | SupersededAlertsState> {
  try {
    const response = await dependencies.fetchList();
    const saved = await dependencies.listCacheCoordinator.saveIfAuthoritative(
      requestGeneration,
      () => dependencies.saveListCache(response),
    );
    if (!saved) return supersededState;
    return { status: response.alerts.length ? 'ready' : 'empty', response };
  } catch (error) {
    if (!dependencies.listCacheCoordinator.isAuthoritative(requestGeneration)) return supersededState;
    await dependencies.listCacheCoordinator.whenIdle();
    if (!dependencies.listCacheCoordinator.isAuthoritative(requestGeneration)) return supersededState;
    const cached = await dependencies.loadListCache().catch(() => null);
    if (!dependencies.listCacheCoordinator.isAuthoritative(requestGeneration)) return supersededState;
    if (isAlertsApiError(error) && error.kind === 'network') {
      return cached
        ? {
            status: 'offline',
            response: cached.data,
            cachedAt: cached.cachedAt,
            message: 'Offline · showing saved alerts',
          }
        : { status: 'error', message: error.message };
    }
    if (isAlertsApiError(error) && error.kind === 'http' && (error.status ?? 0) >= 500 && cached) {
      return {
        status: 'service-unavailable',
        response: cached.data,
        cachedAt: cached.cachedAt,
        message: 'Service unavailable · showing saved copy',
      };
    }
    return {
      status: 'error',
      message: getErrorMessage(error, 'Community alerts could not be loaded.'),
    };
  }
}

export async function loadAlertDetailState(
  id: string,
  dependencies: AlertsLoaderDependencies = defaultDependencies,
  requestGeneration = dependencies.detailCacheCoordinator.beginRequest(id),
): Promise<AlertDetailState | SupersededAlertsState> {
  await dependencies.detailCacheCoordinator.whenIdle(id);
  if (!dependencies.detailCacheCoordinator.isAuthoritative(id, requestGeneration)) return supersededState;
  const tombstoneBlocksCache = await dependencies.loadDetailTombstone(id)
    .then((value) => Boolean(value))
    .catch(() => true);
  if (!dependencies.detailCacheCoordinator.applyTombstoneIfAuthoritative(
    id,
    requestGeneration,
    tombstoneBlocksCache,
  )) return supersededState;

  try {
    const response = await dependencies.fetchDetail(id);
    const saved = await dependencies.detailCacheCoordinator.saveIfAuthoritative(
      id,
      requestGeneration,
      async () => {
        await dependencies.saveDetailCache(id, response);
        await dependencies.deleteDetailTombstone(id);
      },
    );
    if (!saved) return supersededState;
    return { status: 'ready', response };
  } catch (error) {
    if (!dependencies.detailCacheCoordinator.isAuthoritative(id, requestGeneration)) return supersededState;
    if (isAlertsApiError(error) && error.kind === 'http' && error.status === 404) {
      const deleted = await dependencies.detailCacheCoordinator.deleteIfAuthoritative(
        id,
        requestGeneration,
        async () => {
          let tombstoneError: unknown;
          try {
            await dependencies.saveDetailTombstone(id);
          } catch (error) {
            tombstoneError = error;
          }
          await dependencies.deleteDetailCache(id).catch(() => undefined);
          if (tombstoneError) throw tombstoneError;
        },
      );
      if (!deleted) return supersededState;
      return {
        status: 'not-found',
        message: 'Not found. This reviewed alert may have been removed or its address may be incorrect.',
      };
    }
    if (isAlertsApiError(error) && error.kind === 'network') {
      const currentCached = await loadLatestAuthoritativeDetailCache(
        id,
        requestGeneration,
        dependencies,
      );
      if (isSupersededState(currentCached)) return supersededState;
      return currentCached
        ? {
            status: 'offline',
            response: currentCached.data,
            cachedAt: currentCached.cachedAt,
            message: 'Offline · showing saved alert',
          }
        : { status: 'error', message: error.message };
    }
    if (isAlertsApiError(error) && error.kind === 'http' && (error.status ?? 0) >= 500) {
      const currentCached = await loadLatestAuthoritativeDetailCache(
        id,
        requestGeneration,
        dependencies,
      );
      if (isSupersededState(currentCached)) return supersededState;
      if (currentCached) {
        return {
          status: 'service-unavailable',
          response: currentCached.data,
          cachedAt: currentCached.cachedAt,
          message: 'Service unavailable · showing saved copy',
        };
      }
    }
    if (!dependencies.detailCacheCoordinator.isAuthoritative(id, requestGeneration)) return supersededState;
    return {
      status: 'error',
      message: getErrorMessage(error, 'This community alert could not be loaded.'),
    };
  }
}

async function loadLatestAuthoritativeDetailCache(
  id: string,
  requestGeneration: number,
  dependencies: AlertsLoaderDependencies,
) {
  await dependencies.detailCacheCoordinator.whenIdle(id);
  if (!dependencies.detailCacheCoordinator.isAuthoritative(id, requestGeneration)) return supersededState;
  const tombstoneBlocksCache = await dependencies.loadDetailTombstone(id)
    .then((value) => Boolean(value))
    .catch(() => true);
  if (!dependencies.detailCacheCoordinator.applyTombstoneIfAuthoritative(
    id,
    requestGeneration,
    tombstoneBlocksCache,
  )) return supersededState;
  if (!dependencies.detailCacheCoordinator.canUseCachedDetail(id)) return null;
  const cached = await dependencies.loadDetailCache(id).catch(() => null);
  return dependencies.detailCacheCoordinator.isAuthoritative(id, requestGeneration)
    ? cached
    : supersededState;
}

export function useCommunityAlerts(dependencies: AlertsLoaderDependencies = defaultDependencies) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AlertsListState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    const requestGeneration = dependencies.listCacheCoordinator.beginRequest();
    void loadAlertsListState(dependencies, requestGeneration).then((nextState) => {
      if (active && nextState.status !== 'superseded') setState(nextState);
    });
    return () => {
      active = false;
      dependencies.listCacheCoordinator.supersede(requestGeneration);
    };
  }, [attempt, dependencies]);

  const retry = () => {
    if (state.refreshing) return;
    setState((current) => current.status === 'offline' || current.status === 'service-unavailable'
      ? { ...current, refreshing: true }
      : { ...current, status: 'loading', message: undefined, refreshing: false });
    setAttempt((value) => value + 1);
  };
  return { ...state, retry };
}

export function useCommunityAlert(
  id: string,
  dependencies: AlertsLoaderDependencies = defaultDependencies,
) {
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<{ id: string; state: AlertDetailState }>({
    id,
    state: { status: 'loading' },
  });
  const state = view.id === id ? view.state : { status: 'loading' as const };

  useEffect(() => {
    let active = true;
    const requestGeneration = dependencies.detailCacheCoordinator.beginRequest(id);
    void loadAlertDetailState(id, dependencies, requestGeneration).then((nextState) => {
      if (active && nextState.status !== 'superseded') setView({ id, state: nextState });
    });
    return () => {
      active = false;
      dependencies.detailCacheCoordinator.supersede(id, requestGeneration);
    };
  }, [attempt, dependencies, id]);

  const retry = () => {
    if (state.refreshing) return;
    setView((current) => {
      const currentState = current.id === id ? current.state : { status: 'loading' as const };
      return {
        id,
        state: currentState.status === 'offline' || currentState.status === 'service-unavailable'
          ? { ...currentState, refreshing: true }
          : { ...currentState, status: 'loading', message: undefined, refreshing: false },
      };
    });
    setAttempt((value) => value + 1);
  };
  return { ...state, retry };
}
