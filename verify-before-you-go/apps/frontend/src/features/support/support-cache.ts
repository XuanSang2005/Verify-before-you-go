import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SupportDirectoryResponseSchema,
  type SupportDirectoryResponse,
} from '@vbyg/contracts';

export const SUPPORT_DIRECTORY_CACHE_KEY = '@vbyg/support-directory/v1';
export const SUPPORT_DIRECTORY_CACHE_HEAD_KEY = '@vbyg/support-directory/v2/head';
export const SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX = '@vbyg/support-directory/v2/slot/';

export interface SupportCacheStoragePort {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
}

export type CachedSupportDirectory = {
  schemaVersion: 1;
  cachedAt: string;
  data: SupportDirectoryResponse;
};

export type StagedSupportDirectoryCache = {
  cacheSchemaVersion: 2;
  candidateId: string;
  candidateKey: string;
  cachedAt: string;
  responseRevision: string;
};

type SupportCacheHead = {
  cacheSchemaVersion: 2;
  candidateId: string;
  candidateKey: string;
  committedAt: string;
  responseRevision: string;
};

type SupportCacheSlot = {
  cacheSchemaVersion: 2;
  candidateId: string;
  cachedAt: string;
  responseRevision: string;
  data: SupportDirectoryResponse;
};

const asyncStoragePort: SupportCacheStoragePort = {
  getItem: (key) => AsyncStorage.getItem(key),
  removeItem: (key) => AsyncStorage.removeItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

let candidateSequence = 0;

function createCandidateId() {
  candidateSequence += 1;
  return `${Date.now().toString(36)}-${candidateSequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseCachedDirectory(raw: string | null): CachedSupportDirectory | null {
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

function parseHead(raw: string | null): SupportCacheHead | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SupportCacheHead>;
    if (
      value.cacheSchemaVersion !== 2
      || typeof value.candidateId !== 'string'
      || typeof value.candidateKey !== 'string'
      || typeof value.committedAt !== 'string'
      || typeof value.responseRevision !== 'string'
      || value.candidateKey !== `${SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX}${value.candidateId}`
      || Number.isNaN(new Date(value.committedAt).getTime())
      || Number.isNaN(new Date(value.responseRevision).getTime())
    ) return null;
    return value as SupportCacheHead;
  } catch {
    return null;
  }
}

function parseSlot(raw: string | null, head: SupportCacheHead): CachedSupportDirectory | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SupportCacheSlot>;
    const cachedAt = typeof value.cachedAt === 'string' ? new Date(value.cachedAt) : null;
    const parsed = SupportDirectoryResponseSchema.safeParse(value.data);
    if (
      value.cacheSchemaVersion !== 2
      || value.candidateId !== head.candidateId
      || value.responseRevision !== head.responseRevision
      || parsed.success === false
      || parsed.data.fetchedAt !== head.responseRevision
      || !cachedAt
      || Number.isNaN(cachedAt.getTime())
    ) return null;
    return {
      schemaVersion: 1,
      cachedAt: cachedAt.toISOString(),
      data: parsed.data,
    };
  } catch {
    return null;
  }
}

export async function loadCachedSupportDirectory(
  storage: SupportCacheStoragePort = asyncStoragePort,
): Promise<CachedSupportDirectory | null> {
  const rawHead = await storage.getItem(SUPPORT_DIRECTORY_CACHE_HEAD_KEY);
  if (rawHead !== null) {
    const head = parseHead(rawHead);
    if (!head) return null;
    return parseSlot(await storage.getItem(head.candidateKey), head);
  }
  return parseCachedDirectory(await storage.getItem(SUPPORT_DIRECTORY_CACHE_KEY));
}

export async function stageCachedSupportDirectory(
  data: SupportDirectoryResponse,
  storage: SupportCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
  candidateId = createCandidateId(),
): Promise<StagedSupportDirectoryCache> {
  const parsed = SupportDirectoryResponseSchema.parse(data);
  const normalizedCachedAt = new Date(cachedAt);
  if (Number.isNaN(normalizedCachedAt.getTime()) || !/^[a-z0-9-]{1,80}$/i.test(candidateId)) {
    throw new Error('Support cache candidate metadata is invalid.');
  }
  const candidateKey = `${SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX}${candidateId}`;
  const slot: SupportCacheSlot = {
    cacheSchemaVersion: 2,
    candidateId,
    cachedAt: normalizedCachedAt.toISOString(),
    responseRevision: parsed.fetchedAt,
    data: parsed,
  };
  await storage.setItem(candidateKey, JSON.stringify(slot));
  return {
    cacheSchemaVersion: 2,
    candidateId,
    candidateKey,
    cachedAt: slot.cachedAt,
    responseRevision: slot.responseRevision,
  };
}

export async function commitStagedSupportDirectory(
  candidate: StagedSupportDirectoryCache,
  storage: SupportCacheStoragePort = asyncStoragePort,
  committedAt = new Date().toISOString(),
): Promise<void> {
  await commitStagedSupportDirectoryIfAuthoritative(
    candidate,
    () => true,
    storage,
    committedAt,
  );
}

export async function commitStagedSupportDirectoryIfAuthoritative(
  candidate: StagedSupportDirectoryCache,
  isAuthoritative: () => boolean,
  storage: SupportCacheStoragePort = asyncStoragePort,
  committedAt = new Date().toISOString(),
): Promise<boolean> {
  const normalizedCommittedAt = new Date(committedAt);
  if (
    candidate.cacheSchemaVersion !== 2
    || candidate.candidateKey !== `${SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX}${candidate.candidateId}`
    || Number.isNaN(normalizedCommittedAt.getTime())
  ) throw new Error('Support cache commit metadata is invalid.');
  const head: SupportCacheHead = {
    cacheSchemaVersion: 2,
    candidateId: candidate.candidateId,
    candidateKey: candidate.candidateKey,
    committedAt: normalizedCommittedAt.toISOString(),
    responseRevision: candidate.responseRevision,
  };
  const previousHead = await storage.getItem(SUPPORT_DIRECTORY_CACHE_HEAD_KEY);
  if (!isAuthoritative()) return false;
  await storage.setItem(SUPPORT_DIRECTORY_CACHE_HEAD_KEY, JSON.stringify(head));
  if (isAuthoritative()) return true;

  // All app readers and head commits share the coordinator's serialized mutation
  // boundary. If authority changes while the physical write is pending, restore
  // the prior head before releasing that boundary so the stale head is never
  // observable as the committed cache.
  const currentHead = parseHead(await storage.getItem(SUPPORT_DIRECTORY_CACHE_HEAD_KEY));
  if (currentHead?.candidateId === candidate.candidateId) {
    if (previousHead === null) {
      await storage.removeItem(SUPPORT_DIRECTORY_CACHE_HEAD_KEY);
    } else {
      await storage.setItem(SUPPORT_DIRECTORY_CACHE_HEAD_KEY, previousHead);
    }
  }
  return false;
}

export async function saveCachedSupportDirectory(
  data: SupportDirectoryResponse,
  storage: SupportCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
): Promise<void> {
  const candidate = await stageCachedSupportDirectory(data, storage, cachedAt);
  await commitStagedSupportDirectory(candidate, storage, cachedAt);
}
