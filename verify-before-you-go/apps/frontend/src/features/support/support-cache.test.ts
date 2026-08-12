import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupportDirectoryResponse } from '@vbyg/contracts';

import { bundledSupportDirectory } from './support-bundle';
import {
  commitStagedSupportDirectory,
  loadCachedSupportDirectory,
  saveCachedSupportDirectory,
  stageCachedSupportDirectory,
  SUPPORT_DIRECTORY_CACHE_HEAD_KEY,
  SUPPORT_DIRECTORY_CACHE_KEY,
  SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX,
  type SupportCacheStoragePort,
} from './support-cache';

const directory: SupportDirectoryResponse = {
  schemaVersion: 1,
  contacts: [],
  fetchedAt: '2026-08-12T00:00:00.000Z',
  directoryNotice: 'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.',
};

const newerDirectory: SupportDirectoryResponse = {
  ...directory,
  fetchedAt: '2026-08-13T00:00:00.000Z',
};

function createStorage(): SupportCacheStoragePort & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getAllKeys: async () => [...values.keys()],
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => { values.delete(key); },
    setItem: async (key, value) => { values.set(key, value); },
  };
}

function snapshotKeys(storage: ReturnType<typeof createStorage>) {
  return [...storage.values.keys()].filter((key) => key.startsWith(SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX));
}

test('immutable snapshots choose the newest response revision without an authoritative head', async () => {
  const storage = createStorage();
  await saveCachedSupportDirectory(newerDirectory, storage, '2026-08-13T01:00:00.000Z');
  await saveCachedSupportDirectory(directory, storage, '2026-08-14T01:00:00.000Z');

  assert.equal(storage.values.has(SUPPORT_DIRECTORY_CACHE_HEAD_KEY), false);
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, newerDirectory.fetchedAt);
  assert.doesNotMatch(JSON.stringify([...storage.values]), /recovery|posting|screenshot|passport/i);
});

test('late stale snapshot cannot regress cache when rollback cleanup fails or never runs', async () => {
  const storage = createStorage();
  await saveCachedSupportDirectory(newerDirectory, storage, undefined);
  storage.removeItem = async () => { throw new Error('rollback and cleanup unavailable'); };

  const stale = await stageCachedSupportDirectory(directory, storage, undefined, 'late-stale');
  // Simulate process termination immediately after the physical snapshot write:
  // there is intentionally no commit or rollback call.
  assert.equal(stale.responseRevision, directory.fetchedAt);

  const restartedStorage: SupportCacheStoragePort = {
    getAllKeys: storage.getAllKeys,
    getItem: storage.getItem,
    removeItem: storage.removeItem,
    setItem: storage.setItem,
  };
  assert.equal((await loadCachedSupportDirectory(restartedStorage))?.data.fetchedAt, newerDirectory.fetchedAt);
});

test('50 refreshes retain at most three valid snapshots', async () => {
  const storage = createStorage();
  for (let index = 0; index < 50; index += 1) {
    const fetchedAt = new Date(Date.UTC(2026, 7, 12, 0, index)).toISOString();
    await saveCachedSupportDirectory({ ...directory, fetchedAt }, storage, fetchedAt);
  }

  assert.ok(snapshotKeys(storage).length <= 3);
  assert.equal(
    (await loadCachedSupportDirectory(storage))?.data.fetchedAt,
    new Date(Date.UTC(2026, 7, 12, 0, 49)).toISOString(),
  );
});

test('cleanup failure cannot hide the newest valid snapshot', async () => {
  const storage = createStorage();
  storage.removeItem = async () => { throw new Error('cleanup unavailable'); };
  for (let index = 0; index < 5; index += 1) {
    const fetchedAt = new Date(Date.UTC(2026, 7, 12, 0, index)).toISOString();
    await saveCachedSupportDirectory({ ...directory, fetchedAt }, storage, fetchedAt);
  }
  assert.equal(
    (await loadCachedSupportDirectory(storage))?.data.fetchedAt,
    new Date(Date.UTC(2026, 7, 12, 0, 4)).toISOString(),
  );
});

test('corrupt newest slot is ignored in favor of the next valid snapshot', async () => {
  const storage = createStorage();
  await saveCachedSupportDirectory(directory, storage, undefined);
  await saveCachedSupportDirectory(newerDirectory, storage, undefined);
  const newestKey = snapshotKeys(storage).find((key) => (
    storage.values.get(key)?.includes(newerDirectory.fetchedAt)
  ));
  assert.ok(newestKey);
  storage.values.set(newestKey, '{partial');

  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, directory.fetchedAt);
});

test('equal revisions with different strict payloads fail closed instead of choosing by write order', async () => {
  const storage = createStorage();
  storage.removeItem = async () => { throw new Error('preserve conflict for restart'); };
  const conflicting: SupportDirectoryResponse = {
    ...directory,
    contacts: [bundledSupportDirectory.response.contacts[0]!],
  };
  await saveCachedSupportDirectory(directory, storage, undefined);
  await saveCachedSupportDirectory(conflicting, storage, undefined);

  assert.equal(await loadCachedSupportDirectory(storage), null);
});

test('legacy v1 remains readable and is migrated without deleting the legacy copy', async () => {
  const storage = createStorage();
  await saveCachedSupportDirectory(directory, storage, '2026-08-12T00:30:00.000Z');
  storage.values.set(SUPPORT_DIRECTORY_CACHE_KEY, JSON.stringify({
    schemaVersion: 1,
    cachedAt: '2026-08-13T01:00:00.000Z',
    data: newerDirectory,
  }));

  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, newerDirectory.fetchedAt);
  assert.ok(storage.values.has(SUPPORT_DIRECTORY_CACHE_KEY));
  assert.ok(snapshotKeys(storage).some((key) => storage.values.get(key)?.includes(newerDirectory.fetchedAt)));
});

test('valid v2 head is safely migrated while a corrupt head falls back to v1', async () => {
  const storage = createStorage();
  const candidateId = 'old-v2';
  const candidateKey = `@vbyg/support-directory/v2/slot/${candidateId}`;
  storage.values.set(candidateKey, JSON.stringify({
    cacheSchemaVersion: 2,
    candidateId,
    cachedAt: '2026-08-13T01:00:00.000Z',
    responseRevision: newerDirectory.fetchedAt,
    data: newerDirectory,
  }));
  storage.values.set(SUPPORT_DIRECTORY_CACHE_HEAD_KEY, JSON.stringify({
    cacheSchemaVersion: 2,
    candidateId,
    candidateKey,
    committedAt: '2026-08-13T01:00:00.000Z',
    responseRevision: newerDirectory.fetchedAt,
  }));
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, newerDirectory.fetchedAt);

  const fallbackStorage = createStorage();
  fallbackStorage.values.set(SUPPORT_DIRECTORY_CACHE_HEAD_KEY, '{broken');
  fallbackStorage.values.set(SUPPORT_DIRECTORY_CACHE_KEY, JSON.stringify({
    schemaVersion: 1,
    cachedAt: '2026-08-12T01:00:00.000Z',
    data: directory,
  }));
  assert.equal((await loadCachedSupportDirectory(fallbackStorage))?.data.fetchedAt, directory.fetchedAt);
});

test('storage failures remain observable while cleanup failures do not fail saves', async () => {
  const storage: SupportCacheStoragePort = {
    getAllKeys: async () => { throw new Error('key read failed'); },
    getItem: async () => { throw new Error('read failed'); },
    removeItem: async () => { throw new Error('remove failed'); },
    setItem: async () => { throw new Error('write failed'); },
  };
  await assert.rejects(() => loadCachedSupportDirectory(storage), /key read failed/);
  await assert.rejects(() => stageCachedSupportDirectory(directory, storage), /write failed/);

  const cleanupFailure = createStorage();
  cleanupFailure.removeItem = async () => { throw new Error('remove failed'); };
  const staged = await stageCachedSupportDirectory(directory, cleanupFailure);
  await commitStagedSupportDirectory(staged, cleanupFailure);
  assert.equal((await loadCachedSupportDirectory(cleanupFailure))?.data.fetchedAt, directory.fetchedAt);
});
