import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  mergeChecklistSessionEdits,
  parseChecklistProgress,
  serializeChecklistProgress,
  type ChecklistParseStatus,
  type ChecklistProgress,
} from './checklist-model';
import type { ChecklistItemId } from './checklist-items';

export const CHECKLIST_STORAGE_KEY = '@vbyg/verification-checklist/v2';
export const LEGACY_CHECKLIST_STORAGE_KEY = '@vbyg/verification-checklist/v1';

export interface ChecklistStoragePort {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export interface LoadedChecklistProgress {
  progress: ChecklistProgress;
  status: ChecklistParseStatus;
}

const asyncStoragePort: ChecklistStoragePort = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

export async function loadChecklistProgress(
  storage: ChecklistStoragePort = asyncStoragePort,
  fallbackTimestamp?: string,
): Promise<LoadedChecklistProgress> {
  const currentRaw = await storage.getItem(CHECKLIST_STORAGE_KEY);
  const legacyRaw = currentRaw === null
    ? await storage.getItem(LEGACY_CHECKLIST_STORAGE_KEY)
    : null;
  const raw = currentRaw ?? legacyRaw;
  const result = parseChecklistProgress(raw, fallbackTimestamp);
  const canonical = serializeChecklistProgress(result.progress);

  if (legacyRaw !== null || result.status === 'migrated' || result.status === 'recovered' || (currentRaw && currentRaw !== canonical)) {
    await storage.setItem(CHECKLIST_STORAGE_KEY, canonical);
  }

  return result;
}

export async function saveChecklistProgress(
  progress: ChecklistProgress,
  storage: ChecklistStoragePort = asyncStoragePort,
): Promise<void> {
  await storage.setItem(CHECKLIST_STORAGE_KEY, serializeChecklistProgress(progress));
}

export async function saveChecklistProgressAfterConfirmedRead(
  progress: ChecklistProgress,
  storageReadSucceeded: boolean,
  storage: ChecklistStoragePort = asyncStoragePort,
): Promise<'deferred' | 'saved'> {
  if (!storageReadSucceeded) return 'deferred';
  await saveChecklistProgress(progress, storage);
  return 'saved';
}

export async function retryChecklistReadAndMergeSession(
  sessionProgress: ChecklistProgress,
  editedItemIds: ReadonlySet<ChecklistItemId>,
  storage: ChecklistStoragePort = asyncStoragePort,
  fallbackTimestamp?: string,
): Promise<LoadedChecklistProgress> {
  const loaded = await loadChecklistProgress(storage, fallbackTimestamp);
  const progress = mergeChecklistSessionEdits(loaded.progress, sessionProgress, editedItemIds);

  if (editedItemIds.size > 0) {
    await saveChecklistProgress(progress, storage);
  }

  return { progress, status: loaded.status };
}
