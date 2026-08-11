import { CHECKLIST_ITEM_IDS, type ChecklistItemId } from './checklist-items';

export const CHECKLIST_SCHEMA_VERSION = 2 as const;

export const CHECKLIST_ITEM_STATES = ['untouched', 'verified', 'unverified'] as const;
export type ChecklistItemState = (typeof CHECKLIST_ITEM_STATES)[number];

export interface ChecklistItemProgress {
  id: ChecklistItemId;
  state: ChecklistItemState;
  updatedAt: string;
}

export interface ChecklistProgress {
  schemaVersion: typeof CHECKLIST_SCHEMA_VERSION;
  items: ChecklistItemProgress[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type ChecklistParseStatus = 'empty' | 'valid' | 'migrated' | 'recovered';

export interface ChecklistParseResult {
  progress: ChecklistProgress;
  status: ChecklistParseStatus;
}

export function createEmptyChecklistProgress(timestamp = new Date().toISOString()): ChecklistProgress {
  return {
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    items: CHECKLIST_ITEM_IDS.map((id) => ({ id, state: 'untouched', updatedAt: timestamp })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getChecklistReviewedCount(progress: ChecklistProgress): number {
  return progress.items.filter((item) => item.state !== 'untouched').length;
}

export function getChecklistVerifiedCount(progress: ChecklistProgress): number {
  return progress.items.filter((item) => item.state === 'verified').length;
}

export function getChecklistUnverifiedCount(progress: ChecklistProgress): number {
  return progress.items.filter((item) => item.state === 'unverified').length;
}

export function isChecklistComplete(progress: ChecklistProgress): boolean {
  return getChecklistReviewedCount(progress) === CHECKLIST_ITEM_IDS.length;
}

export function setChecklistItemState(
  progress: ChecklistProgress,
  id: ChecklistItemId,
  state: ChecklistItemState,
  timestamp = new Date().toISOString(),
): ChecklistProgress {
  const items = progress.items.map((item) => (
    item.id === id ? { ...item, state, updatedAt: timestamp } : item
  ));
  return buildProgress(progress.createdAt, items, timestamp, progress.completedAt);
}

export function toggleChecklistItemState(
  progress: ChecklistProgress,
  id: ChecklistItemId,
  state: Exclude<ChecklistItemState, 'untouched'>,
  timestamp = new Date().toISOString(),
): ChecklistProgress {
  const current = progress.items.find((item) => item.id === id)?.state ?? 'untouched';
  return setChecklistItemState(progress, id, current === state ? 'untouched' : state, timestamp);
}

export function resetChecklistProgress(
  progress: ChecklistProgress,
  timestamp = new Date().toISOString(),
): ChecklistProgress {
  return {
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    items: CHECKLIST_ITEM_IDS.map((id) => ({ id, state: 'untouched', updatedAt: timestamp })),
    createdAt: progress.createdAt,
    updatedAt: timestamp,
  };
}

export function mergeChecklistSessionEdits(
  stored: ChecklistProgress,
  session: ChecklistProgress,
  editedItemIds: ReadonlySet<ChecklistItemId>,
): ChecklistProgress {
  if (editedItemIds.size === 0) return stored;

  const sessionById = new Map(session.items.map((item) => [item.id, item]));
  const items = stored.items.map((item) => (
    editedItemIds.has(item.id) ? sessionById.get(item.id) ?? item : item
  ));
  const updatedAt = latestTimestamp([
    stored.updatedAt,
    ...items.filter((item) => editedItemIds.has(item.id)).map((item) => item.updatedAt),
  ]);

  return buildProgress(stored.createdAt, items, updatedAt, stored.completedAt);
}

export function serializeChecklistProgress(progress: ChecklistProgress): string {
  return JSON.stringify({
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    items: progress.items.map(({ id, state, updatedAt }) => ({ id, state, updatedAt })),
    createdAt: progress.createdAt,
    updatedAt: progress.updatedAt,
    ...(progress.completedAt ? { completedAt: progress.completedAt } : {}),
  });
}

export function parseChecklistProgress(
  raw: string | null,
  fallbackTimestamp = new Date().toISOString(),
): ChecklistParseResult {
  if (!raw) return { progress: createEmptyChecklistProgress(fallbackTimestamp), status: 'empty' };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return recovered(fallbackTimestamp);

    if (parsed.schemaVersion === CHECKLIST_SCHEMA_VERSION) {
      const progress = parseVersionTwo(parsed);
      return progress ? { progress, status: 'valid' } : recovered(fallbackTimestamp);
    }

    if (parsed.schemaVersion === 1) {
      const progress = migrateVersionOne(parsed);
      return progress ? { progress, status: 'migrated' } : recovered(fallbackTimestamp);
    }

    if (parsed.schemaVersion === 0) {
      const progress = migrateVersionZero(parsed, fallbackTimestamp);
      return progress ? { progress, status: 'migrated' } : recovered(fallbackTimestamp);
    }

    return recovered(fallbackTimestamp);
  } catch {
    return recovered(fallbackTimestamp);
  }
}

function parseVersionTwo(record: Record<string, unknown>): ChecklistProgress | undefined {
  if (!Array.isArray(record.items) || record.items.length !== CHECKLIST_ITEM_IDS.length) return undefined;
  if (!isTimestamp(record.createdAt) || !isTimestamp(record.updatedAt)) return undefined;
  if (record.completedAt !== undefined && !isTimestamp(record.completedAt)) return undefined;

  const items: ChecklistItemProgress[] = [];
  const seen = new Set<ChecklistItemId>();
  for (const candidate of record.items) {
    if (!isRecord(candidate)) return undefined;
    if (!isChecklistItemId(candidate.id) || seen.has(candidate.id)) return undefined;
    if (!isChecklistItemState(candidate.state) || !isTimestamp(candidate.updatedAt)) return undefined;
    seen.add(candidate.id);
    items.push({ id: candidate.id, state: candidate.state, updatedAt: candidate.updatedAt });
  }

  if (CHECKLIST_ITEM_IDS.some((id) => !seen.has(id))) return undefined;
  const orderedItems = CHECKLIST_ITEM_IDS.map((id) => items.find((item) => item.id === id)!);
  const complete = orderedItems.every((item) => item.state !== 'untouched');
  if (complete !== Boolean(record.completedAt)) return undefined;

  return {
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    items: orderedItems,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(typeof record.completedAt === 'string' ? { completedAt: record.completedAt } : {}),
  };
}

function migrateVersionOne(record: Record<string, unknown>): ChecklistProgress | undefined {
  if (!Array.isArray(record.items) || record.items.length !== CHECKLIST_ITEM_IDS.length) return undefined;
  if (!isTimestamp(record.createdAt) || !isTimestamp(record.updatedAt)) return undefined;

  const migratedItems: ChecklistItemProgress[] = [];
  const seen = new Set<ChecklistItemId>();
  for (const candidate of record.items) {
    if (!isRecord(candidate)) return undefined;
    if (!isChecklistItemId(candidate.id) || seen.has(candidate.id)) return undefined;
    if (typeof candidate.completed !== 'boolean' || !isTimestamp(candidate.updatedAt)) return undefined;
    seen.add(candidate.id);
    migratedItems.push({
      id: candidate.id,
      state: candidate.completed ? 'verified' : 'untouched',
      updatedAt: candidate.updatedAt,
    });
  }

  if (CHECKLIST_ITEM_IDS.some((id) => !seen.has(id))) return undefined;
  const items = CHECKLIST_ITEM_IDS.map((id) => migratedItems.find((item) => item.id === id)!);
  return buildProgress(record.createdAt, items, record.updatedAt);
}

function migrateVersionZero(
  record: Record<string, unknown>,
  fallbackTimestamp: string,
): ChecklistProgress | undefined {
  if (!Array.isArray(record.checkedItemIds)) return undefined;
  if (!record.checkedItemIds.every(isChecklistItemId)) return undefined;
  const uniqueIds = new Set(record.checkedItemIds);
  if (uniqueIds.size !== record.checkedItemIds.length) return undefined;
  const timestamp = isTimestamp(record.updatedAt) ? record.updatedAt : fallbackTimestamp;
  const createdAt = isTimestamp(record.createdAt) ? record.createdAt : timestamp;
  const items: ChecklistItemProgress[] = CHECKLIST_ITEM_IDS.map((id) => ({
    id,
    state: uniqueIds.has(id) ? 'verified' : 'untouched',
    updatedAt: timestamp,
  }));

  return buildProgress(createdAt, items, timestamp);
}

function buildProgress(
  createdAt: string,
  items: ChecklistItemProgress[],
  updatedAt: string,
  previousCompletedAt?: string,
): ChecklistProgress {
  const complete = items.every((item) => item.state !== 'untouched');
  return {
    schemaVersion: CHECKLIST_SCHEMA_VERSION,
    items,
    createdAt,
    updatedAt,
    ...(complete ? { completedAt: previousCompletedAt ?? updatedAt } : {}),
  };
}

function latestTimestamp(timestamps: readonly string[]): string {
  return timestamps.reduce((latest, candidate) => (
    Date.parse(candidate) > Date.parse(latest) ? candidate : latest
  ));
}

function recovered(timestamp: string): ChecklistParseResult {
  return { progress: createEmptyChecklistProgress(timestamp), status: 'recovered' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isChecklistItemId(value: unknown): value is ChecklistItemId {
  return typeof value === 'string' && CHECKLIST_ITEM_IDS.includes(value as ChecklistItemId);
}

function isChecklistItemState(value: unknown): value is ChecklistItemState {
  return typeof value === 'string' && CHECKLIST_ITEM_STATES.includes(value as ChecklistItemState);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
