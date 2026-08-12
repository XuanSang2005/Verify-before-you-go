import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SupportDirectoryResponseSchema,
  type SupportDirectoryResponse,
} from '@vbyg/contracts';

export const SUPPORT_DIRECTORY_CACHE_KEY = '@vbyg/support-directory/v1';
export const SUPPORT_DIRECTORY_CACHE_HEAD_KEY = '@vbyg/support-directory/v2/head';
export const SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX = '@vbyg/support-directory/v3/snapshot/';

const SUPPORT_DIRECTORY_CACHE_V2_SLOT_PREFIX = '@vbyg/support-directory/v2/slot/';
const MAX_RETAINED_SNAPSHOTS = 3;

export interface SupportCacheStoragePort {
  getAllKeys: () => Promise<readonly string[]>;
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
  cacheSchemaVersion: 3;
  candidateId: string;
  candidateKey: string;
  cachedAt: string;
  payloadCanonical: string;
  responseRevision: string;
};

type SupportCacheV2Head = {
  cacheSchemaVersion: 2;
  candidateId: string;
  candidateKey: string;
  committedAt: string;
  responseRevision: string;
};

type SupportCacheV2Slot = {
  cacheSchemaVersion: 2;
  candidateId: string;
  cachedAt: string;
  responseRevision: string;
  data: SupportDirectoryResponse;
};

type SupportCacheSnapshot = {
  cacheSchemaVersion: 3;
  snapshotId: string;
  cachedAt: string;
  responseRevision: string;
  data: SupportDirectoryResponse;
};

type ParsedSnapshot = {
  cache: CachedSupportDirectory;
  content: string;
  key: string;
  responseRevision: string;
};

type CacheCandidate = {
  cache: CachedSupportDirectory;
  content: string;
  source: 'v1' | 'v2' | 'v3';
};

const asyncStoragePort: SupportCacheStoragePort = {
  getAllKeys: () => AsyncStorage.getAllKeys(),
  getItem: (key) => AsyncStorage.getItem(key),
  removeItem: (key) => AsyncStorage.removeItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

let candidateSequence = 0;

function createCandidateId() {
  candidateSequence += 1;
  return `${Date.now().toString(36)}-${candidateSequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
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

function parseV2Head(raw: string | null): SupportCacheV2Head | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SupportCacheV2Head>;
    if (
      value.cacheSchemaVersion !== 2
      || typeof value.candidateId !== 'string'
      || typeof value.candidateKey !== 'string'
      || typeof value.committedAt !== 'string'
      || typeof value.responseRevision !== 'string'
      || value.candidateKey !== `${SUPPORT_DIRECTORY_CACHE_V2_SLOT_PREFIX}${value.candidateId}`
      || Number.isNaN(new Date(value.committedAt).getTime())
      || Number.isNaN(new Date(value.responseRevision).getTime())
    ) return null;
    return value as SupportCacheV2Head;
  } catch {
    return null;
  }
}

function parseV2Slot(raw: string | null, head: SupportCacheV2Head): CachedSupportDirectory | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SupportCacheV2Slot>;
    const cachedAt = typeof value.cachedAt === 'string' ? new Date(value.cachedAt) : null;
    const parsed = SupportDirectoryResponseSchema.safeParse(value.data);
    if (
      value.cacheSchemaVersion !== 2
      || value.candidateId !== head.candidateId
      || value.responseRevision !== head.responseRevision
      || !parsed.success
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

function parseSnapshot(key: string, raw: string | null): ParsedSnapshot | null {
  if (!raw || !key.startsWith(SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX)) return null;
  try {
    const value = JSON.parse(raw) as Partial<SupportCacheSnapshot>;
    const snapshotId = key.slice(SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX.length);
    const cachedAt = typeof value.cachedAt === 'string' ? new Date(value.cachedAt) : null;
    const parsed = SupportDirectoryResponseSchema.safeParse(value.data);
    if (!parsed.success) return null;
    if (
      value.cacheSchemaVersion !== 3
      || value.snapshotId !== snapshotId
      || value.responseRevision !== parsed.data.fetchedAt
      || !cachedAt
      || Number.isNaN(cachedAt.getTime())
    ) return null;
    return {
      cache: {
        schemaVersion: 1,
        cachedAt: cachedAt.toISOString(),
        data: parsed.data,
      },
      content: JSON.stringify(parsed.data),
      key,
      responseRevision: parsed.data.fetchedAt,
    };
  } catch {
    return null;
  }
}

function selectSnapshots(snapshots: readonly ParsedSnapshot[]) {
  const byRevision = new Map<string, ParsedSnapshot[]>();
  for (const snapshot of snapshots) {
    const group = byRevision.get(snapshot.responseRevision) ?? [];
    group.push(snapshot);
    byRevision.set(snapshot.responseRevision, group);
  }

  const accepted: ParsedSnapshot[] = [];
  const obsoleteKeys: string[] = [];
  const rejectedRevisions = new Set<string>();
  const revisions = [...byRevision.keys()].sort((left, right) => right.localeCompare(left));
  for (const revision of revisions) {
    const group = byRevision.get(revision) ?? [];
    const contents = new Set(group.map((snapshot) => snapshot.content));
    if (contents.size !== 1) {
      // Same server revision with different strict payloads is ambiguous. Reject
      // the whole revision instead of letting completion order choose a winner.
      obsoleteKeys.push(...group.map((snapshot) => snapshot.key));
      rejectedRevisions.add(revision);
      continue;
    }
    group.sort((left, right) => left.key.localeCompare(right.key));
    const [selected, ...duplicates] = group;
    if (selected) accepted.push(selected);
    obsoleteKeys.push(...duplicates.map((snapshot) => snapshot.key));
  }

  const retained = accepted.slice(0, MAX_RETAINED_SNAPSHOTS);
  obsoleteKeys.push(...accepted.slice(MAX_RETAINED_SNAPSHOTS).map((snapshot) => snapshot.key));
  return { obsoleteKeys, rejectedRevisions, retained };
}

async function readSnapshots(storage: SupportCacheStoragePort) {
  const keys = (await storage.getAllKeys())
    .filter((key) => key.startsWith(SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX));
  const snapshots: ParsedSnapshot[] = [];
  const invalidKeys: string[] = [];
  for (const key of keys) {
    try {
      const raw = await storage.getItem(key);
      const parsed = parseSnapshot(key, raw);
      if (parsed) snapshots.push(parsed);
      else if (raw !== null) invalidKeys.push(key);
    } catch {
      // One partial/unreadable slot must not hide another valid offline snapshot.
    }
  }
  const selection = selectSnapshots(snapshots);
  selection.obsoleteKeys.push(...invalidKeys);
  return selection;
}

function selectCacheCandidate(
  candidates: readonly CacheCandidate[],
  rejectedRevisions: ReadonlySet<string>,
): CacheCandidate | null {
  const byRevision = new Map<string, CacheCandidate[]>();
  for (const candidate of candidates) {
    const revision = candidate.cache.data.fetchedAt;
    if (rejectedRevisions.has(revision)) continue;
    const group = byRevision.get(revision) ?? [];
    group.push(candidate);
    byRevision.set(revision, group);
  }

  const revisions = [...byRevision.keys()].sort((left, right) => right.localeCompare(left));
  for (const revision of revisions) {
    const group = byRevision.get(revision) ?? [];
    if (new Set(group.map((candidate) => candidate.content)).size !== 1) continue;
    const sourceRank = { v1: 1, v2: 2, v3: 3 } as const;
    group.sort((left, right) => sourceRank[right.source] - sourceRank[left.source]);
    if (group[0]) return group[0];
  }
  return null;
}

async function bestEffortRemove(storage: SupportCacheStoragePort, keys: readonly string[]) {
  await Promise.all(keys.map(async (key) => {
    try {
      await storage.removeItem(key);
    } catch {
      // Cleanup never owns cache correctness and must not break loading/saving.
    }
  }));
}

async function bestEffortMigrate(
  cache: CachedSupportDirectory,
  storage: SupportCacheStoragePort,
) {
  try {
    await saveCachedSupportDirectory(cache.data, storage, cache.cachedAt);
  } catch {
    // Keep the readable legacy snapshot until a future v3 save succeeds.
  }
}

export async function loadCachedSupportDirectory(
  storage: SupportCacheStoragePort = asyncStoragePort,
): Promise<CachedSupportDirectory | null> {
  const snapshots = await readSnapshots(storage);
  await bestEffortRemove(storage, snapshots.obsoleteKeys);
  const candidates: CacheCandidate[] = snapshots.retained.map((snapshot) => ({
    cache: snapshot.cache,
    content: snapshot.content,
    source: 'v3',
  }));

  try {
    const v2Head = parseV2Head(await storage.getItem(SUPPORT_DIRECTORY_CACHE_HEAD_KEY));
    if (v2Head) {
      const v2Cache = parseV2Slot(await storage.getItem(v2Head.candidateKey), v2Head);
      if (v2Cache) candidates.push({
        cache: v2Cache,
        content: JSON.stringify(v2Cache.data),
        source: 'v2',
      });
    }
  } catch {
    // A legacy read failure cannot hide a valid immutable v3 snapshot.
  }
  try {
    const legacy = parseCachedDirectory(await storage.getItem(SUPPORT_DIRECTORY_CACHE_KEY));
    if (legacy) candidates.push({
      cache: legacy,
      content: JSON.stringify(legacy.data),
      source: 'v1',
    });
  } catch {
    // A legacy read failure cannot hide a valid immutable v3 snapshot.
  }

  const selected = selectCacheCandidate(candidates, snapshots.rejectedRevisions);
  if (selected && selected.source !== 'v3') await bestEffortMigrate(selected.cache, storage);
  return selected?.cache ?? null;
}

export async function stageCachedSupportDirectory(
  data: SupportDirectoryResponse,
  storage: SupportCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
  candidateId = createCandidateId(),
): Promise<StagedSupportDirectoryCache> {
  const parsed = SupportDirectoryResponseSchema.parse(data);
  const normalizedCachedAt = new Date(cachedAt);
  if (Number.isNaN(normalizedCachedAt.getTime()) || !/^[a-z0-9-]{1,100}$/i.test(candidateId)) {
    throw new Error('Support cache snapshot metadata is invalid.');
  }
  const candidateKey = `${SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX}${candidateId}`;
  const snapshot: SupportCacheSnapshot = {
    cacheSchemaVersion: 3,
    snapshotId: candidateId,
    cachedAt: normalizedCachedAt.toISOString(),
    responseRevision: parsed.fetchedAt,
    data: parsed,
  };
  await storage.setItem(candidateKey, JSON.stringify(snapshot));
  try {
    const current = await readSnapshots(storage);
    await bestEffortRemove(storage, current.obsoleteKeys);
  } catch {
    // The complete immutable snapshot is durable even when pruning is unavailable.
  }
  return {
    cacheSchemaVersion: 3,
    candidateId,
    candidateKey,
    cachedAt: snapshot.cachedAt,
    payloadCanonical: JSON.stringify(parsed),
    responseRevision: snapshot.responseRevision,
  };
}

export async function commitStagedSupportDirectory(
  candidate: StagedSupportDirectoryCache,
  storage: SupportCacheStoragePort = asyncStoragePort,
): Promise<void> {
  await commitStagedSupportDirectoryIfAuthoritative(candidate, () => true, storage);
}

export async function commitStagedSupportDirectoryIfAuthoritative(
  candidate: StagedSupportDirectoryCache,
  isAuthoritative: () => boolean,
  storage: SupportCacheStoragePort = asyncStoragePort,
): Promise<boolean> {
  if (
    candidate.cacheSchemaVersion !== 3
    || candidate.candidateKey !== `${SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX}${candidate.candidateId}`
  ) throw new Error('Support cache commit metadata is invalid.');

  const authoritativeBeforeCleanup = isAuthoritative();
  let equivalentSnapshotRetained = false;
  try {
    const current = await readSnapshots(storage);
    equivalentSnapshotRetained = current.retained.some((snapshot) => (
      snapshot.responseRevision === candidate.responseRevision
      && snapshot.content === candidate.payloadCanonical
    ));
    await bestEffortRemove(storage, current.obsoleteKeys);
  } catch {
    // Snapshot selection, not cleanup, provides correctness.
  }
  return equivalentSnapshotRetained && authoritativeBeforeCleanup && isAuthoritative();
}

export async function saveCachedSupportDirectory(
  data: SupportDirectoryResponse,
  storage: SupportCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
): Promise<void> {
  const candidate = await stageCachedSupportDirectory(data, storage, cachedAt);
  await commitStagedSupportDirectory(candidate, storage);
}
