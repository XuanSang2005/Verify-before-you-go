import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AlertDetailResponseSchema,
  AlertListResponseSchema,
  type AlertDetailResponse,
  type AlertListResponse,
} from '@vbyg/contracts';

const ALERT_LIST_CACHE_KEY = '@vbyg/alerts/list/v1';
const ALERT_DETAIL_CACHE_PREFIX = '@vbyg/alerts/detail/v1/';
const ALERT_DETAIL_TOMBSTONE_PREFIX = '@vbyg/alerts/tombstone/v1/';

export interface AlertsCacheStoragePort {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
}

export type CachedAlertsValue<T> = {
  schemaVersion: 1;
  cachedAt: string;
  data: T;
};

export type AlertDetailTombstone = {
  schemaVersion: 1;
  id: string;
  revokedAt: string;
  updatedAt: string;
};

export interface AlertListCacheCoordinator {
  beginRequest: () => number;
  isAuthoritative: (generation: number) => boolean;
  saveIfAuthoritative: (
    generation: number,
    operation: () => Promise<void>,
  ) => Promise<boolean>;
  supersede: (generation: number) => void;
  whenIdle: () => Promise<void>;
}

export interface AlertDetailCacheCoordinator {
  applyTombstoneIfAuthoritative: (id: string, generation: number, exists: boolean) => boolean;
  beginRequest: (id: string) => number;
  canUseCachedDetail: (id: string) => boolean;
  deleteIfAuthoritative: (
    id: string,
    generation: number,
    operation: () => Promise<void>,
  ) => Promise<boolean>;
  saveIfAuthoritative: (
    id: string,
    generation: number,
    operation: () => Promise<void>,
  ) => Promise<boolean>;
  isAuthoritative: (id: string, generation: number) => boolean;
  supersede: (id: string, generation: number) => void;
  whenIdle: (id: string) => Promise<void>;
}

type AlertDetailCacheEntry = {
  cacheBlocked: boolean;
  currentGeneration: number;
  intent?: 'present' | 'revoked';
  mutationTail: Promise<void>;
  nextGeneration: number;
};

export function createAlertListCacheCoordinator(): AlertListCacheCoordinator {
  let currentGeneration = 0;
  let nextGeneration = 0;
  let mutationTail = Promise.resolve();

  const isAuthoritative = (generation: number) => currentGeneration === generation;

  return {
    beginRequest() {
      nextGeneration += 1;
      currentGeneration = nextGeneration;
      return currentGeneration;
    },
    isAuthoritative,
    async saveIfAuthoritative(generation, operation) {
      if (!isAuthoritative(generation)) return false;
      const mutation = mutationTail.catch(() => undefined).then(async () => {
        if (!isAuthoritative(generation)) return;
        await operation().catch(() => undefined);
      });
      mutationTail = mutation.catch(() => undefined);
      await mutation;
      return isAuthoritative(generation);
    },
    supersede(generation) {
      if (!isAuthoritative(generation)) return;
      nextGeneration += 1;
      currentGeneration = nextGeneration;
    },
    whenIdle() {
      return mutationTail;
    },
  };
}

export function createAlertDetailCacheCoordinator(): AlertDetailCacheCoordinator {
  const entries = new Map<string, AlertDetailCacheEntry>();
  const getEntry = (id: string) => {
    const existing = entries.get(id);
    if (existing) return existing;
    const created: AlertDetailCacheEntry = {
      cacheBlocked: false,
      currentGeneration: 0,
      mutationTail: Promise.resolve(),
      nextGeneration: 0,
    };
    entries.set(id, created);
    return created;
  };
  const isCurrentIntent = (
    entry: AlertDetailCacheEntry,
    generation: number,
    intent: AlertDetailCacheEntry['intent'],
  ) => entry.currentGeneration === generation && entry.intent === intent;

  return {
    applyTombstoneIfAuthoritative(id, generation, exists) {
      const entry = getEntry(id);
      if (entry.currentGeneration !== generation) return false;
      if (exists) entry.cacheBlocked = true;
      return true;
    },
    beginRequest(id) {
      const entry = getEntry(id);
      entry.nextGeneration += 1;
      entry.currentGeneration = entry.nextGeneration;
      return entry.currentGeneration;
    },
    canUseCachedDetail(id) {
      return !getEntry(id).cacheBlocked;
    },
    async deleteIfAuthoritative(id, generation, operation) {
      const entry = getEntry(id);
      if (entry.currentGeneration !== generation) return false;

      entry.intent = 'revoked';
      entry.cacheBlocked = true;

      const mutation = entry.mutationTail.catch(() => undefined).then(async () => {
        if (!isCurrentIntent(entry, generation, 'revoked')) return;
        await operation().catch(() => undefined);
      });
      entry.mutationTail = mutation.catch(() => undefined);
      await mutation;
      return isCurrentIntent(entry, generation, 'revoked');
    },
    async saveIfAuthoritative(id, generation, operation) {
      const entry = getEntry(id);
      if (entry.currentGeneration !== generation) return false;

      const cacheWasBlocked = entry.cacheBlocked;
      entry.intent = 'present';
      entry.cacheBlocked = true;

      let operationSucceeded = false;
      const mutation = entry.mutationTail.catch(() => undefined).then(async () => {
        if (!isCurrentIntent(entry, generation, 'present')) return;
        try {
          await operation();
          operationSucceeded = true;
        } catch {
          operationSucceeded = false;
        }
        if (isCurrentIntent(entry, generation, 'present')) {
          entry.cacheBlocked = operationSucceeded ? false : cacheWasBlocked;
        }
      });
      entry.mutationTail = mutation.catch(() => undefined);
      await mutation;
      return isCurrentIntent(entry, generation, 'present');
    },
    isAuthoritative(id, generation) {
      return getEntry(id).currentGeneration === generation;
    },
    supersede(id, generation) {
      const entry = getEntry(id);
      if (entry.currentGeneration !== generation) return;
      entry.nextGeneration += 1;
      entry.currentGeneration = entry.nextGeneration;
    },
    whenIdle(id) {
      return getEntry(id).mutationTail;
    },
  };
}

export const alertListCacheCoordinator = createAlertListCacheCoordinator();
export const alertDetailCacheCoordinator = createAlertDetailCacheCoordinator();

const asyncStoragePort: AlertsCacheStoragePort = {
  getItem: (key) => AsyncStorage.getItem(key),
  removeItem: (key) => AsyncStorage.removeItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

function parseCachedValue<T>(
  raw: string | null,
  parseData: (data: unknown) => T | null,
): CachedAlertsValue<T> | null {
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

export async function loadCachedAlertList(
  storage: AlertsCacheStoragePort = asyncStoragePort,
): Promise<CachedAlertsValue<AlertListResponse> | null> {
  const raw = await storage.getItem(ALERT_LIST_CACHE_KEY);
  return parseCachedValue(raw, (data) => {
    const parsed = AlertListResponseSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  });
}

export async function saveCachedAlertList(
  data: AlertListResponse,
  storage: AlertsCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
): Promise<void> {
  await storage.setItem(ALERT_LIST_CACHE_KEY, JSON.stringify({ schemaVersion: 1, cachedAt, data }));
}

export async function loadCachedAlertDetail(
  id: string,
  storage: AlertsCacheStoragePort = asyncStoragePort,
): Promise<CachedAlertsValue<AlertDetailResponse> | null> {
  const raw = await storage.getItem(`${ALERT_DETAIL_CACHE_PREFIX}${id}`);
  return parseCachedValue(raw, (data) => {
    const parsed = AlertDetailResponseSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  });
}

export async function saveCachedAlertDetail(
  id: string,
  data: AlertDetailResponse,
  storage: AlertsCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
): Promise<void> {
  await storage.setItem(
    `${ALERT_DETAIL_CACHE_PREFIX}${id}`,
    JSON.stringify({ schemaVersion: 1, cachedAt, data }),
  );
}

export async function deleteCachedAlertDetail(
  id: string,
  storage: AlertsCacheStoragePort = asyncStoragePort,
): Promise<void> {
  await storage.removeItem(`${ALERT_DETAIL_CACHE_PREFIX}${id}`);
}

function parseAlertDetailTombstone(raw: string | null, expectedId: string): AlertDetailTombstone | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const keys = Object.keys(value).toSorted();
    if (keys.join(',') !== 'id,revokedAt,schemaVersion,updatedAt') return null;
    if (value.schemaVersion !== 1 || value.id !== expectedId || !/^A-\d{3}$/.test(expectedId)) return null;
    if (typeof value.revokedAt !== 'string' || typeof value.updatedAt !== 'string') return null;
    const revokedAt = new Date(value.revokedAt);
    const updatedAt = new Date(value.updatedAt);
    if (Number.isNaN(revokedAt.getTime()) || Number.isNaN(updatedAt.getTime())) return null;
    return {
      schemaVersion: 1,
      id: expectedId,
      revokedAt: revokedAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function loadAlertDetailTombstone(
  id: string,
  storage: AlertsCacheStoragePort = asyncStoragePort,
): Promise<AlertDetailTombstone | null> {
  const raw = await storage.getItem(`${ALERT_DETAIL_TOMBSTONE_PREFIX}${id}`);
  if (!raw) return null;
  const parsed = parseAlertDetailTombstone(raw, id);
  if (!parsed) throw new Error('The saved alert revocation record is invalid.');
  return parsed;
}

export async function saveAlertDetailTombstone(
  id: string,
  storage: AlertsCacheStoragePort = asyncStoragePort,
  timestamp = new Date().toISOString(),
): Promise<void> {
  if (!/^A-\d{3}$/.test(id)) throw new Error('The alert revocation ID is invalid.');
  const canonicalTimestamp = new Date(timestamp).toISOString();
  await storage.setItem(`${ALERT_DETAIL_TOMBSTONE_PREFIX}${id}`, JSON.stringify({
    schemaVersion: 1,
    id,
    revokedAt: canonicalTimestamp,
    updatedAt: canonicalTimestamp,
  } satisfies AlertDetailTombstone));
}

export async function deleteAlertDetailTombstone(
  id: string,
  storage: AlertsCacheStoragePort = asyncStoragePort,
): Promise<void> {
  await storage.removeItem(`${ALERT_DETAIL_TOMBSTONE_PREFIX}${id}`);
}
