import AsyncStorage from '@react-native-async-storage/async-storage';

export const REPORT_EVIDENCE_LIFECYCLE_SCHEMA_VERSION = 1 as const;
export const REPORT_EVIDENCE_LIFECYCLE_STORAGE_KEY = '@vbyg/report-evidence-lifecycle/v1';

export type ReportEvidenceLifecycleOperation = {
  evidenceId: string;
  kind: 'add' | 'remove';
  stage: 'preparing' | 'evidence-written' | 'metadata-removed' | 'committed';
  updatedAt: string;
};

export interface ReportEvidenceLifecycleJournal {
  schemaVersion: typeof REPORT_EVIDENCE_LIFECYCLE_SCHEMA_VERSION;
  operations: ReportEvidenceLifecycleOperation[];
  updatedAt: string;
}

export interface ReportEvidenceLifecycleJournalPort {
  read: () => Promise<{ journal: ReportEvidenceLifecycleJournal; recovered: boolean }>;
  write: (journal: ReportEvidenceLifecycleJournal) => Promise<void>;
}

export interface ReportEvidenceLifecycleKeyValuePort {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
}

const asyncStoragePort: ReportEvidenceLifecycleKeyValuePort = {
  getItem: (key) => AsyncStorage.getItem(key),
  removeItem: (key) => AsyncStorage.removeItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

export function createEmptyReportEvidenceLifecycleJournal(timestamp = new Date().toISOString()): ReportEvidenceLifecycleJournal {
  return {
    schemaVersion: REPORT_EVIDENCE_LIFECYCLE_SCHEMA_VERSION,
    operations: [],
    updatedAt: timestamp,
  };
}

export class LocalReportEvidenceLifecycleJournal implements ReportEvidenceLifecycleJournalPort {
  constructor(
    private readonly storage: ReportEvidenceLifecycleKeyValuePort = asyncStoragePort,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async read(): Promise<{ journal: ReportEvidenceLifecycleJournal; recovered: boolean }> {
    const raw = await this.storage.getItem(REPORT_EVIDENCE_LIFECYCLE_STORAGE_KEY);
    if (raw === null) return { journal: createEmptyReportEvidenceLifecycleJournal(this.now()), recovered: false };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isJournal(parsed)) throw new Error('Invalid evidence lifecycle journal.');
      return { journal: parsed, recovered: false };
    } catch {
      return { journal: createEmptyReportEvidenceLifecycleJournal(this.now()), recovered: true };
    }
  }

  async write(journal: ReportEvidenceLifecycleJournal): Promise<void> {
    if (journal.operations.length === 0) {
      await this.storage.removeItem(REPORT_EVIDENCE_LIFECYCLE_STORAGE_KEY);
      return;
    }
    await this.storage.setItem(REPORT_EVIDENCE_LIFECYCLE_STORAGE_KEY, JSON.stringify(journal));
  }
}

function isJournal(value: unknown): value is ReportEvidenceLifecycleJournal {
  if (!isRecord(value)
    || value.schemaVersion !== REPORT_EVIDENCE_LIFECYCLE_SCHEMA_VERSION
    || !Array.isArray(value.operations)
    || typeof value.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(value.updatedAt))) return false;
  return value.operations.every((operation) => isRecord(operation)
    && typeof operation.evidenceId === 'string'
    && /^evidence-[a-z0-9-]+$/u.test(operation.evidenceId)
    && (operation.kind === 'add' || operation.kind === 'remove')
    && (operation.stage === 'preparing'
      || operation.stage === 'evidence-written'
      || operation.stage === 'metadata-removed'
      || operation.stage === 'committed')
    && typeof operation.updatedAt === 'string'
    && Number.isFinite(Date.parse(operation.updatedAt)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
