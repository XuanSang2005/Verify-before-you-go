import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupportDirectoryResponse } from '@vbyg/contracts';

import {
  loadCachedSupportDirectory,
  saveCachedSupportDirectory,
  SUPPORT_DIRECTORY_CACHE_KEY,
  type SupportCacheStoragePort,
} from './support-cache';

const directory: SupportDirectoryResponse = {
  schemaVersion: 1,
  contacts: [],
  fetchedAt: '2026-08-12T00:00:00.000Z',
  directoryNotice: 'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.',
};

function createStorage(): SupportCacheStoragePort & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  };
}

test('support directory persists only versioned public contact data for offline use', async () => {
  const storage = createStorage();
  await saveCachedSupportDirectory(directory, storage, '2026-08-12T01:00:00.000Z');
  const cached = await loadCachedSupportDirectory(storage);
  assert.equal(cached?.cachedAt, '2026-08-12T01:00:00.000Z');
  assert.equal(cached?.data.schemaVersion, 1);
  assert.doesNotMatch(storage.values.get(SUPPORT_DIRECTORY_CACHE_KEY) ?? '', /recovery|posting|screenshot|passport/i);
});

test('corrupt, unsupported and invalid support caches fail closed', async () => {
  const storage = createStorage();
  storage.values.set(SUPPORT_DIRECTORY_CACHE_KEY, '{broken');
  assert.equal(await loadCachedSupportDirectory(storage), null);
  storage.values.set(SUPPORT_DIRECTORY_CACHE_KEY, JSON.stringify({ schemaVersion: 2, cachedAt: new Date().toISOString(), data: directory }));
  assert.equal(await loadCachedSupportDirectory(storage), null);
  storage.values.set(SUPPORT_DIRECTORY_CACHE_KEY, JSON.stringify({ schemaVersion: 1, cachedAt: new Date().toISOString(), data: { ...directory, contacts: 'invalid' } }));
  assert.equal(await loadCachedSupportDirectory(storage), null);
});

test('storage failures remain observable to the controller', async () => {
  const storage: SupportCacheStoragePort = {
    getItem: async () => { throw new Error('read failed'); },
    setItem: async () => { throw new Error('write failed'); },
  };
  await assert.rejects(() => loadCachedSupportDirectory(storage), /read failed/);
  await assert.rejects(() => saveCachedSupportDirectory(directory, storage), /write failed/);
});
