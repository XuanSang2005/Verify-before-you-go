import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SupportDirectoryResponseSchema,
  type SupportDirectoryResponse,
} from '@vbyg/contracts';

export const SUPPORT_DIRECTORY_CACHE_KEY = '@vbyg/support-directory/v1';

export interface SupportCacheStoragePort {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export type CachedSupportDirectory = {
  schemaVersion: 1;
  cachedAt: string;
  data: SupportDirectoryResponse;
};

const asyncStoragePort: SupportCacheStoragePort = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

export async function loadCachedSupportDirectory(
  storage: SupportCacheStoragePort = asyncStoragePort,
): Promise<CachedSupportDirectory | null> {
  const raw = await storage.getItem(SUPPORT_DIRECTORY_CACHE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.schemaVersion !== 1 || typeof value.cachedAt !== 'string') return null;
    const cachedAt = new Date(value.cachedAt);
    const parsed = SupportDirectoryResponseSchema.safeParse(value.data);
    if (Number.isNaN(cachedAt.getTime()) || !parsed.success) return null;
    return {
      schemaVersion: 1,
      cachedAt: cachedAt.toISOString(),
      data: parsed.data,
    };
  } catch {
    return null;
  }
}

export async function saveCachedSupportDirectory(
  data: SupportDirectoryResponse,
  storage: SupportCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
): Promise<void> {
  const parsed = SupportDirectoryResponseSchema.parse(data);
  await storage.setItem(SUPPORT_DIRECTORY_CACHE_KEY, JSON.stringify({
    schemaVersion: 1,
    cachedAt,
    data: parsed,
  }));
}
