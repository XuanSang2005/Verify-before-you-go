import type { NewsDetailResponse, NewsListResponse } from '@vbyg/contracts';
import { useEffect, useState } from 'react';

import {
  fetchNewsStories,
  fetchNewsStory,
  isNewsApiError,
} from '@/api/news';

import {
  deleteCachedNewsDetail,
  loadCachedNewsDetail,
  loadCachedNewsList,
  saveCachedNewsDetail,
  saveCachedNewsList,
} from './news-cache';

export type NewsLoadStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline'
  | 'service-unavailable'
  | 'not-found'
  | 'error';

export type NewsroomState = {
  status: Exclude<NewsLoadStatus, 'not-found'>;
  response?: NewsListResponse;
  cachedAt?: string;
  message?: string;
  refreshing?: boolean;
};

export type NewsDetailState = {
  status: Exclude<NewsLoadStatus, 'empty'>;
  response?: NewsDetailResponse;
  cachedAt?: string;
  message?: string;
  refreshing?: boolean;
};

export type NewsLoaderDependencies = {
  deleteDetailCache: typeof deleteCachedNewsDetail;
  fetchDetail: typeof fetchNewsStory;
  fetchList: typeof fetchNewsStories;
  loadDetailCache: typeof loadCachedNewsDetail;
  loadListCache: typeof loadCachedNewsList;
  saveDetailCache: typeof saveCachedNewsDetail;
  saveListCache: typeof saveCachedNewsList;
};

const defaultDependencies: NewsLoaderDependencies = {
  deleteDetailCache: deleteCachedNewsDetail,
  fetchDetail: fetchNewsStory,
  fetchList: fetchNewsStories,
  loadDetailCache: loadCachedNewsDetail,
  loadListCache: loadCachedNewsList,
  saveDetailCache: saveCachedNewsDetail,
  saveListCache: saveCachedNewsList,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function loadNewsroomState(
  dependencies: NewsLoaderDependencies = defaultDependencies,
): Promise<NewsroomState> {
  const cached = await dependencies.loadListCache().catch(() => null);
  try {
    const response = await dependencies.fetchList();
    await dependencies.saveListCache(response).catch(() => undefined);
    return { status: response.stories.length ? 'ready' : 'empty', response };
  } catch (error) {
    if (isNewsApiError(error) && error.kind === 'network') {
      return cached
        ? {
            status: 'offline',
            response: cached.data,
            cachedAt: cached.cachedAt,
            message: 'Offline · showing saved summaries',
          }
        : { status: 'error', message: error.message };
    }

    if (isNewsApiError(error) && error.kind === 'http' && (error.status ?? 0) >= 500 && cached) {
      return {
        status: 'service-unavailable',
        response: cached.data,
        cachedAt: cached.cachedAt,
        message: 'Service unavailable · showing saved copy',
      };
    }

    return {
      status: 'error',
      message: getErrorMessage(error, 'The newsroom could not be loaded.'),
    };
  }
}

export async function loadNewsDetailState(
  slug: string,
  dependencies: NewsLoaderDependencies = defaultDependencies,
): Promise<NewsDetailState> {
  const cached = await dependencies.loadDetailCache(slug).catch(() => null);
  try {
    const response = await dependencies.fetchDetail(slug);
    await dependencies.saveDetailCache(slug, response).catch(() => undefined);
    return { status: 'ready', response };
  } catch (error) {
    if (isNewsApiError(error) && error.kind === 'http' && error.status === 404) {
      await dependencies.deleteDetailCache(slug).catch(() => undefined);
      return {
        status: 'not-found',
        message: 'Not found. This story may have been removed or its address may be incorrect.',
      };
    }

    if (isNewsApiError(error) && error.kind === 'network') {
      return cached
        ? {
            status: 'offline',
            response: cached.data,
            cachedAt: cached.cachedAt,
            message: 'Offline · showing saved story',
          }
        : { status: 'error', message: error.message };
    }

    if (isNewsApiError(error) && error.kind === 'http' && (error.status ?? 0) >= 500 && cached) {
      return {
        status: 'service-unavailable',
        response: cached.data,
        cachedAt: cached.cachedAt,
        message: 'Service unavailable · showing saved copy',
      };
    }

    return {
      status: 'error',
      message: getErrorMessage(error, 'This newsroom story could not be loaded.'),
    };
  }
}

export function useNewsroom(dependencies: NewsLoaderDependencies = defaultDependencies) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<NewsroomState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void loadNewsroomState(dependencies).then((nextState) => {
      if (active) setState(nextState);
    });
    return () => { active = false; };
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

export function useNewsStory(
  slug: string,
  dependencies: NewsLoaderDependencies = defaultDependencies,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<NewsDetailState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void loadNewsDetailState(slug, dependencies).then((nextState) => {
      if (active) setState(nextState);
    });
    return () => { active = false; };
  }, [attempt, dependencies, slug]);

  const retry = () => {
    if (state.refreshing) return;
    setState((current) => current.status === 'offline' || current.status === 'service-unavailable'
      ? { ...current, refreshing: true }
      : { ...current, status: 'loading', message: undefined, refreshing: false });
    setAttempt((value) => value + 1);
  };
  return { ...state, retry };
}
