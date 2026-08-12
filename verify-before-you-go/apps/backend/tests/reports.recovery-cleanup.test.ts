import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPrismaReportsRepository,
  type ReportsRepository,
} from '../src/modules/reports/reports.repository.js';
import {
  RECOVERY_DELIVERY_CLEANUP_INTERVAL_MS,
  RecoveryDeliveryExpiryCleaner,
  type RecoveryDeliveryCleanupScheduler,
} from '../src/modules/reports/reports.recovery-cleanup.js';

function cleanupRepository(
  clearExpiredRecoveryKeyDeliveries: ReportsRepository['clearExpiredRecoveryKeyDeliveries'],
): ReportsRepository {
  return {
    findByIdempotencyHash: async () => null,
    findStatusByPublicId: async () => null,
    create: async () => { throw new Error('not used'); },
    clearRecoveryKeyDelivery: async () => undefined,
    clearExpiredRecoveryKeyDeliveries,
  };
}

test('automatic cleanup sweeps at startup and on the bounded interval, then stops cleanly', async () => {
  const cutoffs: Date[] = [];
  const scheduleState: { callback?: () => void } = {};
  let scheduledInterval = 0;
  let cleared = 0;
  const timer = { unref() {} } as unknown as ReturnType<typeof setInterval>;
  const scheduler: RecoveryDeliveryCleanupScheduler = {
    setInterval(callback, intervalMs) {
      scheduleState.callback = callback;
      scheduledInterval = intervalMs;
      return timer;
    },
    clearInterval(value) {
      assert.equal(value, timer);
      cleared += 1;
    },
  };
  const times = [
    new Date('2026-08-11T10:10:00.000Z'),
    new Date('2026-08-11T10:11:00.000Z'),
  ];
  const cleaner = new RecoveryDeliveryExpiryCleaner(
    cleanupRepository(async (cutoff) => {
      cutoffs.push(cutoff);
      return 1;
    }),
    { now: () => times[cutoffs.length]!, scheduler },
  );

  await cleaner.start();
  assert.equal(scheduledInterval, RECOVERY_DELIVERY_CLEANUP_INTERVAL_MS);
  assert.deepEqual(cutoffs, [times[0]]);
  scheduleState.callback?.();
  await cleaner.stop();
  assert.deepEqual(cutoffs, times);
  assert.equal(cleared, 1);
});

test('cleanup coalesces overlapping sweeps and reports failures without stopping the server', async () => {
  let calls = 0;
  let release!: (value: number) => void;
  const deferred = new Promise<number>((resolve) => { release = resolve; });
  const cleaner = new RecoveryDeliveryExpiryCleaner(cleanupRepository(async () => {
    calls += 1;
    return deferred;
  }));
  const first = cleaner.sweep();
  const second = cleaner.sweep();
  assert.equal(calls, 1);
  release(2);
  assert.equal(await first, 2);
  assert.equal(await second, 2);

  const errors: unknown[] = [];
  const failing = new RecoveryDeliveryExpiryCleaner(
    cleanupRepository(async () => { throw new Error('database unavailable'); }),
    { onError: (error) => errors.push(error) },
  );
  assert.equal(await failing.sweep(), 0);
  assert.equal(errors.length, 1);
});

test('Prisma cleanup clears only ciphertext whose delivery deadline has expired', async () => {
  let update: unknown;
  const repository = createPrismaReportsRepository({
    recruitmentReport: {
      async updateMany(input: unknown) {
        update = input;
        return { count: 3 };
      },
    },
  } as unknown as Parameters<typeof createPrismaReportsRepository>[0]);
  const cutoff = new Date('2026-08-11T10:10:00.000Z');
  assert.equal(await repository.clearExpiredRecoveryKeyDeliveries(cutoff), 3);
  assert.deepEqual(update, {
    where: {
      recoveryKeyDeliveryCiphertext: { not: null },
      recoveryKeyDeliverUntil: { lte: cutoff },
    },
    data: {
      recoveryKeyDeliveryCiphertext: null,
      recoveryKeyDeliverUntil: null,
    },
  });
});
