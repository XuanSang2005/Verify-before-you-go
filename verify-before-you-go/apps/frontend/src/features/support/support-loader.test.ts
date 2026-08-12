import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupportDirectoryResponse } from '@vbyg/contracts';

import { SupportApiError } from '@/api/support';

import {
  commitStagedSupportDirectory,
  commitStagedSupportDirectoryIfAuthoritative,
  loadCachedSupportDirectory,
  stageCachedSupportDirectory,
  SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX,
  type SupportCacheStoragePort,
} from './support-cache';
import { SupportDirectoryCoordinator } from './support-coordinator';
import {
  loadSupportDirectoryState,
  SupersededSupportDirectoryAttemptError,
  type SupportDirectoryDependencies,
} from './use-support-directory';

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

function dependencies(
  storage: SupportCacheStoragePort = createStorage(),
  overrides: Partial<SupportDirectoryDependencies> = {},
): SupportDirectoryDependencies {
  return {
    coordinator: new SupportDirectoryCoordinator(),
    fetchDirectory: async () => directory,
    loadCache: () => loadCachedSupportDirectory(storage),
    stageCache: (value) => stageCachedSupportDirectory(value, storage),
    commitCache: (candidate, isAuthoritative) => commitStagedSupportDirectoryIfAuthoritative(
      candidate,
      isAuthoritative,
      storage,
    ),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function apiError(kind: 'network' | 'http' | 'invalid-response', status?: number) {
  return new SupportApiError({ kind, message: `${kind} failure`, status });
}

test('successful fetch commits the strict public response for offline use', async () => {
  const storage = createStorage();
  const state = await loadSupportDirectoryState(dependencies(storage));
  assert.equal(state.status, 'empty');
  assert.equal(state.savedOffline, true);
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, directory.fetchedAt);
});

test('network failure uses newest committed cache and first launch uses bundle', async () => {
  const storage = createStorage();
  const staged = await stageCachedSupportDirectory(newerDirectory, storage, '2026-08-13T01:00:00.000Z');
  await commitStagedSupportDirectory(staged, storage);
  const cachedState = await loadSupportDirectoryState(dependencies(storage, {
    fetchDirectory: async () => { throw apiError('network'); },
  }));
  assert.equal(cachedState.status, 'offline');
  assert.equal(cachedState.fallbackKind, 'cache');
  assert.equal(cachedState.response?.fetchedAt, newerDirectory.fetchedAt);

  const bundleState = await loadSupportDirectoryState(dependencies(createStorage(), {
    fetchDirectory: async () => { throw apiError('network'); },
  }));
  assert.equal(bundleState.status, 'offline');
  assert.equal(bundleState.fallbackKind, 'bundle');
  assert.match(bundleState.fallbackNotice ?? '', /verify availability/i);
});

test('HTTP 500 may use committed cache while invalid parsed data fails closed', async () => {
  const storage = createStorage();
  const staged = await stageCachedSupportDirectory(newerDirectory, storage);
  await commitStagedSupportDirectory(staged, storage);
  const unavailable = await loadSupportDirectoryState(dependencies(storage, {
    fetchDirectory: async () => { throw apiError('http', 500); },
  }));
  assert.equal(unavailable.status, 'service-unavailable');
  assert.equal(unavailable.response?.fetchedAt, newerDirectory.fetchedAt);

  const invalid = await loadSupportDirectoryState(dependencies(storage, {
    fetchDirectory: async () => { throw apiError('invalid-response'); },
  }));
  assert.equal(invalid.status, 'error');
  assert.equal(invalid.response, undefined);
});

test('stale physical snapshot cannot outrank a newer revision after revocation', async () => {
  const storage = createStorage();
  const coordinator = new SupportDirectoryCoordinator();
  const oldStageGate = deferred<void>();
  let oldCandidateEnteredStorage = false;
  const base = dependencies(storage, { coordinator });
  const oldAuthority = coordinator.beginRequest();
  const oldAttempt = loadSupportDirectoryState({
    ...base,
    fetchDirectory: async () => directory,
    stageCache: async (value) => {
      const candidate = await stageCachedSupportDirectory(value, storage, undefined, 'old-request');
      oldCandidateEnteredStorage = true;
      await oldStageGate.promise;
      return candidate;
    },
  }, oldAuthority);
  while (!oldCandidateEnteredStorage) await Promise.resolve();

  coordinator.revokeRequest(oldAuthority);
  const newState = await loadSupportDirectoryState({
    ...base,
    fetchDirectory: async () => newerDirectory,
  });
  oldStageGate.resolve();

  assert.equal(newState.response?.fetchedAt, newerDirectory.fetchedAt);
  await assert.rejects(oldAttempt, SupersededSupportDirectoryAttemptError);
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, newerDirectory.fetchedAt);
});

test('newer refresh wins while manual save holds the exact older response revision', async () => {
  const storage = createStorage();
  const coordinator = new SupportDirectoryCoordinator();
  const manualStageGate = deferred<void>();
  let manualEnteredStorage = false;
  const oldAuthority = coordinator.beginRequest();
  const manualSave = coordinator.saveManual(
    oldAuthority,
    directory.fetchedAt,
    directory,
    async (value) => {
      const candidate = await stageCachedSupportDirectory(value, storage, undefined, 'manual-old');
      manualEnteredStorage = true;
      await manualStageGate.promise;
      return candidate;
    },
    (candidate, isAuthoritative) => commitStagedSupportDirectoryIfAuthoritative(
      candidate,
      isAuthoritative,
      storage,
    ),
  );
  while (!manualEnteredStorage) await Promise.resolve();

  const refreshed = await loadSupportDirectoryState(dependencies(storage, {
    coordinator,
    fetchDirectory: async () => newerDirectory,
  }));
  manualStageGate.resolve();

  assert.equal(refreshed.response?.fetchedAt, newerDirectory.fetchedAt);
  assert.equal(await manualSave, false);
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, newerDirectory.fetchedAt);
});

test('unmount and remount while physical snapshot write is pending cannot regress cache', async () => {
  const storage = createStorage();
  const coordinator = new SupportDirectoryCoordinator();
  const initial = await stageCachedSupportDirectory(newerDirectory, storage, undefined, 'initial-new');
  await commitStagedSupportDirectory(initial, storage);
  const gate = deferred<void>();
  let headWriteEntered = false;
  const baseSetItem = storage.setItem;
  storage.setItem = async (key, value) => {
    if (
      key.startsWith(SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX)
      && JSON.parse(value).snapshotId === 'unmounted-old'
    ) {
      headWriteEntered = true;
      await gate.promise;
    }
    await baseSetItem(key, value);
  };
  const oldAuthority = coordinator.beginRequest();
  const staleAttempt = loadSupportDirectoryState(dependencies(storage, {
    coordinator,
    fetchDirectory: async () => directory,
    stageCache: (value) => stageCachedSupportDirectory(value, storage, undefined, 'unmounted-old'),
  }), oldAuthority);
  while (!headWriteEntered) await Promise.resolve();

  coordinator.revokeRequest(oldAuthority);
  const remounted = loadSupportDirectoryState(dependencies(storage, {
    coordinator,
    fetchDirectory: async () => { throw apiError('network'); },
  }));
  gate.resolve();

  await assert.rejects(staleAttempt, SupersededSupportDirectoryAttemptError);
  assert.equal((await remounted).response?.fetchedAt, newerDirectory.fetchedAt);
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, newerDirectory.fetchedAt);
});

test('network fallback scans valid immutable snapshots instead of trusting a stale v2 head', async () => {
  const storage = createStorage();
  const older = await stageCachedSupportDirectory(directory, storage, undefined, 'older');
  await commitStagedSupportDirectory(older, storage);
  await stageCachedSupportDirectory(newerDirectory, storage, undefined, 'newer');

  const state = await loadSupportDirectoryState(dependencies(storage, {
    fetchDirectory: async () => { throw apiError('network'); },
  }));
  assert.equal(state.response?.fetchedAt, newerDirectory.fetchedAt);
});

test('two browser-tab coordinators converge on newer revision when old write finishes last', async () => {
  const storage = createStorage();
  const oldWriteGate = deferred<void>();
  let oldWriteEntered = false;
  const baseSetItem = storage.setItem;
  storage.setItem = async (key, value) => {
    if (
      key.startsWith(SUPPORT_DIRECTORY_CACHE_SLOT_PREFIX)
      && JSON.parse(value).snapshotId === 'tab-old'
    ) {
      oldWriteEntered = true;
      await oldWriteGate.promise;
    }
    await baseSetItem(key, value);
  };

  const oldTab = dependencies(storage, {
    coordinator: new SupportDirectoryCoordinator(),
    fetchDirectory: async () => directory,
    stageCache: (value) => stageCachedSupportDirectory(value, storage, undefined, 'tab-old'),
  });
  const newTab = dependencies(storage, {
    coordinator: new SupportDirectoryCoordinator(),
    fetchDirectory: async () => newerDirectory,
    stageCache: (value) => stageCachedSupportDirectory(value, storage, undefined, 'tab-new'),
  });
  const oldAttempt = loadSupportDirectoryState(oldTab);
  while (!oldWriteEntered) await Promise.resolve();
  await loadSupportDirectoryState(newTab);
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, newerDirectory.fetchedAt);

  oldWriteGate.resolve();
  await oldAttempt;
  assert.equal((await loadCachedSupportDirectory(storage))?.data.fetchedAt, newerDirectory.fetchedAt);
  const restartedCoordinator = new SupportDirectoryCoordinator();
  assert.equal((await loadSupportDirectoryState(dependencies(storage, {
    coordinator: restartedCoordinator,
    fetchDirectory: async () => { throw apiError('network'); },
  }))).response?.fetchedAt, newerDirectory.fetchedAt);
});

test('cache stage and commit failures keep live data visible with honest warning', async () => {
  const stageFailure = await loadSupportDirectoryState(dependencies(createStorage(), {
    stageCache: async () => { throw new Error('disk full'); },
  }));
  assert.equal(stageFailure.status, 'empty');
  assert.equal(stageFailure.savedOffline, false);
  assert.match(stageFailure.storageMessage ?? '', /could not update/i);

  const commitFailure = await loadSupportDirectoryState(dependencies(createStorage(), {
    commitCache: async () => { throw new Error('head write failed'); },
  }));
  assert.equal(commitFailure.savedOffline, false);
  assert.match(commitFailure.storageMessage ?? '', /could not update/i);
});
