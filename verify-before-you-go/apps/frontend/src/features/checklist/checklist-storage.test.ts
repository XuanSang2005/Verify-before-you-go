import assert from 'node:assert/strict';
import test from 'node:test';

import { CHECKLIST_ITEM_IDS } from './checklist-items';
import {
  createEmptyChecklistProgress,
  getChecklistReviewedCount,
  serializeChecklistProgress,
  setChecklistItemState,
} from './checklist-model';
import {
  CHECKLIST_STORAGE_KEY,
  LEGACY_CHECKLIST_STORAGE_KEY,
  loadChecklistProgress,
  retryChecklistReadAndMergeSession,
  saveChecklistProgress,
  saveChecklistProgressAfterConfirmedRead,
  type ChecklistStoragePort,
} from './checklist-storage';

class MemoryChecklistStorage implements ChecklistStoragePort {
  values = new Map<string, string>();
  getFailuresRemaining = 0;
  setFailuresRemaining = 0;
  setCalls = 0;

  async getItem(key: string) {
    if (this.getFailuresRemaining > 0) {
      this.getFailuresRemaining -= 1;
      throw new Error('read failed');
    }
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.setCalls += 1;
    if (this.setFailuresRemaining > 0) {
      this.setFailuresRemaining -= 1;
      throw new Error('write failed');
    }
    this.values.set(key, value);
  }
}

test('persists schema v2 progress across remount without offer content', async () => {
  const storage = new MemoryChecklistStorage();
  const initial = createEmptyChecklistProgress('2026-08-09T10:00:00.000Z');
  const reviewed = setChecklistItemState(initial, CHECKLIST_ITEM_IDS[1], 'unverified', '2026-08-09T10:01:00.000Z');

  await saveChecklistProgress(reviewed, storage);
  const remounted = await loadChecklistProgress(storage, '2026-08-09T10:02:00.000Z');
  const serialized = storage.values.get(CHECKLIST_STORAGE_KEY) ?? '';
  const parsed = JSON.parse(serialized) as Record<string, unknown>;

  assert.equal(remounted.status, 'valid');
  assert.equal(remounted.progress.schemaVersion, 2);
  assert.equal(getChecklistReviewedCount(remounted.progress), 1);
  assert.equal(remounted.progress.items[1]?.state, 'unverified');
  assert.deepEqual(Object.keys(parsed).sort(), ['createdAt', 'items', 'schemaVersion', 'updatedAt']);
  assert.doesNotMatch(serialized, /posting|screenshot|evidence|recruitmentLink|passport scan/i);
});

test('migrates legacy schema v1 completed booleans into the v2 storage key', async () => {
  const storage = new MemoryChecklistStorage();
  storage.values.set(LEGACY_CHECKLIST_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    items: CHECKLIST_ITEM_IDS.map((id, index) => ({
      id,
      completed: index === 0 || index === 3,
      updatedAt: `2026-08-09T10:0${index}:00.000Z`,
    })),
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-09T10:05:00.000Z',
  }));

  const result = await loadChecklistProgress(storage);
  const canonical = JSON.parse(storage.values.get(CHECKLIST_STORAGE_KEY) ?? '{}') as {
    schemaVersion?: number;
    items?: { state?: string; completed?: boolean }[];
  };

  assert.equal(result.status, 'migrated');
  assert.equal(result.progress.schemaVersion, 2);
  assert.equal(getChecklistReviewedCount(result.progress), 2);
  assert.equal(canonical.schemaVersion, 2);
  assert.deepEqual(canonical.items?.map((item) => item.state), [
    'verified', 'untouched', 'untouched', 'verified', 'untouched',
  ]);
  assert.ok(canonical.items?.every((item) => item.completed === undefined));
});

test('a failed initial read cannot overwrite existing data', async () => {
  const storage = new MemoryChecklistStorage();
  const saved = setChecklistItemState(
    createEmptyChecklistProgress('2026-08-09T10:00:00.000Z'),
    CHECKLIST_ITEM_IDS[1],
    'verified',
    '2026-08-09T10:01:00.000Z',
  );
  const originalRaw = serializeChecklistProgress(saved);
  storage.values.set(CHECKLIST_STORAGE_KEY, originalRaw);
  storage.getFailuresRemaining = 1;

  await assert.rejects(() => loadChecklistProgress(storage), /read failed/);
  const session = setChecklistItemState(
    createEmptyChecklistProgress('2026-08-09T10:00:00.000Z'),
    CHECKLIST_ITEM_IDS[0],
    'unverified',
    '2026-08-09T10:02:00.000Z',
  );
  const deferred = await saveChecklistProgressAfterConfirmedRead(session, false, storage);

  assert.equal(deferred, 'deferred');
  assert.equal(storage.setCalls, 0);
  assert.equal(storage.values.get(CHECKLIST_STORAGE_KEY), originalRaw);
});

test('retry after read failure merges session changes without losing saved progress', async () => {
  const storage = new MemoryChecklistStorage();
  const saved = setChecklistItemState(
    createEmptyChecklistProgress('2026-08-09T10:00:00.000Z'),
    CHECKLIST_ITEM_IDS[1],
    'verified',
    '2026-08-09T10:01:00.000Z',
  );
  storage.values.set(CHECKLIST_STORAGE_KEY, serializeChecklistProgress(saved));
  storage.getFailuresRemaining = 1;

  await assert.rejects(() => loadChecklistProgress(storage), /read failed/);
  const session = setChecklistItemState(
    createEmptyChecklistProgress('2026-08-09T10:00:00.000Z'),
    CHECKLIST_ITEM_IDS[0],
    'unverified',
    '2026-08-09T10:02:00.000Z',
  );
  const retried = await retryChecklistReadAndMergeSession(
    session,
    new Set([CHECKLIST_ITEM_IDS[0]]),
    storage,
  );
  const reloaded = await loadChecklistProgress(storage);

  assert.equal(retried.progress.items[0]?.state, 'unverified');
  assert.equal(retried.progress.items[1]?.state, 'verified');
  assert.equal(reloaded.progress.items[0]?.state, 'unverified');
  assert.equal(reloaded.progress.items[1]?.state, 'verified');
  assert.equal(getChecklistReviewedCount(reloaded.progress), 2);
});

test('corrupt or unsupported local data falls back to a clean five-item v2 checklist', async () => {
  for (const corruptValue of ['not-json', JSON.stringify({ schemaVersion: 99, posting: 'private text' })]) {
    const storage = new MemoryChecklistStorage();
    storage.values.set(CHECKLIST_STORAGE_KEY, corruptValue);
    const result = await loadChecklistProgress(storage, '2026-08-09T10:00:00.000Z');
    const rewritten = storage.values.get(CHECKLIST_STORAGE_KEY) ?? '';

    assert.equal(result.status, 'recovered');
    assert.equal(result.progress.schemaVersion, 2);
    assert.equal(result.progress.items.length, 5);
    assert.ok(result.progress.items.every((item) => item.state === 'untouched'));
    assert.doesNotMatch(rewritten, /private text|posting/);
  }
});

test('read and write failures reject so the UI can expose a storage error state', async () => {
  const readFailure = new MemoryChecklistStorage();
  readFailure.getFailuresRemaining = 1;
  const writeFailure = new MemoryChecklistStorage();
  writeFailure.setFailuresRemaining = 1;

  await assert.rejects(() => loadChecklistProgress(readFailure), /read failed/);
  await assert.rejects(
    () => saveChecklistProgress(createEmptyChecklistProgress(), writeFailure),
    /write failed/,
  );
});
