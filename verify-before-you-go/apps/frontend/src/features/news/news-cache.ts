import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NewsDetailResponseSchema,
  NewsListResponseSchema,
  type NewsDetailResponse,
  type NewsListResponse,
} from '@vbyg/contracts';

const NEWS_LIST_CACHE_KEY = '@vbyg/news/list/v1';
const NEWS_DETAIL_CACHE_PREFIX = '@vbyg/news/detail/v1/';

export interface NewsCacheStoragePort {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
}

type CachedValue<T> = {
  schemaVersion: 1;
  cachedAt: string;
  data: T;
};

const asyncStoragePort: NewsCacheStoragePort = {
  getItem: (key) => AsyncStorage.getItem(key),
  removeItem: (key) => AsyncStorage.removeItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

function parseCachedValue<T>(
  raw: string | null,
  parseData: (data: unknown) => T | null,
): CachedValue<T> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.schemaVersion !== 1 || typeof value.cachedAt !== 'string') return null;
    const cachedAt = new Date(value.cachedAt);
    if (Number.isNaN(cachedAt.getTime())) return null;
    const data = parseData(value.data);
    return data ? { schemaVersion: 1, cachedAt: cachedAt.toISOString(), data } : null;
  } catch {
    return null;
  }
}

export async function loadCachedNewsList(
  storage: NewsCacheStoragePort = asyncStoragePort,
): Promise<CachedValue<NewsListResponse> | null> {
  const raw = await storage.getItem(NEWS_LIST_CACHE_KEY);
  return parseCachedValue(raw, (data) => {
    const parsed = NewsListResponseSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  });
}

export async function saveCachedNewsList(
  data: NewsListResponse,
  storage: NewsCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
): Promise<void> {
  await storage.setItem(NEWS_LIST_CACHE_KEY, JSON.stringify({ schemaVersion: 1, cachedAt, data }));
}

export async function loadCachedNewsDetail(
  slug: string,
  storage: NewsCacheStoragePort = asyncStoragePort,
): Promise<CachedValue<NewsDetailResponse> | null> {
  const raw = await storage.getItem(`${NEWS_DETAIL_CACHE_PREFIX}${slug}`);
  return parseCachedValue(raw, (data) => {
    const parsed = NewsDetailResponseSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  });
}

export async function saveCachedNewsDetail(
  slug: string,
  data: NewsDetailResponse,
  storage: NewsCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
): Promise<void> {
  await storage.setItem(`${NEWS_DETAIL_CACHE_PREFIX}${slug}`, JSON.stringify({ schemaVersion: 1, cachedAt, data }));
}

export async function deleteCachedNewsDetail(
  slug: string,
  storage: NewsCacheStoragePort = asyncStoragePort,
): Promise<void> {
  await storage.removeItem(`${NEWS_DETAIL_CACHE_PREFIX}${slug}`);
}
