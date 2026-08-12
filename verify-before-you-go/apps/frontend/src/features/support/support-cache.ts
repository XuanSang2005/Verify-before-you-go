import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SupportDirectoryResponseSchema,
  type SupportDirectoryResponse,
} from '@vbyg/contracts';

export const SUPPORT_DIRECTORY_CACHE_KEY = '@vbyg/support-directory/v1';
export const SUPPORT_DIRECTORY_CACHE_HEAD_KEY = '@vbyg/support-directory/v2/head';
export const SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX = '@vbyg/support-directory/v3/snapshot/';
export const SUPPORT_DIRECTORY_CACHE_CONFLICT_PREFIX = '@vbyg/support-directory/v3/conflict/';

const SUPPORT_DIRECTORY_CACHE_CONFLICT_HORIZON_KEY = '@vbyg/support-directory/v3/conflict-horizon';
const SUPPORT_DIRECTORY_CACHE_V2_SLOT_PREFIX = '@vbyg/support-directory/v2/slot/';
const MAX_RETAINED_CONFLICT_MARKERS = 16;
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

type NormalizedRevision = {
  epochMs: number;
  iso: string;
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

type SupportCacheConflictMarker = {
  cacheSchemaVersion: 3;
  kind: 'revision-conflict';
  revision: string;
  revisionEpochMs: number;
};

type SupportCacheConflictHorizon = {
  cacheSchemaVersion: 3;
  kind: 'revision-conflict-horizon';
  rejectAtOrBefore: string;
  rejectAtOrBeforeEpochMs: number;
};

type ParsedSnapshot = {
  cache: CachedSupportDirectory;
  content: string;
  key: string;
  responseEpochMs: number;
  responseRevision: string;
};

type SnapshotConflict = {
  keys: string[];
  revision: NormalizedRevision;
};

type SnapshotAnalysis = {
  accepted: ParsedSnapshot[];
  conflicts: SnapshotConflict[];
  cleanupKeys: string[];
};

type ConflictState = {
  horizonEpochMs?: number;
  markers: Map<number, string>;
  runtimeRejected: Set<number>;
};

type CacheCandidate = {
  cache: CachedSupportDirectory;
  content: string;
  responseEpochMs: number;
  responseRevision: string;
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

export function normalizeSupportCacheRevision(value: string): string | null {
  const epochMs = new Date(value).getTime();
  return Number.isFinite(epochMs) ? new Date(epochMs).toISOString() : null;
}

function normalizeRevision(value: string): NormalizedRevision | null {
  const iso = normalizeSupportCacheRevision(value);
  if (!iso) return null;
  return { epochMs: new Date(iso).getTime(), iso };
}

function normalizeResponse(data: SupportDirectoryResponse) {
  const revision = normalizeRevision(data.fetchedAt);
  if (!revision) return null;
  const normalized: SupportDirectoryResponse = { ...data, fetchedAt: revision.iso };
  return { content: JSON.stringify(normalized), data: normalized, revision };
}

function hasExactKeys(value: object, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function conflictMarkerKey(epochMs: number) {
  return `${SUPPORT_DIRECTORY_CACHE_CONFLICT_PREFIX}${epochMs}`;
}

function parseCachedDirectory(raw: string | null): CacheCandidate | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.schemaVersion !== 1 || typeof value.cachedAt !== 'string') return null;
    const cachedAt = normalizeRevision(value.cachedAt);
    const parsed = SupportDirectoryResponseSchema.safeParse(value.data);
    if (!cachedAt || !parsed.success) return null;
    const normalized = normalizeResponse(parsed.data);
    if (!normalized) return null;
    return {
      cache: {
        schemaVersion: 1,
        cachedAt: cachedAt.iso,
        data: normalized.data,
      },
      content: normalized.content,
      responseEpochMs: normalized.revision.epochMs,
      responseRevision: normalized.revision.iso,
      source: 'v1',
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
      || !normalizeRevision(value.committedAt)
      || !normalizeRevision(value.responseRevision)
    ) return null;
    return value as SupportCacheV2Head;
  } catch {
    return null;
  }
}

function parseV2Slot(raw: string | null, head: SupportCacheV2Head): CacheCandidate | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SupportCacheV2Slot>;
    const cachedAt = typeof value.cachedAt === 'string' ? normalizeRevision(value.cachedAt) : null;
    const slotRevision = typeof value.responseRevision === 'string'
      ? normalizeRevision(value.responseRevision)
      : null;
    const headRevision = normalizeRevision(head.responseRevision);
    const parsed = SupportDirectoryResponseSchema.safeParse(value.data);
    if (
      value.cacheSchemaVersion !== 2
      || value.candidateId !== head.candidateId
      || !cachedAt
      || !slotRevision
      || !headRevision
      || slotRevision.epochMs !== headRevision.epochMs
      || !parsed.success
    ) return null;
    const normalized = normalizeResponse(parsed.data);
    if (!normalized || normalized.revision.epochMs !== headRevision.epochMs) return null;
    return {
      cache: {
        schemaVersion: 1,
        cachedAt: cachedAt.iso,
        data: normalized.data,
      },
      content: normalized.content,
      responseEpochMs: normalized.revision.epochMs,
      responseRevision: normalized.revision.iso,
      source: 'v2',
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
    const cachedAt = typeof value.cachedAt === 'string' ? normalizeRevision(value.cachedAt) : null;
    const storedRevision = typeof value.responseRevision === 'string'
      ? normalizeRevision(value.responseRevision)
      : null;
    const parsed = SupportDirectoryResponseSchema.safeParse(value.data);
    if (
      value.cacheSchemaVersion !== 3
      || value.snapshotId !== snapshotId
      || !cachedAt
      || !storedRevision
      || !parsed.success
    ) return null;
    const normalized = normalizeResponse(parsed.data);
    if (!normalized || normalized.revision.epochMs !== storedRevision.epochMs) return null;
    return {
      cache: {
        schemaVersion: 1,
        cachedAt: cachedAt.iso,
        data: normalized.data,
      },
      content: normalized.content,
      key,
      responseEpochMs: normalized.revision.epochMs,
      responseRevision: normalized.revision.iso,
    };
  } catch {
    return null;
  }
}

function parseConflictMarker(key: string, raw: string | null): SupportCacheConflictMarker | null {
  if (!raw || !key.startsWith(SUPPORT_DIRECTORY_CACHE_CONFLICT_PREFIX)) return null;
  try {
    const value = JSON.parse(raw) as Partial<SupportCacheConflictMarker>;
    const revision = typeof value.revision === 'string' ? normalizeRevision(value.revision) : null;
    if (
      !hasExactKeys(value, ['cacheSchemaVersion', 'kind', 'revision', 'revisionEpochMs'])
      || value.cacheSchemaVersion !== 3
      || value.kind !== 'revision-conflict'
      || !revision
      || value.revision !== revision.iso
      || value.revisionEpochMs !== revision.epochMs
      || key !== conflictMarkerKey(revision.epochMs)
    ) return null;
    return value as SupportCacheConflictMarker;
  } catch {
    return null;
  }
}

function parseConflictHorizon(raw: string | null): SupportCacheConflictHorizon | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SupportCacheConflictHorizon>;
    const revision = typeof value.rejectAtOrBefore === 'string'
      ? normalizeRevision(value.rejectAtOrBefore)
      : null;
    if (
      !hasExactKeys(value, ['cacheSchemaVersion', 'kind', 'rejectAtOrBefore', 'rejectAtOrBeforeEpochMs'])
      || value.cacheSchemaVersion !== 3
      || value.kind !== 'revision-conflict-horizon'
      || !revision
      || value.rejectAtOrBefore !== revision.iso
      || value.rejectAtOrBeforeEpochMs !== revision.epochMs
    ) return null;
    return value as SupportCacheConflictHorizon;
  } catch {
    return null;
  }
}

function analyzeSnapshots(snapshots: readonly ParsedSnapshot[]): SnapshotAnalysis {
  const byRevision = new Map<number, ParsedSnapshot[]>();
  for (const snapshot of snapshots) {
    const group = byRevision.get(snapshot.responseEpochMs) ?? [];
    group.push(snapshot);
    byRevision.set(snapshot.responseEpochMs, group);
  }

  const accepted: ParsedSnapshot[] = [];
  const cleanupKeys: string[] = [];
  const conflicts: SnapshotConflict[] = [];
  const epochs = [...byRevision.keys()].sort((left, right) => right - left);
  for (const epochMs of epochs) {
    const group = byRevision.get(epochMs) ?? [];
    if (new Set(group.map((snapshot) => snapshot.content)).size !== 1) {
      conflicts.push({
        keys: group.map((snapshot) => snapshot.key),
        revision: { epochMs, iso: new Date(epochMs).toISOString() },
      });
      continue;
    }
    group.sort((left, right) => left.key.localeCompare(right.key));
    const [selected, ...duplicates] = group;
    if (selected) accepted.push(selected);
    cleanupKeys.push(...duplicates.map((snapshot) => snapshot.key));
  }
  return { accepted, cleanupKeys, conflicts };
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

function isRejected(state: ConflictState, epochMs: number) {
  return state.runtimeRejected.has(epochMs)
    || state.markers.has(epochMs)
    || (state.horizonEpochMs !== undefined && epochMs <= state.horizonEpochMs);
}

async function readConflictState(
  storage: SupportCacheStoragePort,
  enumeratedKeys: readonly string[] = [],
): Promise<ConflictState> {
  const state: ConflictState = { markers: new Map(), runtimeRejected: new Set() };
  try {
    const horizon = parseConflictHorizon(
      await storage.getItem(SUPPORT_DIRECTORY_CACHE_CONFLICT_HORIZON_KEY),
    );
    if (horizon) state.horizonEpochMs = horizon.rejectAtOrBeforeEpochMs;
  } catch {
    // Exact markers and retained conflict evidence still fail closed.
  }
  for (const key of enumeratedKeys.filter((item) => item.startsWith(SUPPORT_DIRECTORY_CACHE_CONFLICT_PREFIX))) {
    try {
      const marker = parseConflictMarker(key, await storage.getItem(key));
      if (marker) state.markers.set(marker.revisionEpochMs, key);
    } catch {
      // One unreadable marker must not hide another durable rejection.
    }
  }
  return state;
}

async function persistConflictMarker(
  storage: SupportCacheStoragePort,
  state: ConflictState,
  revision: NormalizedRevision,
) {
  state.runtimeRejected.add(revision.epochMs);
  if (isRejected({ ...state, runtimeRejected: new Set() }, revision.epochMs)) return true;
  const key = conflictMarkerKey(revision.epochMs);
  const marker: SupportCacheConflictMarker = {
    cacheSchemaVersion: 3,
    kind: 'revision-conflict',
    revision: revision.iso,
    revisionEpochMs: revision.epochMs,
  };
  try {
    await storage.setItem(key, JSON.stringify(marker));
    const persisted = parseConflictMarker(key, await storage.getItem(key));
    if (!persisted) return false;
    state.markers.set(revision.epochMs, key);
    return true;
  } catch {
    return false;
  }
}

async function compactConflictMarkers(storage: SupportCacheStoragePort, state: ConflictState) {
  const markers = [...state.markers.entries()].sort(([left], [right]) => right - left);
  const redundant = markers.filter(([epochMs]) => (
    state.horizonEpochMs !== undefined && epochMs <= state.horizonEpochMs
  ));
  const active = markers.filter(([epochMs]) => (
    state.horizonEpochMs === undefined || epochMs > state.horizonEpochMs
  ));
  const evicted = active.slice(MAX_RETAINED_CONFLICT_MARKERS);
  if (evicted.length === 0) {
    await bestEffortRemove(storage, redundant.map(([, key]) => key));
    return;
  }

  const evictedHorizon = Math.max(...evicted.map(([epochMs]) => epochMs));
  const horizonEpochMs = Math.max(state.horizonEpochMs ?? Number.NEGATIVE_INFINITY, evictedHorizon);
  const horizon: SupportCacheConflictHorizon = {
    cacheSchemaVersion: 3,
    kind: 'revision-conflict-horizon',
    rejectAtOrBefore: new Date(horizonEpochMs).toISOString(),
    rejectAtOrBeforeEpochMs: horizonEpochMs,
  };
  try {
    await storage.setItem(SUPPORT_DIRECTORY_CACHE_CONFLICT_HORIZON_KEY, JSON.stringify(horizon));
    const persisted = parseConflictHorizon(
      await storage.getItem(SUPPORT_DIRECTORY_CACHE_CONFLICT_HORIZON_KEY),
    );
    if (!persisted || persisted.rejectAtOrBeforeEpochMs < horizonEpochMs) return;
    state.horizonEpochMs = persisted.rejectAtOrBeforeEpochMs;
    await bestEffortRemove(storage, [
      ...redundant.map(([, key]) => key),
      ...evicted.map(([, key]) => key),
    ]);
  } catch {
    // Never delete exact markers unless the bounded horizon is durable.
  }
}

async function prepareV3(
  storage: SupportCacheStoragePort,
  keys: readonly string[],
) {
  const snapshots: ParsedSnapshot[] = [];
  const invalidKeys: string[] = [];
  for (const key of keys.filter((item) => item.startsWith(SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX))) {
    try {
      const raw = await storage.getItem(key);
      const parsed = parseSnapshot(key, raw);
      if (parsed) snapshots.push(parsed);
      else if (raw !== null) invalidKeys.push(key);
    } catch {
      // One partial/unreadable slot must not hide another valid offline snapshot.
    }
  }

  const analysis = analyzeSnapshots(snapshots);
  const conflictState = await readConflictState(storage, keys);
  const cleanupKeys = [...invalidKeys, ...analysis.cleanupKeys];
  for (const conflict of analysis.conflicts) {
    const durable = await persistConflictMarker(storage, conflictState, conflict.revision);
    if (durable) cleanupKeys.push(...conflict.keys);
  }

  const accepted = analysis.accepted.filter((snapshot) => {
    if (isRejected(conflictState, snapshot.responseEpochMs)) {
      cleanupKeys.push(snapshot.key);
      return false;
    }
    return true;
  });
  accepted.sort((left, right) => right.responseEpochMs - left.responseEpochMs);
  const retained = accepted.slice(0, MAX_RETAINED_SNAPSHOTS);
  cleanupKeys.push(...accepted.slice(MAX_RETAINED_SNAPSHOTS).map((snapshot) => snapshot.key));
  await compactConflictMarkers(storage, conflictState);
  await bestEffortRemove(storage, cleanupKeys);
  return { conflictState, retained };
}

async function readLegacyCandidates(storage: SupportCacheStoragePort) {
  const candidates: CacheCandidate[] = [];
  try {
    const v2Head = parseV2Head(await storage.getItem(SUPPORT_DIRECTORY_CACHE_HEAD_KEY));
    if (v2Head) {
      const v2 = parseV2Slot(await storage.getItem(v2Head.candidateKey), v2Head);
      if (v2) candidates.push(v2);
    }
  } catch {
    // Continue to the independently addressable v1 cache.
  }
  try {
    const v1 = parseCachedDirectory(await storage.getItem(SUPPORT_DIRECTORY_CACHE_KEY));
    if (v1) candidates.push(v1);
  } catch {
    // The caller will use another valid candidate or preserve the storage error.
  }
  return candidates;
}

async function refreshDirectConflictEvidence(
  storage: SupportCacheStoragePort,
  state: ConflictState,
  candidates: readonly CacheCandidate[],
) {
  for (const candidate of candidates) {
    if (isRejected(state, candidate.responseEpochMs)) continue;
    const key = conflictMarkerKey(candidate.responseEpochMs);
    try {
      const marker = parseConflictMarker(key, await storage.getItem(key));
      if (marker) state.markers.set(marker.revisionEpochMs, key);
    } catch {
      // A readable candidate remains available when marker storage is unavailable.
    }
  }
}

async function persistCandidateConflicts(
  storage: SupportCacheStoragePort,
  state: ConflictState,
  candidates: readonly CacheCandidate[],
) {
  const byRevision = new Map<number, CacheCandidate[]>();
  for (const candidate of candidates) {
    const group = byRevision.get(candidate.responseEpochMs) ?? [];
    group.push(candidate);
    byRevision.set(candidate.responseEpochMs, group);
  }
  for (const [epochMs, group] of byRevision) {
    if (new Set(group.map((candidate) => candidate.content)).size > 1) {
      await persistConflictMarker(storage, state, {
        epochMs,
        iso: new Date(epochMs).toISOString(),
      });
    }
  }
  await compactConflictMarkers(storage, state);
}

function selectCacheCandidate(
  candidates: readonly CacheCandidate[],
  conflictState: ConflictState,
): CacheCandidate | null {
  const byRevision = new Map<number, CacheCandidate[]>();
  for (const candidate of candidates) {
    if (isRejected(conflictState, candidate.responseEpochMs)) continue;
    const group = byRevision.get(candidate.responseEpochMs) ?? [];
    group.push(candidate);
    byRevision.set(candidate.responseEpochMs, group);
  }

  const epochs = [...byRevision.keys()].sort((left, right) => right - left);
  for (const epochMs of epochs) {
    const group = byRevision.get(epochMs) ?? [];
    if (new Set(group.map((candidate) => candidate.content)).size !== 1) continue;
    const sourceRank = { v1: 1, v2: 2, v3: 3 } as const;
    group.sort((left, right) => sourceRank[right.source] - sourceRank[left.source]);
    if (group[0]) return group[0];
  }
  return null;
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
  let enumerationError: unknown;
  let v3Candidates: CacheCandidate[] = [];
  let conflictState: ConflictState;
  try {
    const keys = await storage.getAllKeys();
    const prepared = await prepareV3(storage, keys);
    conflictState = prepared.conflictState;
    v3Candidates = prepared.retained.map((snapshot) => ({
      cache: snapshot.cache,
      content: snapshot.content,
      responseEpochMs: snapshot.responseEpochMs,
      responseRevision: snapshot.responseRevision,
      source: 'v3',
    }));
  } catch (error) {
    enumerationError = error;
    conflictState = await readConflictState(storage);
  }

  const legacyCandidates = await readLegacyCandidates(storage);
  const candidates = [...v3Candidates, ...legacyCandidates];
  await refreshDirectConflictEvidence(storage, conflictState, candidates);
  await persistCandidateConflicts(storage, conflictState, candidates);
  const selected = selectCacheCandidate(candidates, conflictState);
  if (selected && selected.source !== 'v3') await bestEffortMigrate(selected.cache, storage);
  if (!selected && enumerationError) throw enumerationError;
  return selected?.cache ?? null;
}

export async function stageCachedSupportDirectory(
  data: SupportDirectoryResponse,
  storage: SupportCacheStoragePort = asyncStoragePort,
  cachedAt = new Date().toISOString(),
  candidateId = createCandidateId(),
): Promise<StagedSupportDirectoryCache> {
  const parsed = SupportDirectoryResponseSchema.parse(data);
  const normalized = normalizeResponse(parsed);
  const normalizedCachedAt = normalizeRevision(cachedAt);
  if (!normalized || !normalizedCachedAt || !/^[a-z0-9-]{1,100}$/i.test(candidateId)) {
    throw new Error('Support cache snapshot metadata is invalid.');
  }
  const candidateKey = `${SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX}${candidateId}`;
  const snapshot: SupportCacheSnapshot = {
    cacheSchemaVersion: 3,
    snapshotId: candidateId,
    cachedAt: normalizedCachedAt.iso,
    responseRevision: normalized.revision.iso,
    data: normalized.data,
  };
  await storage.setItem(candidateKey, JSON.stringify(snapshot));
  try {
    await prepareV3(storage, await storage.getAllKeys());
  } catch {
    // The complete immutable snapshot is durable even when pruning is unavailable.
  }
  return {
    cacheSchemaVersion: 3,
    candidateId,
    candidateKey,
    cachedAt: snapshot.cachedAt,
    payloadCanonical: normalized.content,
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
    const prepared = await prepareV3(storage, await storage.getAllKeys());
    equivalentSnapshotRetained = prepared.retained.some((snapshot) => (
      snapshot.responseRevision === candidate.responseRevision
      && snapshot.content === candidate.payloadCanonical
    ));
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
