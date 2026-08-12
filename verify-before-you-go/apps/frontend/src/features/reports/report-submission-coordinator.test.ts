import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ReportSubmissionRequest,
  ReportSubmissionResponse,
} from '@vbyg/contracts';

import {
  InvalidReportSubmissionAttemptError,
  type ReportSubmissionAttempt,
  type ReportSubmissionAttemptStoragePort,
} from './report-submission-attempt-storage';
import {
  InvalidRecoveryKeyVaultError,
  RECOVERY_KEY_VAULT_STORAGE_KEY,
  RecoveryKeyVaultCoordinator,
  parseRecoveryVault,
  retainRecoveryKey,
  type SecureRecoveryStoragePort,
} from './report-recovery-key-storage';
import {
  ReportSubmissionCoordinator,
  type ReportSubmissionCoordinatorDependencies,
} from './report-submission-coordinator';

const request: ReportSubmissionRequest = {
  subjectType: 'recruiter',
  identifierType: 'handle',
  identifier: '@example_recruiter',
  behaviourIds: ['pressure'],
  description: '',
  permissions: {
    useForPrivateMatching: true,
    allowRedactedPublicAlert: false,
    shareWithNamedPartner: false,
    namedPartner: '',
  },
};

const response: ReportSubmissionResponse = {
  report: {
    reportId: 'R-23456789ABCDEFGH',
    submittedAt: '2026-08-11T10:00:00.000Z',
    status: 'received',
    statusLabel: 'Received — not yet reviewed.',
    privateIntakeNotice: 'This private receipt does not mean the report has been reviewed, verified or published.',
  },
  recoveryKey: '2345-6789-ABCD-EFGH-JKLM-NPQR-ST',
  recoveryKeyStatus: 'delivered',
};

class MemoryAttemptStorage implements ReportSubmissionAttemptStoragePort {
  attempt: ReportSubmissionAttempt | null = null;
  reads = 0;
  writes = 0;
  failWrite = false;
  loadError?: Error;

  async load() {
    this.reads += 1;
    if (this.loadError) throw this.loadError;
    return this.attempt;
  }

  async save(attempt: ReportSubmissionAttempt) {
    this.writes += 1;
    if (this.failWrite) throw new Error('attempt write failed');
    this.attempt = attempt;
  }

  async clear() {
    this.attempt = null;
  }
}

function dependencies(submit: ReportSubmissionCoordinatorDependencies['submit']): ReportSubmissionCoordinatorDependencies {
  return {
    submit,
    fingerprint: async (value) => value.description === 'changed' ? 'b'.repeat(64) : 'a'.repeat(64),
    createIdempotencyKey: async () => 'coordinator_test_key_1234567890',
    retain: async () => ({ status: 'shown-once-web', message: 'Shown once.' }),
    now: () => new Date('2026-08-11T10:00:00.000Z'),
  };
}

test('failed submission and retry reuse the same durable idempotency key', async () => {
  const storage = new MemoryAttemptStorage();
  const keys: string[] = [];
  let call = 0;
  const coordinator = new ReportSubmissionCoordinator(storage, dependencies(async (_value, key) => {
    keys.push(key);
    call += 1;
    if (call === 1) throw new Error('network failed');
    return response;
  }));

  await assert.rejects(coordinator.submit(request), /network failed/);
  const result = await coordinator.submit(request);
  assert.equal(result.response.report.reportId, response.report.reportId);
  assert.deepEqual(keys, ['coordinator_test_key_1234567890', 'coordinator_test_key_1234567890']);
  assert.equal(storage.writes, 1);
});

test('a remounted coordinator reads the pending attempt before retrying', async () => {
  const storage = new MemoryAttemptStorage();
  const first = new ReportSubmissionCoordinator(storage, dependencies(async () => { throw new Error('offline'); }));
  await assert.rejects(first.submit(request));

  const keys: string[] = [];
  const remounted = new ReportSubmissionCoordinator(storage, dependencies(async (_value, key) => {
    keys.push(key);
    return response;
  }));
  await remounted.submit(request);
  assert.deepEqual(keys, ['coordinator_test_key_1234567890']);
  assert.equal(storage.writes, 1);
  assert.ok(storage.reads >= 2);
});

test('a changed payload creates a new attempt while a failed safety-state write blocks the API', async () => {
  const storage = new MemoryAttemptStorage();
  let keyNumber = 0;
  let apiCalls = 0;
  const coordinator = new ReportSubmissionCoordinator(storage, {
    ...dependencies(async () => { apiCalls += 1; return response; }),
    createIdempotencyKey: async () => `coordinator_test_key_123456789${keyNumber++}`,
  });
  await coordinator.submit(request);
  await coordinator.submit({ ...request, description: 'changed' });
  assert.equal(storage.writes, 2);
  assert.equal(apiCalls, 2);

  const failingStorage = new MemoryAttemptStorage();
  failingStorage.failWrite = true;
  const blocked = new ReportSubmissionCoordinator(failingStorage, dependencies(async () => {
    apiCalls += 1;
    return response;
  }));
  await assert.rejects(blocked.submit(request), /attempt write failed/);
  assert.equal(apiCalls, 2);
});

test('corrupt durable submission state is preserved until an explicit clear action', async () => {
  const storage = new MemoryAttemptStorage();
  storage.loadError = new InvalidReportSubmissionAttemptError();
  let apiCalls = 0;
  const coordinator = new ReportSubmissionCoordinator(storage, dependencies(async () => {
    apiCalls += 1;
    return response;
  }));
  await assert.rejects(coordinator.submit(request), InvalidReportSubmissionAttemptError);
  assert.equal(apiCalls, 0);
  assert.equal(storage.attempt, null);
  storage.loadError = undefined;
  await coordinator.clearAttempt();
  await coordinator.submit(request);
  assert.equal(apiCalls, 1);
});

test('web never persists a recovery key and native uses one authoritative atomic vault write', async () => {
  const calls: { key: string; value: string }[] = [];
  let storedValue: string | null = null;
  const storage: SecureRecoveryStoragePort = {
    getItemAsync: async () => storedValue,
    setItemAsync: async (key, value) => { calls.push({ key, value }); storedValue = value; },
  };
  const web = await retainRecoveryKey(response, 'web', storage);
  assert.equal(web.status, 'shown-once-web');
  assert.equal(calls.length, 0);

  const native = await retainRecoveryKey(response, 'ios', storage, () => new Date('2026-08-11T10:01:00.000Z'));
  assert.equal(native.status, 'saved-securely');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.key, RECOVERY_KEY_VAULT_STORAGE_KEY);
  assert.match(calls[0]?.value ?? '', /2345-6789-ABCD/iu);
  assert.deepEqual(parseRecoveryVault(storedValue).records.map((record) => record.reportId), ['R-23456789ABCDEFGH']);
});

test('receipt retention captured before platform resolution cannot write after clear', async () => {
  let storedValue: string | null = null;
  const writes: string[] = [];
  const vault = new RecoveryKeyVaultCoordinator(async () => ({
    storage: {
      getItemAsync: async () => storedValue,
      setItemAsync: async (_key, value) => {
        writes.push(value);
        storedValue = value;
      },
    },
  }));
  let releasePlatform!: (platform: string) => void;
  let signalPlatform!: () => void;
  const platformStarted = new Promise<void>((resolve) => { signalPlatform = resolve; });
  const platformGate = new Promise<string>((resolve) => { releasePlatform = resolve; });

  const retaining = retainRecoveryKey(
    response,
    undefined,
    undefined,
    () => new Date('2026-08-11T10:01:00.000Z'),
    {
      vault,
      resolvePlatform: () => {
        signalPlatform();
        return platformGate;
      },
    },
  );
  await platformStarted;
  assert.equal(await vault.clear(), true);
  releasePlatform('ios');
  const result = await retaining;
  await vault.whenIdle();

  assert.equal(result.status, 'storage-failed');
  assert.notEqual(result.status, 'saved-securely');
  assert.equal(writes.length, 1);
  assert.deepEqual(parseRecoveryVault(storedValue).records, []);
  assert.equal((storedValue ?? '').includes(response.recoveryKey ?? ''), false);
});

test('receipt retention stale upsert is rejected inside the serialized vault queue', async () => {
  let storedValue: string | null = null;
  const writes: string[] = [];
  let releaseQueue!: () => void;
  let signalQueue!: () => void;
  const queueHeld = new Promise<void>((resolve) => { signalQueue = resolve; });
  const queueGate = new Promise<void>((resolve) => { releaseQueue = resolve; });
  let holdFirstRead = true;
  const vault = new RecoveryKeyVaultCoordinator(async () => ({
    storage: {
      getItemAsync: async () => {
        if (holdFirstRead) {
          holdFirstRead = false;
          signalQueue();
          await queueGate;
        }
        return storedValue;
      },
      setItemAsync: async (_key, value) => {
        writes.push(value);
        storedValue = value;
      },
    },
  }));

  const holdingOperation = vault.read();
  await queueHeld;
  const retaining = retainRecoveryKey(
    response,
    'ios',
    undefined,
    () => new Date('2026-08-11T10:01:00.000Z'),
    { vault },
  );
  const clearing = vault.clear();
  releaseQueue();

  await holdingOperation;
  const result = await retaining;
  assert.equal(await clearing, true);
  await vault.whenIdle();

  assert.equal(result.status, 'storage-failed');
  assert.notEqual(result.status, 'saved-securely');
  assert.equal(writes.length, 1);
  assert.deepEqual(parseRecoveryVault(storedValue).records, []);
  assert.equal((storedValue ?? '').includes(response.recoveryKey ?? ''), false);
});

test('native recovery vault survives remount and a failed write leaves the previous valid state', async () => {
  let storedValue: string | null = null;
  let failNextWrite = false;
  const storage: SecureRecoveryStoragePort = {
    getItemAsync: async () => storedValue,
    setItemAsync: async (_key, value) => {
      if (failNextWrite) throw new Error('secure write failed');
      storedValue = value;
    },
  };
  await retainRecoveryKey(response, 'ios', storage);
  const previous = storedValue;
  failNextWrite = true;
  await assert.rejects(retainRecoveryKey({
    ...response,
    report: { ...response.report, reportId: 'R-23456789ABCDEFGJ' },
    recoveryKey: '3456-789A-BCDE-FGHJ-KLMN-PQRS-TU',
  }, 'ios', storage), /secure write failed/);
  assert.equal(storedValue, previous);

  failNextWrite = false;
  await retainRecoveryKey({
    ...response,
    report: { ...response.report, reportId: 'R-23456789ABCDEFGJ' },
    recoveryKey: '3456-789A-BCDE-FGHJ-KLMN-PQRS-TU',
  }, 'ios', storage);
  assert.deepEqual(
    parseRecoveryVault(storedValue).records.map((record) => record.reportId),
    ['R-23456789ABCDEFGH', 'R-23456789ABCDEFGJ'],
  );
});

test('corrupt native recovery metadata is a recoverable error and is never replaced silently', async () => {
  let writes = 0;
  const storage: SecureRecoveryStoragePort = {
    getItemAsync: async () => '{"schemaVersion":2,"records":"broken"}',
    setItemAsync: async () => { writes += 1; },
  };
  await assert.rejects(
    retainRecoveryKey(response, 'android', storage),
    InvalidRecoveryKeyVaultError,
  );
  assert.equal(writes, 0);
});

test('a replay without a recovery key does not read or mutate secure storage', async () => {
  let operations = 0;
  const storage: SecureRecoveryStoragePort = {
    getItemAsync: async () => { operations += 1; return null; },
    setItemAsync: async () => { operations += 1; },
  };
  const retained = await retainRecoveryKey({
    ...response,
    recoveryKey: null,
    recoveryKeyStatus: 'unavailable',
  }, 'ios', storage);
  assert.equal(retained.status, 'unavailable');
  assert.equal(operations, 0);
});
