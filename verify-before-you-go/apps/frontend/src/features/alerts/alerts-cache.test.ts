import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deleteAlertDetailTombstone,
  loadAlertDetailTombstone,
  loadCachedAlertDetail,
  loadCachedAlertList,
  saveAlertDetailTombstone,
  saveCachedAlertDetail,
  saveCachedAlertList,
  type AlertsCacheStoragePort,
} from './alerts-cache';
import { alertDetailFixture, alertListFixture } from './alerts-test-fixtures';

function createStorage(): AlertsCacheStoragePort & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => { values.delete(key); },
    setItem: async (key, value) => { values.set(key, value); },
  };
}

test('reviewed public alert summaries remain available from versioned offline cache', async () => {
  const storage = createStorage();
  await saveCachedAlertList(alertListFixture, storage, '2026-08-10T03:00:00.000Z');
  const cached = await loadCachedAlertList(storage);
  assert.equal(cached?.data.alerts[0]?.id, 'A-018');
  assert.equal(cached?.cachedAt, '2026-08-10T03:00:00.000Z');
});

test('alert detail cache contains only the public redacted API response', async () => {
  const storage = createStorage();
  await saveCachedAlertDetail('A-018', alertDetailFixture, storage, '2026-08-10T03:00:00.000Z');
  const cached = await loadCachedAlertDetail('A-018', storage);
  assert.equal(cached?.data.alert.id, 'A-018');
  assert.doesNotMatch(JSON.stringify(storage.values), /recovery key|home address|unmasked handle/i);
});

test('corrupt, unsupported or unmasked alert cache is ignored safely', async () => {
  const storage = createStorage();
  storage.values.set('@vbyg/alerts/list/v1', '{broken');
  assert.equal(await loadCachedAlertList(storage), null);
  storage.values.set('@vbyg/alerts/list/v1', JSON.stringify({ schemaVersion: 99, data: alertListFixture }));
  assert.equal(await loadCachedAlertList(storage), null);
  storage.values.set('@vbyg/alerts/list/v1', JSON.stringify({
    schemaVersion: 1,
    cachedAt: '2026-08-10T03:00:00.000Z',
    data: {
      ...alertListFixture,
      alerts: [{ ...alertListFixture.alerts[0], maskedIdentifiers: ['@visible-handle'] }],
    },
  }));
  assert.equal(await loadCachedAlertList(storage), null);
});

test('alert cache storage failures reject without hiding the API result path', async () => {
  const storage: AlertsCacheStoragePort = {
    getItem: async () => { throw new Error('read failed'); },
    removeItem: async () => { throw new Error('remove failed'); },
    setItem: async () => { throw new Error('write failed'); },
  };
  await assert.rejects(() => loadCachedAlertList(storage), /read failed/);
  await assert.rejects(() => saveCachedAlertList(alertListFixture, storage), /write failed/);
});

test('detail tombstones persist only a versioned alert ID and timestamps', async () => {
  const storage = createStorage();
  await saveAlertDetailTombstone('A-018', storage, '2026-08-11T04:00:00.000Z');
  const tombstone = await loadAlertDetailTombstone('A-018', storage);
  assert.deepEqual(tombstone, {
    schemaVersion: 1,
    id: 'A-018',
    revokedAt: '2026-08-11T04:00:00.000Z',
    updatedAt: '2026-08-11T04:00:00.000Z',
  });
  assert.deepEqual(Object.keys(JSON.parse([...storage.values.values()][0]!)).toSorted(), [
    'id',
    'revokedAt',
    'schemaVersion',
    'updatedAt',
  ]);

  await deleteAlertDetailTombstone('A-018', storage);
  assert.equal(await loadAlertDetailTombstone('A-018', storage), null);
});

test('corrupt, mismatched or overbroad tombstones fail closed as storage errors', async () => {
  const storage = createStorage();
  const key = '@vbyg/alerts/tombstone/v1/A-018';
  for (const value of [
    '{broken',
    JSON.stringify({ schemaVersion: 2, id: 'A-018', revokedAt: '2026-08-11T04:00:00.000Z', updatedAt: '2026-08-11T04:00:00.000Z' }),
    JSON.stringify({ schemaVersion: 1, id: 'A-024', revokedAt: '2026-08-11T04:00:00.000Z', updatedAt: '2026-08-11T04:00:00.000Z' }),
    JSON.stringify({ schemaVersion: 1, id: 'A-018', revokedAt: '2026-08-11T04:00:00.000Z', updatedAt: '2026-08-11T04:00:00.000Z', evidence: 'private' }),
  ]) {
    storage.values.set(key, value);
    await assert.rejects(
      () => loadAlertDetailTombstone('A-018', storage),
      /saved alert revocation record is invalid/,
    );
  }
});
