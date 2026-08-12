import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupportDirectoryResponse } from '@vbyg/contracts';

import { SupportApiError } from '@/api/support';

import {
  loadSupportDirectoryState,
  SupersededSupportDirectoryAttemptError,
  type SupportDirectoryDependencies,
} from './use-support-directory';
import { SupportDirectoryCoordinator } from './support-coordinator';

const directory: SupportDirectoryResponse = {
  schemaVersion: 1,
  contacts: [],
  fetchedAt: '2026-08-12T00:00:00.000Z',
  directoryNotice: 'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.',
};

function dependencies(overrides: Partial<SupportDirectoryDependencies> = {}): SupportDirectoryDependencies {
  return {
    coordinator: new SupportDirectoryCoordinator(),
    fetchDirectory: async () => directory,
    loadCache: async () => null,
    saveCache: async () => undefined,
    ...overrides,
  };
}

const newerDirectory: SupportDirectoryResponse = {
  ...directory,
  fetchedAt: '2026-08-13T00:00:00.000Z',
};

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

test('successful support fetch updates the offline cache without storing private input', async () => {
  let saved: SupportDirectoryResponse | undefined;
  const state = await loadSupportDirectoryState(dependencies({
    saveCache: async (value) => { saved = value; },
  }));
  assert.equal(state.status, 'empty');
  assert.equal(state.savedOffline, true);
  assert.equal(saved?.schemaVersion, 1);
});

test('network failure uses saved support contacts with an explicit offline disclosure', async () => {
  const state = await loadSupportDirectoryState(dependencies({
    fetchDirectory: async () => { throw apiError('network'); },
    loadCache: async () => ({ schemaVersion: 1, cachedAt: '2026-08-13T01:00:00.000Z', data: newerDirectory }),
  }));
  assert.equal(state.status, 'offline');
  assert.equal(state.message, 'Offline · showing saved contacts');
  assert.equal(state.cachedAt, '2026-08-13T01:00:00.000Z');
});

test('first launch in airplane mode falls back to the production bundle', async () => {
  const state = await loadSupportDirectoryState(dependencies({
    fetchDirectory: async () => { throw apiError('network'); },
    loadCache: async () => null,
  }));
  assert.equal(state.status, 'offline');
  assert.equal(state.fallbackKind, 'bundle');
  assert.ok((state.response?.contacts.length ?? 0) >= 8);
  assert.match(state.fallbackNotice ?? '', /verify availability/i);
});

test('HTTP 500 with cache is service unavailable, while invalid data fails closed', async () => {
  const cached = async () => ({ schemaVersion: 1 as const, cachedAt: '2026-08-13T01:00:00.000Z', data: newerDirectory });
  const unavailable = await loadSupportDirectoryState(dependencies({
    fetchDirectory: async () => { throw apiError('http', 500); },
    loadCache: cached,
  }));
  assert.equal(unavailable.status, 'service-unavailable');

  const invalid = await loadSupportDirectoryState(dependencies({
    fetchDirectory: async () => { throw apiError('invalid-response'); },
    loadCache: cached,
  }));
  assert.equal(invalid.status, 'error');
  assert.equal(invalid.response, undefined);
});

test('a superseded request cannot write cache or return ready state after a newer request', async () => {
  const coordinator = new SupportDirectoryCoordinator();
  const oldFetch = deferred<SupportDirectoryResponse>();
  const writes: string[] = [];
  const base = dependencies({
    coordinator,
    saveCache: async (value) => { writes.push(value.fetchedAt); },
  });
  const oldAttempt = loadSupportDirectoryState({
    ...base,
    fetchDirectory: async () => oldFetch.promise,
  });
  const newState = await loadSupportDirectoryState({
    ...base,
    fetchDirectory: async () => newerDirectory,
  });
  oldFetch.resolve(directory);

  assert.equal(newState.response?.fetchedAt, newerDirectory.fetchedAt);
  await assert.rejects(oldAttempt, SupersededSupportDirectoryAttemptError);
  assert.deepEqual(writes, [newerDirectory.fetchedAt]);
});

test('an older network fallback cannot return offline after a newer request starts', async () => {
  const coordinator = new SupportDirectoryCoordinator();
  const cacheRead = deferred<null>();
  const base = dependencies({ coordinator });
  const oldAttempt = loadSupportDirectoryState({
    ...base,
    fetchDirectory: async () => { throw apiError('network'); },
    loadCache: async () => cacheRead.promise,
  });
  await Promise.resolve();
  const newAttempt = loadSupportDirectoryState({
    ...base,
    fetchDirectory: async () => newerDirectory,
  });
  cacheRead.resolve(null);

  await assert.rejects(oldAttempt, SupersededSupportDirectoryAttemptError);
  assert.equal((await newAttempt).response?.fetchedAt, newerDirectory.fetchedAt);
});

test('revoking an unmounted request prevents late cache and state authority', async () => {
  const coordinator = new SupportDirectoryCoordinator();
  const fetchGate = deferred<SupportDirectoryResponse>();
  let writes = 0;
  const authority = coordinator.beginRequest();
  const attempt = loadSupportDirectoryState(dependencies({
    coordinator,
    fetchDirectory: async () => fetchGate.promise,
    saveCache: async () => { writes += 1; },
  }), authority);

  coordinator.revokeRequest(authority);
  fetchGate.resolve(directory);
  await assert.rejects(attempt, SupersededSupportDirectoryAttemptError);
  assert.equal(writes, 0);
});

test('a stale request queued behind another mutation is rejected at the cache boundary', async () => {
  const coordinator = new SupportDirectoryCoordinator();
  const queueGate = deferred<void>();
  const queueHolder = coordinator.saveManual(directory, async () => {
    await queueGate.promise;
  });
  await Promise.resolve();

  let staleWrites = 0;
  const oldAuthority = coordinator.beginRequest();
  const oldAttempt = loadSupportDirectoryState(dependencies({
    coordinator,
    fetchDirectory: async () => directory,
    saveCache: async () => { staleWrites += 1; },
  }), oldAuthority);
  await Promise.resolve();
  coordinator.beginRequest();
  queueGate.resolve();

  await queueHolder;
  await assert.rejects(oldAttempt, SupersededSupportDirectoryAttemptError);
  assert.equal(staleWrites, 0);
});

test('manual save overlap is serialized and the latest mutation owns physical cache', async () => {
  const coordinator = new SupportDirectoryCoordinator();
  const oldWriteGate = deferred<void>();
  let physical: SupportDirectoryResponse | undefined;
  const oldSave = coordinator.saveManual(directory, async (value) => {
    await oldWriteGate.promise;
    physical = value;
  });
  await Promise.resolve();
  const newSave = coordinator.saveManual(newerDirectory, async (value) => {
    physical = value;
  });
  oldWriteGate.resolve();

  assert.equal(await oldSave, false);
  assert.equal(await newSave, true);
  assert.equal(physical?.fetchedAt, newerDirectory.fetchedAt);
});

test('a stale manual write failure cannot override a newer successful mutation', async () => {
  const coordinator = new SupportDirectoryCoordinator();
  const oldWriteGate = deferred<void>();
  const oldSave = coordinator.saveManual(directory, async () => {
    await oldWriteGate.promise;
    throw new Error('old disk failure');
  });
  await Promise.resolve();
  const newSave = coordinator.saveManual(newerDirectory, async () => undefined);
  oldWriteGate.resolve();

  assert.equal(await oldSave, false);
  assert.equal(await newSave, true);
});

test('network fallback reads cache after earlier authoritative mutations finish', async () => {
  const coordinator = new SupportDirectoryCoordinator();
  const writeGate = deferred<void>();
  let physical: SupportDirectoryResponse | null = null;
  const manualSave = coordinator.saveManual(newerDirectory, async (value) => {
    await writeGate.promise;
    physical = value;
  });
  await Promise.resolve();

  const attempt = loadSupportDirectoryState(dependencies({
    coordinator,
    fetchDirectory: async () => { throw apiError('network'); },
    loadCache: async () => physical ? ({
      schemaVersion: 1,
      cachedAt: '2026-08-13T01:00:00.000Z',
      data: physical,
    }) : null,
  }));
  writeGate.resolve();
  await manualSave;
  const state = await attempt;
  assert.equal(state.fallbackKind, 'cache');
  assert.equal(state.response?.fetchedAt, newerDirectory.fetchedAt);
});

test('cache write failure keeps live data visible with an honest storage warning', async () => {
  const state = await loadSupportDirectoryState(dependencies({
    saveCache: async () => { throw new Error('disk full'); },
  }));
  assert.equal(state.status, 'empty');
  assert.equal(state.savedOffline, false);
  assert.match(state.storageMessage ?? '', /could not update/i);
});
