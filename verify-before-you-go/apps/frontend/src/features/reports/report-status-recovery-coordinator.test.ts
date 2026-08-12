import assert from 'node:assert/strict';
import test from 'node:test';

import type { ReportStatusLookupResponse } from '@vbyg/contracts';

import { ReportStatusLookupError } from '../../api/report-status';
import {
  InvalidRecoveryKeyVaultError,
  RecoveryKeyVaultCoordinator,
  type RecoveryKeyVaultStorageBinding,
  type RecoveryVaultRecord,
} from './report-recovery-key-storage';
import {
  ReportStatusRecoveryCoordinator,
  type ReportStatusRecoveryDependencies,
} from './report-status-recovery-coordinator';

const reportId = 'R-23456789ABCDEFGH';
const recoveryKey = '2345-6789-ABCD-EFGH-JKLM-NPQR-ST';
const response: ReportStatusLookupResponse = {
  reportId,
  submittedAt: '2026-08-12T09:00:00.000Z',
  status: 'received',
  updatedAt: '2026-08-12T10:00:00.000Z',
  nextStep: 'Keep your recovery key private and check again later.',
};

class MemoryVault {
  authority = 0;
  records: RecoveryVaultRecord[] = [];
  reads = 0;
  writes = 0;
  clears = 0;
  corrupt = false;

  async read() {
    this.reads += 1;
    if (this.corrupt) throw new InvalidRecoveryKeyVaultError();
    return { records: this.records.map((record) => ({ ...record })) };
  }
  captureMutationAuthority() {
    return this.authority;
  }
  revokePendingMutations() {
    this.authority += 1;
    return this.authority;
  }
  async upsert(record: RecoveryVaultRecord, authority = this.captureMutationAuthority()) {
    if (authority !== this.authority) return null;
    this.writes += 1;
    this.records = [...this.records.filter((item) => item.reportId !== record.reportId), { ...record }];
    return { records: this.records };
  }
  clear(authority = this.revokePendingMutations()) {
    return this.performClear(authority);
  }
  private async performClear(authority: number) {
    if (authority !== this.authority) return false;
    this.clears += 1;
    this.records = [];
    this.corrupt = false;
    return true;
  }
  async whenIdle() {}
}

function dependencies(
  platform: 'web' | 'ios',
  vault: MemoryVault,
  lookup: ReportStatusRecoveryDependencies['lookup'] = async () => response,
): ReportStatusRecoveryDependencies {
  return { lookup, vault, platform: async () => platform, now: () => new Date('2026-08-12T11:00:00.000Z') };
}

test('web credentials stay only in the running session and disappear after a browser reload', async () => {
  const vault = new MemoryVault();
  const first = new ReportStatusRecoveryCoordinator(dependencies('web', vault));
  const added = await first.addCredential(reportId, recoveryKey);
  assert.equal(added.records[0]?.lookupState, 'ready');
  assert.doesNotMatch(JSON.stringify(added), new RegExp(recoveryKey, 'u'));
  assert.equal(vault.reads + vault.writes, 0);
  first.suspend();

  const routeRemount = await first.hydrate();
  assert.equal(routeRemount.records[0]?.lookupState, 'ready');
  assert.equal(vault.reads + vault.writes, 0);

  // A fresh module/coordinator models a browser refresh and has no raw key to restore.
  const remounted = new ReportStatusRecoveryCoordinator(dependencies('web', vault));
  assert.deepEqual((await remounted.hydrate()).records, []);
  assert.equal(vault.reads + vault.writes, 0);
});

test('native uses the existing single-key vault and corruption requires explicit clear', async () => {
  const vault = new MemoryVault();
  const coordinator = new ReportStatusRecoveryCoordinator(dependencies('ios', vault));
  await coordinator.addCredential(reportId, recoveryKey);
  assert.equal(vault.writes, 1);

  const remounted = new ReportStatusRecoveryCoordinator(dependencies('ios', vault));
  assert.equal((await remounted.hydrate()).records[0]?.lookupState, 'ready');
  vault.corrupt = true;
  const corrupt = await new ReportStatusRecoveryCoordinator(dependencies('ios', vault)).hydrate();
  assert.equal(corrupt.storageCorrupt, true);
  assert.equal(corrupt.phase, 'corrupt-vault');
  assert.equal(vault.writes, 1);
  const cleared = await new ReportStatusRecoveryCoordinator(dependencies('ios', vault)).clear();
  assert.equal(cleared.storageCorrupt, false);
  assert.equal(vault.clears, 1);
});

test('clear supersedes pending lookup so late success cannot restore or persist a key', async () => {
  const vault = new MemoryVault();
  let resolve!: (value: ReportStatusLookupResponse) => void;
  const pending = new Promise<ReportStatusLookupResponse>((done) => { resolve = done; });
  const coordinator = new ReportStatusRecoveryCoordinator(dependencies('ios', vault, async () => pending));
  const adding = coordinator.addCredential(reportId, recoveryKey);
  await Promise.resolve();
  await coordinator.clear();
  resolve(response);
  await adding;
  assert.deepEqual(coordinator.getSnapshot().records, []);
  assert.equal(vault.writes, 0);
  assert.equal(vault.clears, 1);
});

test('clear revokes immediately while clear platform resolution is still pending', async () => {
  let raw: string | null = null;
  const vault = new RecoveryKeyVaultCoordinator(async () => ({
    storage: {
      getItemAsync: async () => raw,
      setItemAsync: async (_key, value) => { raw = value; },
    },
  }));
  let releasePersistencePlatform!: (platform: string) => void;
  let signalPersistencePlatform!: () => void;
  const persistencePlatformStarted = new Promise<void>((resolve) => { signalPersistencePlatform = resolve; });
  const delayedPersistencePlatform = new Promise<string>((resolve) => { releasePersistencePlatform = resolve; });
  let releaseClearPlatform!: (platform: string) => void;
  let signalClearPlatform!: () => void;
  const clearPlatformStarted = new Promise<void>((resolve) => { signalClearPlatform = resolve; });
  const delayedClearPlatform = new Promise<string>((resolve) => { releaseClearPlatform = resolve; });
  let platformCalls = 0;
  const coordinator = new ReportStatusRecoveryCoordinator({
    lookup: async () => response,
    vault,
    platform: () => {
      platformCalls += 1;
      if (platformCalls === 1) {
        signalPersistencePlatform();
        return delayedPersistencePlatform;
      }
      signalClearPlatform();
      return delayedClearPlatform;
    },
    now: () => new Date('2026-08-12T11:00:00.000Z'),
  });

  const adding = coordinator.addCredential(reportId, recoveryKey);
  await persistencePlatformStarted;
  const clearing = coordinator.clear();
  await clearPlatformStarted;
  releasePersistencePlatform('ios');
  await adding;
  await vault.whenIdle();
  // Clear has not reached its physical write yet, but the old authority was
  // revoked synchronously and therefore cannot write the recovery key.
  assert.equal(raw, null);

  releaseClearPlatform('ios');
  const cleared = await clearing;
  await vault.whenIdle();

  assert.deepEqual(cleared.records, []);
  assert.deepEqual(coordinator.getSnapshot().records, []);
  assert.deepEqual(JSON.parse(raw ?? '{}').records, []);
  assert.equal((raw ?? '').includes(recoveryKey), false);
});

test('serialized mutation boundary rejects a stale queued upsert before the empty write', async () => {
  let raw: string | null = null;
  let releaseQueue!: () => void;
  let signalQueue!: () => void;
  const queueHeld = new Promise<void>((resolve) => { signalQueue = resolve; });
  const queueGate = new Promise<void>((resolve) => { releaseQueue = resolve; });
  let holdFirstRead = true;
  const writes: string[] = [];
  const vault = new RecoveryKeyVaultCoordinator(async () => ({
    storage: {
      getItemAsync: async () => {
        if (holdFirstRead) {
          holdFirstRead = false;
          signalQueue();
          await queueGate;
        }
        return raw;
      },
      setItemAsync: async (_key, value) => {
        writes.push(value);
        raw = value;
      },
    },
  }));

  const holdingOperation = vault.read();
  await queueHeld;
  const staleAuthority = vault.captureMutationAuthority();
  const staleUpsert = vault.upsert(
    { reportId, recoveryKey, savedAt: '2026-08-12T11:00:00.000Z' },
    staleAuthority,
  );
  const clearAuthority = vault.revokePendingMutations();
  const clearing = vault.clear(clearAuthority);
  releaseQueue();

  await holdingOperation;
  assert.equal(await staleUpsert, null);
  assert.equal(await clearing, true);
  await vault.whenIdle();

  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(raw ?? '{}').records, []);
  assert.equal((raw ?? '').includes(recoveryKey), false);
});

test('unmount plus clear invalidates pending persistence without restoring a physical key', async () => {
  let raw: string | null = null;
  const serializedVault = new RecoveryKeyVaultCoordinator(async () => ({
    storage: {
      getItemAsync: async () => raw,
      setItemAsync: async (_key, value) => { raw = value; },
    },
  }));
  let releaseUpsert!: () => void;
  let signalUpsert!: () => void;
  const upsertStarted = new Promise<void>((resolve) => { signalUpsert = resolve; });
  const upsertGate = new Promise<void>((resolve) => { releaseUpsert = resolve; });
  const vault: ReportStatusRecoveryDependencies['vault'] = {
    captureMutationAuthority: () => serializedVault.captureMutationAuthority(),
    revokePendingMutations: () => serializedVault.revokePendingMutations(),
    read: () => serializedVault.read(),
    upsert: async (record, authority) => {
      signalUpsert();
      await upsertGate;
      return serializedVault.upsert(record, authority);
    },
    clear: (authority) => serializedVault.clear(authority),
    whenIdle: () => serializedVault.whenIdle(),
  };
  const coordinator = new ReportStatusRecoveryCoordinator({
    ...dependencies('ios', new MemoryVault()),
    vault,
  });

  const adding = coordinator.addCredential(reportId, recoveryKey);
  await upsertStarted;
  coordinator.suspend();
  await coordinator.clear();
  releaseUpsert();
  await adding;
  await serializedVault.whenIdle();

  assert.deepEqual(coordinator.getSnapshot().records, []);
  assert.deepEqual(JSON.parse(raw ?? '{}').records, []);
  assert.equal((raw ?? '').includes(recoveryKey), false);
});

test('suspend ignores an unmounted route late response and invalid/offline failures are safe', async () => {
  const vault = new MemoryVault();
  let resolve!: (value: ReportStatusLookupResponse) => void;
  const pending = new Promise<ReportStatusLookupResponse>((done) => { resolve = done; });
  const coordinator = new ReportStatusRecoveryCoordinator(dependencies('web', vault, async () => pending));
  const adding = coordinator.addCredential(reportId, recoveryKey);
  coordinator.suspend();
  resolve(response);
  await adding;
  assert.deepEqual(coordinator.getSnapshot().records, []);

  const invalid = new ReportStatusRecoveryCoordinator(dependencies('web', vault, async () => {
    throw new ReportStatusLookupError('invalid-credential', 'generic');
  }));
  assert.equal((await invalid.addCredential(reportId, recoveryKey)).records[0]?.lookupState, 'invalid-credential');
  assert.doesNotMatch(JSON.stringify(invalid.getSnapshot()), new RegExp(recoveryKey, 'u'));

  const offline = new ReportStatusRecoveryCoordinator(dependencies('web', vault, async () => {
    throw new ReportStatusLookupError('network', 'offline');
  }));
  assert.equal((await offline.addCredential(reportId, recoveryKey)).records[0]?.lookupState, 'offline');
});

test('single-key vault serializes upsert and clear with failed writes preserving prior data', async () => {
  let raw: string | null = null;
  let fail = false;
  const binding: RecoveryKeyVaultStorageBinding = {
    storage: {
      getItemAsync: async () => raw,
      setItemAsync: async (_key, value) => {
        if (fail) throw new Error('secure store unavailable');
        raw = value;
      },
    },
  };
  const vault = new RecoveryKeyVaultCoordinator(async () => binding);
  await vault.upsert({ reportId, recoveryKey, savedAt: '2026-08-12T10:00:00.000Z' });
  const previous = raw;
  fail = true;
  await assert.rejects(vault.clear(), /secure store unavailable/u);
  assert.equal(raw, previous);
});

test('native coordinator keeps its authoritative view when secure-vault clear fails', async () => {
  const vault = new MemoryVault();
  const coordinator = new ReportStatusRecoveryCoordinator(dependencies('ios', vault));
  await coordinator.addCredential(reportId, recoveryKey);
  vault.clear = async () => {
    vault.clears += 1;
    throw new Error('secure store unavailable');
  };

  const result = await coordinator.clear();

  assert.equal(result.phase, 'ready');
  assert.equal(result.records[0]?.reportId, reportId);
  assert.equal(result.records[0]?.lookupState, 'ready');
  assert.match(result.storageMessage ?? '', /could not be cleared/iu);
  assert.equal(vault.records[0]?.reportId, reportId);
});

test('native save failure is disclosed and retry preserves the session change', async () => {
  const vault = new MemoryVault();
  const originalUpsert = vault.upsert.bind(vault);
  let failWrite = true;
  vault.upsert = async (record, authority) => {
    if (failWrite) {
      vault.writes += 1;
      throw new Error('secure store unavailable');
    }
    return originalUpsert(record, authority);
  };
  const coordinator = new ReportStatusRecoveryCoordinator(dependencies('ios', vault));

  const failedSave = await coordinator.addCredential(reportId, recoveryKey);
  assert.equal(failedSave.records[0]?.lookupState, 'ready');
  assert.match(failedSave.storageMessage ?? '', /could not be saved securely/iu);
  assert.equal(vault.records.length, 0);

  failWrite = false;
  const retried = await coordinator.retry();
  assert.equal(retried.storageMessage, undefined);
  assert.equal(retried.records[0]?.lookupState, 'ready');
  assert.equal(vault.records[0]?.reportId, reportId);
});

test('a failed initial vault read cannot overwrite older secure records', async () => {
  const olderReport = 'R-3456789ABCDEFGHJ';
  const olderKey = '3456-789A-BCDE-FGHJ-KLMN-PQRS-TU';
  let raw = JSON.stringify({
    schemaVersion: 2,
    records: [{ reportId: olderReport, recoveryKey: olderKey, savedAt: '2026-08-11T10:00:00.000Z' }],
  });
  let failRead = true;
  const serializedVault = new RecoveryKeyVaultCoordinator(async () => ({
    storage: {
      getItemAsync: async () => {
        if (failRead) throw new Error('temporary secure storage read failure');
        return raw;
      },
      setItemAsync: async (_key, value) => { raw = value; },
    },
  }));
  const coordinator = new ReportStatusRecoveryCoordinator({
    lookup: async (request) => ({ ...response, reportId: request.reportId }),
    vault: serializedVault,
    platform: async () => 'ios',
    now: () => new Date('2026-08-12T11:00:00.000Z'),
  });

  const failedHydration = await coordinator.hydrate();
  assert.match(failedHydration.storageMessage ?? '', /temporarily unavailable/iu);
  failRead = false;
  await coordinator.addCredential(reportId, recoveryKey);

  assert.deepEqual(
    JSON.parse(raw).records.map((record: RecoveryVaultRecord) => record.reportId).sort(),
    [olderReport, reportId].sort(),
  );
});

test('route remount waits for an authoritative clear and cannot rehydrate a removed key', async () => {
  const vault = new MemoryVault();
  const coordinator = new ReportStatusRecoveryCoordinator(dependencies('ios', vault));
  await coordinator.addCredential(reportId, recoveryKey);
  let finishClear!: () => void;
  const clearGate = new Promise<void>((resolve) => { finishClear = resolve; });
  vault.clear = async () => {
    vault.clears += 1;
    await clearGate;
    vault.records = [];
    return true;
  };

  const clearing = coordinator.clear();
  coordinator.suspend();
  const hydrating = coordinator.hydrate();
  let hydrated = false;
  void hydrating.then(() => { hydrated = true; });
  await Promise.resolve();
  assert.equal(hydrated, false);

  finishClear();
  await clearing;
  const result = await hydrating;
  assert.deepEqual(result.records, []);
  assert.equal(vault.reads, 1);
});
