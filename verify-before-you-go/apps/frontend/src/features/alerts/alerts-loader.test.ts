import assert from 'node:assert/strict';
import test from 'node:test';

import { AlertsApiError } from '@/api/alerts';

import {
  createAlertDetailCacheCoordinator,
  createAlertListCacheCoordinator,
  deleteAlertDetailTombstone,
  loadAlertDetailTombstone,
  loadCachedAlertDetail,
  saveAlertDetailTombstone,
  saveCachedAlertDetail,
  type AlertsCacheStoragePort,
} from './alerts-cache';
import { alertDetailFixture, alertListFixture } from './alerts-test-fixtures';
import {
  loadAlertDetailState,
  loadAlertsListState,
  type AlertsLoaderDependencies,
} from './use-alerts';

function alertsError(kind: 'network' | 'http' | 'invalid-response', status?: number) {
  return new AlertsApiError({ kind, message: `Synthetic ${kind} failure.`, status });
}

function createDependencies(overrides: Partial<AlertsLoaderDependencies> = {}): AlertsLoaderDependencies {
  return {
    detailCacheCoordinator: createAlertDetailCacheCoordinator(),
    listCacheCoordinator: createAlertListCacheCoordinator(),
    deleteDetailTombstone: async () => undefined,
    deleteDetailCache: async () => undefined,
    fetchDetail: async () => alertDetailFixture,
    fetchList: async () => alertListFixture,
    loadDetailTombstone: async () => null,
    loadDetailCache: async () => null,
    loadListCache: async () => null,
    saveDetailTombstone: async () => undefined,
    saveDetailCache: async () => undefined,
    saveListCache: async () => undefined,
    ...overrides,
  };
}

function deferred<T>() {
  let reject!: (error: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for the deferred request to start');
}

function createStorage(): AlertsCacheStoragePort & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => { values.delete(key); },
    setItem: async (key, value) => { values.set(key, value); },
  };
}

const cachedDetail = {
  schemaVersion: 1 as const,
  cachedAt: '2026-08-10T03:00:00.000Z',
  data: alertDetailFixture,
};

test('community alerts list loading sends no hidden category query', async () => {
  let receivedQuery: unknown = 'not-called';
  const state = await loadAlertsListState(createDependencies({
    fetchList: async (query) => {
      receivedQuery = query;
      return alertListFixture;
    },
  }));

  assert.equal(state.status, 'ready');
  assert.equal(receivedQuery, undefined);
});

test('an older list response cannot overwrite a newer authoritative list or cache', async () => {
  const oldRequest = deferred<typeof alertListFixture>();
  const newerRequest = deferred<typeof alertListFixture>();
  const newerFixture = {
    ...alertListFixture,
    fetchedAt: '2026-08-11T02:00:00.000Z',
    alerts: [{ ...alertListFixture.alerts[0]!, title: 'Newer reviewed alert list' }],
  };
  const savedTitles: string[] = [];
  let requestCount = 0;
  const dependencies = createDependencies({
    fetchList: async () => {
      requestCount += 1;
      return requestCount === 1 ? oldRequest.promise : newerRequest.promise;
    },
    saveListCache: async (response) => {
      savedTitles.push(response.alerts[0]?.title ?? 'empty');
    },
  });

  const oldLoad = loadAlertsListState(dependencies);
  await Promise.resolve();
  const newerLoad = loadAlertsListState(dependencies);
  await Promise.resolve();
  newerRequest.resolve(newerFixture);
  const newerState = await newerLoad;
  oldRequest.resolve(alertListFixture);
  const oldState = await oldLoad;

  assert.equal(newerState.status, 'ready');
  assert.equal(newerState.response?.alerts[0]?.title, 'Newer reviewed alert list');
  assert.equal(oldState.status, 'superseded');
  assert.deepEqual(savedTitles, ['Newer reviewed alert list']);
});

test('a newer list write remains final when an older cache write was already pending', async () => {
  const oldWrite = deferred<void>();
  const newerRequest = deferred<typeof alertListFixture>();
  const newerFixture = {
    ...alertListFixture,
    fetchedAt: '2026-08-11T02:00:00.000Z',
    alerts: [{ ...alertListFixture.alerts[0]!, title: 'Newest authoritative list' }],
  };
  let cacheTitle = 'initial';
  let requestCount = 0;
  let saveCount = 0;
  const dependencies = createDependencies({
    fetchList: async () => {
      requestCount += 1;
      return requestCount === 1 ? alertListFixture : newerRequest.promise;
    },
    saveListCache: async (response) => {
      saveCount += 1;
      if (saveCount === 1) await oldWrite.promise;
      cacheTitle = response.alerts[0]?.title ?? 'empty';
    },
  });

  const oldLoad = loadAlertsListState(dependencies);
  await waitFor(() => saveCount === 1);
  const newerLoad = loadAlertsListState(dependencies);
  await waitFor(() => requestCount === 2);
  newerRequest.resolve(newerFixture);
  oldWrite.resolve();

  assert.equal((await oldLoad).status, 'superseded');
  assert.equal((await newerLoad).status, 'ready');
  assert.equal(cacheTitle, 'Newest authoritative list');
  assert.equal(saveCount, 2);
});

test('superseded list failures cannot return offline, service-unavailable or error states', async () => {
  for (const error of [
    alertsError('network'),
    alertsError('http', 500),
    alertsError('invalid-response'),
  ]) {
    const olderRequest = deferred<typeof alertListFixture>();
    let requestCount = 0;
    const dependencies = createDependencies({
      fetchList: async () => {
        requestCount += 1;
        return requestCount === 1 ? olderRequest.promise : alertListFixture;
      },
      loadListCache: async () => ({
        schemaVersion: 1,
        cachedAt: '2026-08-10T03:00:00.000Z',
        data: alertListFixture,
      }),
    });
    const olderLoad = loadAlertsListState(dependencies);
    await waitFor(() => requestCount === 1);
    assert.equal((await loadAlertsListState(dependencies)).status, 'ready');
    olderRequest.reject(error);
    assert.equal((await olderLoad).status, 'superseded');
  }
});

test('a superseded unmounted list request cannot mutate cache or return an authoritative state', async () => {
  const response = deferred<typeof alertListFixture>();
  let saveCount = 0;
  const dependencies = createDependencies({
    fetchList: async () => response.promise,
    saveListCache: async () => { saveCount += 1; },
  });
  const generation = dependencies.listCacheCoordinator.beginRequest();
  const load = loadAlertsListState(dependencies, generation);
  await Promise.resolve();
  dependencies.listCacheCoordinator.supersede(generation);
  response.resolve(alertListFixture);

  assert.equal((await load).status, 'superseded');
  assert.equal(saveCount, 0);
});

test('list offline fallback reloads the latest cache after the request fails', async () => {
  const request = deferred<typeof alertListFixture>();
  const newerCachedFixture = {
    ...alertListFixture,
    fetchedAt: '2026-08-11T02:00:00.000Z',
    alerts: [{ ...alertListFixture.alerts[0]!, title: 'Latest saved list' }],
  };
  let cachedData = alertListFixture;
  let cacheReadCount = 0;
  const dependencies = createDependencies({
    fetchList: async () => request.promise,
    loadListCache: async () => {
      cacheReadCount += 1;
      return {
        schemaVersion: 1,
        cachedAt: '2026-08-11T03:00:00.000Z',
        data: cachedData,
      };
    },
  });

  const load = loadAlertsListState(dependencies);
  await Promise.resolve();
  cachedData = newerCachedFixture;
  request.reject(alertsError('network'));
  const state = await load;

  assert.equal(cacheReadCount, 1);
  assert.equal(state.status, 'offline');
  assert.equal(state.response?.alerts[0]?.title, 'Latest saved list');
});

test('network failure is the only alert state labelled offline and uses saved public summaries', async () => {
  const state = await loadAlertsListState(createDependencies({
    fetchList: async () => { throw alertsError('network'); },
    loadListCache: async () => ({
      schemaVersion: 1,
      cachedAt: '2026-08-10T03:00:00.000Z',
      data: alertListFixture,
    }),
  }));
  assert.equal(state.status, 'offline');
  assert.equal(state.response?.alerts[0]?.id, 'A-018');
  assert.match(state.message ?? '', /^Offline/);
});

test('HTTP 404 deletes the corresponding saved alert and renders no stale detail', async () => {
  let deletedId = '';
  const state = await loadAlertDetailState('A-018', createDependencies({
    deleteDetailCache: async (id) => { deletedId = id; },
    fetchDetail: async () => { throw alertsError('http', 404); },
    loadDetailCache: async () => ({
      schemaVersion: 1,
      cachedAt: '2026-08-10T03:00:00.000Z',
      data: alertDetailFixture,
    }),
  }));
  assert.equal(deletedId, 'A-018');
  assert.equal(state.status, 'not-found');
  assert.equal(state.response, undefined);
});

test('a 404 tombstone blocks stale detail after cache deletion fails and the network later fails', async () => {
  let requestCount = 0;
  const dependencies = createDependencies({
    deleteDetailCache: async () => { throw new Error('remove failed'); },
    fetchDetail: async () => {
      requestCount += 1;
      throw requestCount === 1 ? alertsError('http', 404) : alertsError('network');
    },
    loadDetailCache: async () => ({
      schemaVersion: 1,
      cachedAt: '2026-08-10T03:00:00.000Z',
      data: alertDetailFixture,
    }),
  });

  const removedState = await loadAlertDetailState('A-018', dependencies);
  const laterOfflineState = await loadAlertDetailState('A-018', dependencies);

  assert.equal(removedState.status, 'not-found');
  assert.equal(laterOfflineState.status, 'error');
  assert.equal(laterOfflineState.response, undefined);
});

test('a durable tombstone survives restart and blocks stale cache after deletion failure', async () => {
  const storage = createStorage();
  await saveCachedAlertDetail('A-018', alertDetailFixture, storage, '2026-08-10T03:00:00.000Z');
  const storageDependencies = {
    deleteDetailTombstone: (id: string) => deleteAlertDetailTombstone(id, storage),
    loadDetailCache: (id: string) => loadCachedAlertDetail(id, storage),
    loadDetailTombstone: (id: string) => loadAlertDetailTombstone(id, storage),
    saveDetailCache: (id: string, response: typeof alertDetailFixture) => saveCachedAlertDetail(id, response, storage),
    saveDetailTombstone: (id: string) => saveAlertDetailTombstone(
      id,
      storage,
      '2026-08-11T04:00:00.000Z',
    ),
  };
  const firstDependencies = createDependencies({
    ...storageDependencies,
    deleteDetailCache: async () => { throw new Error('remove failed'); },
    fetchDetail: async () => { throw alertsError('http', 404); },
  });

  const revoked = await loadAlertDetailState('A-018', firstDependencies);
  assert.equal(revoked.status, 'not-found');
  const tombstoneRaw = [...storage.values.entries()]
    .find(([key]) => key.includes('/tombstone/'))?.[1];
  assert.ok(tombstoneRaw);
  assert.deepEqual(Object.keys(JSON.parse(tombstoneRaw)).toSorted(), [
    'id',
    'revokedAt',
    'schemaVersion',
    'updatedAt',
  ]);

  const restartedDependencies = createDependencies({
    ...storageDependencies,
    detailCacheCoordinator: createAlertDetailCacheCoordinator(),
    fetchDetail: async () => { throw alertsError('network'); },
  });
  const afterRestart = await loadAlertDetailState('A-018', restartedDependencies);

  assert.equal(afterRestart.status, 'error');
  assert.equal(afterRestart.response, undefined);
});

test('a newer authoritative success replaces a durable tombstone and becomes the restart fallback', async () => {
  const storage = createStorage();
  await saveCachedAlertDetail('A-018', alertDetailFixture, storage, '2026-08-10T03:00:00.000Z');
  await saveAlertDetailTombstone('A-018', storage, '2026-08-11T04:00:00.000Z');
  const storageDependencies = {
    deleteDetailTombstone: (id: string) => deleteAlertDetailTombstone(id, storage),
    loadDetailCache: (id: string) => loadCachedAlertDetail(id, storage),
    loadDetailTombstone: (id: string) => loadAlertDetailTombstone(id, storage),
    saveDetailCache: (id: string, response: typeof alertDetailFixture) => saveCachedAlertDetail(
      id,
      response,
      storage,
      '2026-08-11T05:00:00.000Z',
    ),
  };
  const restored = await loadAlertDetailState('A-018', createDependencies({
    ...storageDependencies,
    fetchDetail: async () => alertDetailFixture,
  }));
  assert.equal(restored.status, 'ready');
  assert.equal(await loadAlertDetailTombstone('A-018', storage), null);

  const afterRestart = await loadAlertDetailState('A-018', createDependencies({
    ...storageDependencies,
    detailCacheCoordinator: createAlertDetailCacheCoordinator(),
    fetchDetail: async () => { throw alertsError('network'); },
  }));
  assert.equal(afterRestart.status, 'offline');
  assert.equal(afterRestart.response?.alert.id, 'A-018');
});

test('a superseded 404 cannot revoke cache or return not-found behind a newer request', async () => {
  const firstRequest = deferred<typeof alertDetailFixture>();
  const secondRequest = deferred<typeof alertDetailFixture>();
  let requestCount = 0;
  const dependencies = createDependencies({
    fetchDetail: async () => {
      requestCount += 1;
      return requestCount === 1 ? firstRequest.promise : secondRequest.promise;
    },
    loadDetailCache: async () => cachedDetail,
  });

  const notFoundLoad = loadAlertDetailState('A-018', dependencies);
  await waitFor(() => requestCount === 1);
  const offlineLoad = loadAlertDetailState('A-018', dependencies);
  await waitFor(() => requestCount === 2);
  firstRequest.reject(alertsError('http', 404));
  assert.equal((await notFoundLoad).status, 'superseded');
  secondRequest.reject(alertsError('network'));
  const offlineState = await offlineLoad;

  assert.equal(offlineState.status, 'offline');
  assert.equal(offlineState.response?.alert.id, 'A-018');
});

test('an old success resolving after a newer 404 cannot save or restore cache', async () => {
  const oldRequest = deferred<typeof alertDetailFixture>();
  const newerRequest = deferred<typeof alertDetailFixture>();
  let requestCount = 0;
  let saveCount = 0;
  const dependencies = createDependencies({
    fetchDetail: async () => {
      requestCount += 1;
      return requestCount === 1 ? oldRequest.promise : newerRequest.promise;
    },
    loadDetailCache: async () => cachedDetail,
    saveDetailCache: async () => { saveCount += 1; },
  });

  const oldLoad = loadAlertDetailState('A-018', dependencies);
  await waitFor(() => requestCount === 1);
  const newerLoad = loadAlertDetailState('A-018', dependencies);
  await waitFor(() => requestCount === 2);
  newerRequest.reject(alertsError('http', 404));
  assert.equal((await newerLoad).status, 'not-found');
  oldRequest.resolve(alertDetailFixture);
  assert.equal((await oldLoad).status, 'superseded');

  assert.equal(saveCount, 0);
  assert.equal(dependencies.detailCacheCoordinator.canUseCachedDetail('A-018'), false);
});

test('a newer 404 remains final when an older detail cache write was already pending', async () => {
  const oldWrite = deferred<void>();
  let deleteCount = 0;
  let requestCount = 0;
  let saveCount = 0;
  let tombstoneCount = 0;
  const dependencies = createDependencies({
    deleteDetailCache: async () => { deleteCount += 1; },
    fetchDetail: async () => {
      requestCount += 1;
      if (requestCount === 1) return alertDetailFixture;
      throw alertsError('http', 404);
    },
    saveDetailCache: async () => {
      saveCount += 1;
      await oldWrite.promise;
    },
    saveDetailTombstone: async () => { tombstoneCount += 1; },
  });

  const olderLoad = loadAlertDetailState('A-018', dependencies);
  await waitFor(() => saveCount === 1);
  const newerLoad = loadAlertDetailState('A-018', dependencies);
  oldWrite.resolve();

  assert.equal((await olderLoad).status, 'superseded');
  assert.equal((await newerLoad).status, 'not-found');
  assert.equal(tombstoneCount, 1);
  assert.equal(deleteCount, 1);
  assert.equal(dependencies.detailCacheCoordinator.canUseCachedDetail('A-018'), false);
});

test('an old 404 resolving after a newer success cannot delete the new cache', async () => {
  const oldRequest = deferred<typeof alertDetailFixture>();
  const newerRequest = deferred<typeof alertDetailFixture>();
  let deleteCount = 0;
  let requestCount = 0;
  let saveCount = 0;
  const dependencies = createDependencies({
    deleteDetailCache: async () => { deleteCount += 1; },
    fetchDetail: async () => {
      requestCount += 1;
      return requestCount === 1 ? oldRequest.promise : newerRequest.promise;
    },
    saveDetailCache: async () => { saveCount += 1; },
  });

  const oldLoad = loadAlertDetailState('A-018', dependencies);
  await waitFor(() => requestCount === 1);
  const newerLoad = loadAlertDetailState('A-018', dependencies);
  await waitFor(() => requestCount === 2);
  newerRequest.resolve(alertDetailFixture);
  assert.equal((await newerLoad).status, 'ready');
  oldRequest.reject(alertsError('http', 404));
  assert.equal((await oldLoad).status, 'superseded');

  assert.equal(saveCount, 1);
  assert.equal(deleteCount, 0);
  assert.equal(dependencies.detailCacheCoordinator.canUseCachedDetail('A-018'), true);
});

test('a newer success remains final when an older tombstone write was already pending', async () => {
  const oldTombstoneWrite = deferred<void>();
  let cacheState = 'initial';
  let requestCount = 0;
  let tombstoneDeleteCount = 0;
  let tombstoneWriteStarted = false;
  const dependencies = createDependencies({
    deleteDetailCache: async () => { cacheState = 'deleted'; },
    deleteDetailTombstone: async () => { tombstoneDeleteCount += 1; },
    fetchDetail: async () => {
      requestCount += 1;
      if (requestCount === 1) throw alertsError('http', 404);
      return alertDetailFixture;
    },
    saveDetailCache: async () => { cacheState = 'newest'; },
    saveDetailTombstone: async () => {
      tombstoneWriteStarted = true;
      await oldTombstoneWrite.promise;
    },
  });

  const olderLoad = loadAlertDetailState('A-018', dependencies);
  await waitFor(() => tombstoneWriteStarted);
  const newerLoad = loadAlertDetailState('A-018', dependencies);
  oldTombstoneWrite.resolve();

  assert.equal((await olderLoad).status, 'superseded');
  assert.equal((await newerLoad).status, 'ready');
  assert.equal(cacheState, 'newest');
  assert.equal(tombstoneDeleteCount, 1);
  assert.equal(dependencies.detailCacheCoordinator.canUseCachedDetail('A-018'), true);
});

test('superseded detail failures cannot return offline, service-unavailable or error states', async () => {
  for (const error of [
    alertsError('network'),
    alertsError('http', 500),
    alertsError('invalid-response'),
  ]) {
    const olderRequest = deferred<typeof alertDetailFixture>();
    let requestCount = 0;
    const dependencies = createDependencies({
      fetchDetail: async () => {
        requestCount += 1;
        return requestCount === 1 ? olderRequest.promise : alertDetailFixture;
      },
      loadDetailCache: async () => cachedDetail,
    });
    const olderLoad = loadAlertDetailState('A-018', dependencies);
    await waitFor(() => requestCount === 1);
    assert.equal((await loadAlertDetailState('A-018', dependencies)).status, 'ready');
    olderRequest.reject(error);
    assert.equal((await olderLoad).status, 'superseded');
  }
});

test('a genuinely newer success after revocation safely saves and restores the record', async () => {
  let requestCount = 0;
  let saveCount = 0;
  const dependencies = createDependencies({
    fetchDetail: async () => {
      requestCount += 1;
      if (requestCount === 1) throw alertsError('http', 404);
      return alertDetailFixture;
    },
    saveDetailCache: async () => { saveCount += 1; },
  });

  assert.equal((await loadAlertDetailState('A-018', dependencies)).status, 'not-found');
  assert.equal(dependencies.detailCacheCoordinator.canUseCachedDetail('A-018'), false);
  assert.equal((await loadAlertDetailState('A-018', dependencies)).status, 'ready');

  assert.equal(saveCount, 1);
  assert.equal(dependencies.detailCacheCoordinator.canUseCachedDetail('A-018'), true);
});

test('HTTP 500 with alert cache is disclosed as service unavailable, not offline', async () => {
  const state = await loadAlertDetailState('A-018', createDependencies({
    fetchDetail: async () => { throw alertsError('http', 500); },
    loadDetailCache: async () => ({
      schemaVersion: 1,
      cachedAt: '2026-08-10T03:00:00.000Z',
      data: alertDetailFixture,
    }),
  }));
  assert.equal(state.status, 'service-unavailable');
  assert.equal(state.message, 'Service unavailable · showing saved copy');
  assert.equal(state.response?.alert.id, 'A-018');
});

test('invalid alert response enters error state even when a saved copy exists', async () => {
  const state = await loadAlertsListState(createDependencies({
    fetchList: async () => { throw alertsError('invalid-response'); },
    loadListCache: async () => ({
      schemaVersion: 1,
      cachedAt: '2026-08-10T03:00:00.000Z',
      data: alertListFixture,
    }),
  }));
  assert.equal(state.status, 'error');
  assert.equal(state.response, undefined);
});
