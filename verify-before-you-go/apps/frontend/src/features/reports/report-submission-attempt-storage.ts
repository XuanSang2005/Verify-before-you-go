import AsyncStorage from '@react-native-async-storage/async-storage';

import { ReportIdempotencyKeySchema } from '@vbyg/contracts';

export const REPORT_SUBMISSION_ATTEMPT_STORAGE_KEY = 'vbyg.report-submission-attempt.v1';
export const REPORT_SUBMISSION_ATTEMPT_SCHEMA_VERSION = 1 as const;

export interface ReportSubmissionAttempt {
  schemaVersion: typeof REPORT_SUBMISSION_ATTEMPT_SCHEMA_VERSION;
  fingerprint: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface ReportSubmissionAttemptStoragePort {
  load: () => Promise<ReportSubmissionAttempt | null>;
  save: (attempt: ReportSubmissionAttempt) => Promise<void>;
  clear: () => Promise<void>;
}

export class InvalidReportSubmissionAttemptError extends Error {
  constructor() {
    super('The saved submission safety state is invalid. Clear the local report draft before starting a new submission.');
    this.name = 'InvalidReportSubmissionAttemptError';
  }
}

export const reportSubmissionAttemptStorage: ReportSubmissionAttemptStoragePort = {
  async load() {
    const raw = await AsyncStorage.getItem(REPORT_SUBMISSION_ATTEMPT_STORAGE_KEY);
    if (raw === null) return null;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new InvalidReportSubmissionAttemptError();
    }
    if (!isSubmissionAttempt(value)) throw new InvalidReportSubmissionAttemptError();
    return value;
  },
  async save(attempt) {
    await AsyncStorage.setItem(REPORT_SUBMISSION_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
  },
  async clear() {
    await AsyncStorage.removeItem(REPORT_SUBMISSION_ATTEMPT_STORAGE_KEY);
  },
};

function isSubmissionAttempt(value: unknown): value is ReportSubmissionAttempt {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 4
    && record.schemaVersion === REPORT_SUBMISSION_ATTEMPT_SCHEMA_VERSION
    && typeof record.fingerprint === 'string'
    && /^[a-f0-9]{64}$/u.test(record.fingerprint)
    && ReportIdempotencyKeySchema.safeParse(record.idempotencyKey).success
    && typeof record.createdAt === 'string'
    && Number.isFinite(Date.parse(record.createdAt));
}
