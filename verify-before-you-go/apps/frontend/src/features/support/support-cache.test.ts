import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupportDirectoryResponse } from '@vbyg/contracts';

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
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => { values.delete(key); },
    setItem: async (key, value) => { values.set(key, value); },
  };
}

test('support cache commits an isolated versioned slot through an authoritative head', async () => {
  const storage = createStorage();
  await saveCachedSupportDirectory(directory, storage, '2026-08-12T01:00:00.000Z');
  const cached = await loadCachedSupportDirectory(storage);
  const head = JSON.parse(storage.values.get(SUPPORT_DIRECTORY_CACHE_HEAD_KEY) ?? '{}') as {
    candidateKey?: string;
  };
  assert.match(head.candidateKey ?? '', new RegExp(`^${SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX}`));
  assert.equal(cached?.cachedAt, '2026-08-12T01:00:00.000Z');
  assert.equal(cached?.data.schemaVersion, 1);
  assert.doesNotMatch(JSON.stringify([...storage.values]), /recovery|posting|screenshot|passport/i);
});

test('an uncommitted or stale candidate can never replace the authoritative cache', async () => {
  const storage = createStorage();
  await saveCachedSupportDirectory(newerDirectory, storage, '2026-08-13T01:00:00.000Z');
  const headBefore = storage.values.get(SUPPORT_DIRECTORY_CACHE_HEAD_KEY);
  await stageCachedSupportDirectory(directory, storage, '2026-08-14T01:00:00.000Z', 'stale-candidate');

  assert.equal(storage.values.get(SUPPORT_DIRECTORY_CACHE_HEAD_KEY), headBefore);
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, newerDirectory.fetchedAt);
});

test('reader follows only the head and rejects mismatched, corrupt or invalid slots', async () => {
  const storage = createStorage();
  const candidate = await stageCachedSupportDirectory(directory, storage, undefined, 'candidate-one');
  await commitStagedSupportDirectory(candidate, storage);
  storage.values.set(candidate.candidateKey, JSON.stringify({
    cacheSchemaVersion: 2,
    candidateId: candidate.candidateId,
    cachedAt: new Date().toISOString(),
    responseRevision: newerDirectory.fetchedAt,
    data: newerDirectory,
  }));
  assert.equal(await loadCachedSupportDirectory(storage), null);

  storage.values.set(SUPPORT_DIRECTORY_CACHE_HEAD_KEY, '{broken');
  storage.values.set(SUPPORT_DIRECTORY_CACHE_KEY, JSON.stringify({
    schemaVersion: 1,
    cachedAt: '2026-08-12T01:00:00.000Z',
    data: directory,
  }));
  assert.equal(await loadCachedSupportDirectory(storage), null);
});

test('legacy v1 cache remains readable only when no authoritative v2 head exists', async () => {
  const storage = createStorage();
  storage.values.set(SUPPORT_DIRECTORY_CACHE_KEY, JSON.stringify({
    schemaVersion: 1,
    cachedAt: '2026-08-12T01:00:00.000Z',
    data: directory,
  }));
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, directory.fetchedAt);

  storage.values.set(SUPPORT_DIRECTORY_CACHE_HEAD_KEY, JSON.stringify({
    cacheSchemaVersion: 2,
    candidateId: 'missing',
    candidateKey: `${SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX}missing`,
    committedAt: '2026-08-13T00:00:00.000Z',
    responseRevision: newerDirectory.fetchedAt,
  }));
  assert.equal(await loadCachedSupportDirectory(storage), null);
});

test('storage failures remain observable at candidate and head boundaries', async () => {
  const storage: SupportCacheStoragePort = {
    getItem: async () => { throw new Error('read failed'); },
    removeItem: async () => { throw new Error('remove failed'); },
    setItem: async () => { throw new Error('write failed'); },
  };
  await assert.rejects(() => loadCachedSupportDirectory(storage), /read failed/);
  await assert.rejects(() => stageCachedSupportDirectory(directory, storage), /write failed/);
});
