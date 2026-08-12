import type { ReportsRepository } from './reports.repository.js';

export const RECOVERY_DELIVERY_CLEANUP_INTERVAL_MS = 60_000;

type CleanupTimer = ReturnType<typeof setInterval>;

export interface RecoveryDeliveryCleanupScheduler {
  setInterval: (callback: () => void, intervalMs: number) => CleanupTimer;
  clearInterval: (timer: CleanupTimer) => void;
}

export interface RecoveryDeliveryCleanupDependencies {
  intervalMs?: number;
  now?: () => Date;
  onError?: (error: unknown) => void;
  scheduler?: RecoveryDeliveryCleanupScheduler;
}

const runtimeScheduler: RecoveryDeliveryCleanupScheduler = {
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (timer) => clearInterval(timer),
};

export class RecoveryDeliveryExpiryCleaner {
  private pending?: Promise<number>;
  private timer?: CleanupTimer;

  constructor(
    private readonly repository: ReportsRepository,
    private readonly dependencies: RecoveryDeliveryCleanupDependencies = {},
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;
    await this.sweep();
    const scheduler = this.dependencies.scheduler ?? runtimeScheduler;
    this.timer = scheduler.setInterval(() => {
      void this.sweep();
    }, this.dependencies.intervalMs ?? RECOVERY_DELIVERY_CLEANUP_INTERVAL_MS);
    this.timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      (this.dependencies.scheduler ?? runtimeScheduler).clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.pending?.catch(() => undefined);
  }

  sweep(): Promise<number> {
    if (this.pending) return this.pending;
    const operation = this.repository
      .clearExpiredRecoveryKeyDeliveries((this.dependencies.now ?? (() => new Date()))())
      .catch((error) => {
        this.dependencies.onError?.(error);
        return 0;
      });
    const tracked = operation.finally(() => {
      if (this.pending === tracked) this.pending = undefined;
    });
    this.pending = tracked;
    return tracked;
  }
}
