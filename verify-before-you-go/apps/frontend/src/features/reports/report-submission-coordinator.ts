import type {
  ReportSubmissionRequest,
  ReportSubmissionResponse,
} from '@vbyg/contracts';

import { submitPrivateReport } from '../../api/reports';

import {
  reportSubmissionAttemptStorage,
  type ReportSubmissionAttempt,
  type ReportSubmissionAttemptStoragePort,
} from './report-submission-attempt-storage';
import {
  retainRecoveryKey,
  type RecoveryKeyRetentionResult,
} from './report-recovery-key-storage';

export interface ReportSubmissionResult {
  response: ReportSubmissionResponse;
  retention: RecoveryKeyRetentionResult;
}

export interface ReportSubmissionCoordinatorDependencies {
  submit: (request: ReportSubmissionRequest, idempotencyKey: string) => Promise<ReportSubmissionResponse>;
  fingerprint: (request: ReportSubmissionRequest) => Promise<string>;
  createIdempotencyKey: () => Promise<string>;
  retain: (response: ReportSubmissionResponse) => Promise<RecoveryKeyRetentionResult>;
  now: () => Date;
}

const defaultDependencies: ReportSubmissionCoordinatorDependencies = {
  submit: submitPrivateReport,
  fingerprint: createRequestFingerprint,
  createIdempotencyKey: createIdempotencyKey,
  retain: retainRecoveryKey,
  now: () => new Date(),
};

export class ReportSubmissionCoordinator {
  private currentAttempt?: ReportSubmissionAttempt;
  private operation: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: ReportSubmissionAttemptStoragePort = reportSubmissionAttemptStorage,
    private readonly dependencies: ReportSubmissionCoordinatorDependencies = defaultDependencies,
  ) {}

  async submit(request: ReportSubmissionRequest): Promise<ReportSubmissionResult> {
    return this.serialize(async () => {
      const fingerprint = await this.dependencies.fingerprint(request);
      const attempt = await this.getOrCreateAttempt(fingerprint);
      const response = await this.dependencies.submit(request, attempt.idempotencyKey);
      const retention = await this.dependencies.retain(response).catch(() => ({
        status: 'storage-failed' as const,
        message: 'The report was received, but this device could not save the recovery key securely. Copy it now.',
      }));
      return { response, retention };
    });
  }

  async clearAttempt(): Promise<void> {
    await this.serialize(async () => {
      await this.storage.clear();
      this.currentAttempt = undefined;
    });
  }

  private async getOrCreateAttempt(fingerprint: string): Promise<ReportSubmissionAttempt> {
    const saved = this.currentAttempt ?? await this.storage.load();
    if (saved?.fingerprint === fingerprint) {
      this.currentAttempt = saved;
      return saved;
    }
    const attempt: ReportSubmissionAttempt = {
      schemaVersion: 1,
      fingerprint,
      idempotencyKey: await this.dependencies.createIdempotencyKey(),
      createdAt: this.dependencies.now().toISOString(),
    };
    await this.storage.save(attempt);
    this.currentAttempt = attempt;
    return attempt;
  }

  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}

export const reportSubmissionCoordinator = new ReportSubmissionCoordinator();

async function createRequestFingerprint(request: ReportSubmissionRequest): Promise<string> {
  const { CryptoDigestAlgorithm, digestStringAsync } = await import('expo-crypto');
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, JSON.stringify(request));
}

async function createIdempotencyKey(): Promise<string> {
  const { getRandomBytesAsync } = await import('expo-crypto');
  const bytes = await getRandomBytesAsync(24);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
