import {
  ReportIdSchema,
  ReportRecoveryKeySchema,
  type ReportRecoverableStatus,
  type ReportStatusLookupResponse,
} from '@vbyg/contracts';

import {
  isReportStatusLookupError,
  lookupPrivateReportStatus,
  type ReportStatusLookupFailureKind,
} from '../../api/report-status';

import {
  InvalidRecoveryKeyVaultError,
  recoveryKeyVaultCoordinator,
  type RecoveryKeyVaultCoordinator,
  type RecoveryVaultRecord,
} from './report-recovery-key-storage';

export type ReportRecoveryLookupState =
  | 'loading'
  | 'ready'
  | 'offline'
  | 'invalid-credential'
  | 'unavailable'
  | 'error';

/** Public view model deliberately excludes the recovery key. */
export interface ReportRecoveryViewRecord {
  reportId: string;
  savedAt: string;
  lookupState: ReportRecoveryLookupState;
  submittedAt?: string;
  status?: ReportRecoverableStatus;
  updatedAt?: string;
  nextStep?: string;
  message?: string;
}

export type ReportRecoveryPhase = 'idle' | 'loading' | 'ready' | 'clearing' | 'corrupt-vault';

export interface ReportRecoverySnapshot {
  phase: ReportRecoveryPhase;
  records: readonly ReportRecoveryViewRecord[];
  storageCorrupt: boolean;
  storageMessage?: string;
}

export type ReportRecoveryListener = (snapshot: ReportRecoverySnapshot) => void;

export interface ReportRecoveryVaultPort {
  captureMutationAuthority: () => number;
  revokePendingMutations: () => number;
  read: () => Promise<{ records: RecoveryVaultRecord[] }>;
  upsert: (record: RecoveryVaultRecord, authority?: number) => Promise<unknown | null>;
  clear: (authority?: number) => Promise<boolean>;
  whenIdle: () => Promise<void>;
}

export interface ReportStatusRecoveryDependencies {
  lookup: (request: { reportId: string; recoveryKey: string }) => Promise<ReportStatusLookupResponse>;
  vault: ReportRecoveryVaultPort;
  platform: () => Promise<string>;
  now: () => Date;
}

const defaultDependencies: ReportStatusRecoveryDependencies = {
  lookup: lookupPrivateReportStatus,
  vault: recoveryKeyVaultCoordinator as RecoveryKeyVaultCoordinator,
  platform: async () => (await import('react-native')).Platform.OS,
  now: () => new Date(),
};

type PrivateCredential = RecoveryVaultRecord;

export class ReportStatusRecoveryCoordinator {
  private clearBarrier: Promise<void> = Promise.resolve();
  private credentials = new Map<string, PrivateCredential>();
  private hydrationBarrier: Promise<void> = Promise.resolve();
  private listeners = new Set<ReportRecoveryListener>();
  private persistedCredentials = new Map<string, string>();
  private reportGenerations = new Map<string, number>();
  private sessionGeneration = 0;
  private snapshot: ReportRecoverySnapshot = { phase: 'idle', records: [], storageCorrupt: false };
  private storageReadFailed = false;

  constructor(private readonly dependencies: ReportStatusRecoveryDependencies = defaultDependencies) {}

  getSnapshot(): ReportRecoverySnapshot {
    return cloneSnapshot(this.snapshot);
  }

  subscribe(listener: ReportRecoveryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async hydrate(): Promise<ReportRecoverySnapshot> {
    const session = this.beginSessionOperation();
    this.publish({ ...this.snapshot, phase: 'loading', storageCorrupt: false, storageMessage: undefined });
    const readOperation = this.hydrationBarrier.then(() => this.readCredentialsForHydration(session));
    this.hydrationBarrier = readOperation.then(() => undefined, () => undefined);
    const canRefresh = await readOperation;
    if (!canRefresh || !this.isSessionCurrent(session)) return this.getSnapshot();
    await Promise.all([...this.credentials.keys()].map((reportId) => this.refresh(reportId, session)));
    return this.getSnapshot();
  }

  async addCredential(reportIdInput: string, recoveryKeyInput: string): Promise<ReportRecoverySnapshot> {
    const reportId = ReportIdSchema.safeParse(reportIdInput.trim());
    const recoveryKey = ReportRecoveryKeySchema.safeParse(recoveryKeyInput.trim());
    if (!reportId.success || !recoveryKey.success) {
      throw new InvalidReportRecoveryCredentialError();
    }
    // Capture authority before the first await. A clear, route change or unmount
    // that starts while the barriers are pending must invalidate this add.
    const session = this.sessionGeneration;
    await this.hydrationBarrier;
    await this.clearBarrier;
    if (!this.isSessionCurrent(session)) return this.getSnapshot();
    const generation = this.beginReportOperation(reportId.data);
    const record: PrivateCredential = {
      reportId: reportId.data,
      recoveryKey: recoveryKey.data,
      savedAt: this.dependencies.now().toISOString(),
    };
    this.credentials.set(record.reportId, record);
    this.replaceViewRecord(toLoadingViewRecord(record));

    const result = await this.lookup(record, session, generation);
    if (!this.isReportCurrent(record.reportId, session, generation)) return this.getSnapshot();
    if (result.lookupState === 'ready') await this.persistReadyCredential(record, session, generation);
    if (this.isReportCurrent(record.reportId, session, generation)) {
      this.replaceViewRecord(result, result.lookupState === 'ready' ? undefined : this.snapshot.storageMessage);
    }
    return this.getSnapshot();
  }

  async refresh(reportId: string, expectedSession = this.sessionGeneration): Promise<ReportRecoverySnapshot> {
    const credential = this.credentials.get(reportId);
    if (!credential || expectedSession !== this.sessionGeneration) return this.getSnapshot();
    const generation = this.beginReportOperation(reportId);
    this.replaceViewRecord(toLoadingViewRecord(credential));
    const result = await this.lookup(credential, expectedSession, generation);
    if (result.lookupState === 'ready') await this.persistReadyCredential(credential, expectedSession, generation);
    if (this.isReportCurrent(reportId, expectedSession, generation)) {
      this.replaceViewRecord(result);
    }
    return this.getSnapshot();
  }

  async retry(): Promise<ReportRecoverySnapshot> {
    if (this.storageReadFailed) return this.hydrate();
    const session = this.sessionGeneration;
    await Promise.all([...this.credentials.keys()].map((reportId) => this.refresh(reportId, session)));
    return this.getSnapshot();
  }

  clear(): Promise<ReportRecoverySnapshot> {
    // Revoke synchronously at the public clear entry, before platform
    // resolution or any other await can let an old persistence resume.
    const clearAuthority = this.dependencies.vault.revokePendingMutations();
    const operation = this.performClear(clearAuthority);
    this.clearBarrier = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async performClear(clearAuthority: number): Promise<ReportRecoverySnapshot> {
    const session = this.beginSessionOperation();
    const previousSnapshot = this.getSnapshot();
    this.reportGenerations.clear();
    this.publish({ ...previousSnapshot, phase: 'clearing', storageMessage: undefined });
    const platform = await this.dependencies.platform();
    if (platform !== 'web') {
      try {
        const physicallyCleared = await this.dependencies.vault.clear(clearAuthority);
        if (!physicallyCleared) throw new Error('Secure vault clear was superseded');
      } catch {
        if (this.isSessionCurrent(session)) {
          this.publish({
            ...previousSnapshot,
            storageMessage: 'Saved report access could not be cleared. Existing secure data may remain on this device.',
          });
        }
        return this.getSnapshot();
      }
    }
    this.credentials.clear();
    this.persistedCredentials.clear();
    this.storageReadFailed = false;
    if (this.isSessionCurrent(session)) {
      this.publish({ phase: 'ready', records: [], storageCorrupt: false });
    }
    return this.getSnapshot();
  }

  /** Prevents late work from a route that has unmounted from publishing state. */
  suspend(): void {
    if (this.listeners.size > 0) return;
    this.beginSessionOperation();
    this.reportGenerations.clear();
    this.snapshot = { phase: 'idle', records: [], storageCorrupt: false };
  }

  private async lookup(
    credential: PrivateCredential,
    session: number,
    generation: number,
  ): Promise<ReportRecoveryViewRecord> {
    try {
      const response = await this.dependencies.lookup({
        reportId: credential.reportId,
        recoveryKey: credential.recoveryKey,
      });
      if (!this.isReportCurrent(credential.reportId, session, generation)) return toLoadingViewRecord(credential);
      return {
        reportId: response.reportId,
        savedAt: credential.savedAt,
        lookupState: 'ready',
        submittedAt: response.submittedAt,
        status: response.status,
        updatedAt: response.updatedAt,
        nextStep: response.nextStep,
      };
    } catch (error) {
      return errorViewRecord(credential, isReportStatusLookupError(error) ? error.kind : 'http');
    }
  }

  private async readCredentialsForHydration(session: number): Promise<boolean> {
    await this.clearBarrier;
    if (!this.isSessionCurrent(session)) return false;
    const platform = await this.dependencies.platform();
    if (!this.isSessionCurrent(session)) return false;
    if (platform !== 'web') {
      try {
        await this.dependencies.vault.whenIdle();
        const vault = await this.dependencies.vault.read();
        if (!this.isSessionCurrent(session)) return false;
        this.credentials = new Map(vault.records.map((record) => [record.reportId, record]));
        this.persistedCredentials = new Map(vault.records.map((record) => [record.reportId, record.recoveryKey]));
        this.storageReadFailed = false;
      } catch (error) {
        if (!this.isSessionCurrent(session)) return false;
        const corrupt = error instanceof InvalidRecoveryKeyVaultError;
        if (corrupt) {
          this.credentials.clear();
          this.persistedCredentials.clear();
        }
        this.storageReadFailed = !corrupt;
        this.publish({
          phase: corrupt ? 'corrupt-vault' : 'ready',
          records: corrupt ? [] : [...this.credentials.values()].map(toLoadingViewRecord),
          storageCorrupt: corrupt,
          storageMessage: corrupt
            ? 'Saved report access could not be read. Reset it explicitly before adding another key.'
            : 'Secure report access is temporarily unavailable. Saved data was not replaced.',
        });
        return false;
      }
    }
    const records = [...this.credentials.values()].map(toLoadingViewRecord);
    this.publish({ phase: 'ready', records, storageCorrupt: false });
    return true;
  }

  private async persistReadyCredential(
    credential: PrivateCredential,
    session: number,
    generation: number,
  ): Promise<void> {
    if (!this.isReportCurrent(credential.reportId, session, generation)) return;
    const vaultAuthority = this.dependencies.vault.captureMutationAuthority();
    if (await this.dependencies.platform() === 'web'
      || this.persistedCredentials.get(credential.reportId) === credential.recoveryKey) {
      return;
    }
    try {
      const persisted = await this.dependencies.vault.upsert(credential, vaultAuthority);
      if (persisted === null) return;
      if (!this.isReportCurrent(credential.reportId, session, generation)) return;
      this.persistedCredentials.set(credential.reportId, credential.recoveryKey);
      this.publish({ ...this.snapshot, storageMessage: undefined });
    } catch {
      if (!this.isReportCurrent(credential.reportId, session, generation)) return;
      this.publish({
        ...this.snapshot,
        storageMessage: 'Status loaded, but this recovery key could not be saved securely on this device.',
      });
    }
  }

  private replaceViewRecord(record: ReportRecoveryViewRecord, storageMessage = this.snapshot.storageMessage): void {
    const records = this.snapshot.records.filter((item) => item.reportId !== record.reportId);
    this.publish({
      phase: 'ready',
      records: [...records, record],
      storageCorrupt: this.snapshot.storageCorrupt,
      storageMessage,
    });
  }

  private beginSessionOperation(): number {
    this.sessionGeneration += 1;
    return this.sessionGeneration;
  }

  private beginReportOperation(reportId: string): number {
    const generation = (this.reportGenerations.get(reportId) ?? 0) + 1;
    this.reportGenerations.set(reportId, generation);
    return generation;
  }

  private isSessionCurrent(session: number): boolean {
    return session === this.sessionGeneration;
  }

  private isReportCurrent(reportId: string, session: number, generation: number): boolean {
    return this.isSessionCurrent(session) && this.reportGenerations.get(reportId) === generation;
  }

  private publish(snapshot: ReportRecoverySnapshot): void {
    this.snapshot = cloneSnapshot(snapshot);
    for (const listener of this.listeners) listener(this.getSnapshot());
  }
}

export class InvalidReportRecoveryCredentialError extends Error {
  constructor() {
    super('Enter a valid report ID and recovery key.');
    this.name = 'InvalidReportRecoveryCredentialError';
  }
}

export const reportStatusRecoveryCoordinator = new ReportStatusRecoveryCoordinator();

function toLoadingViewRecord(record: PrivateCredential): ReportRecoveryViewRecord {
  return { reportId: record.reportId, savedAt: record.savedAt, lookupState: 'loading' };
}

function errorViewRecord(
  record: PrivateCredential,
  kind: ReportStatusLookupFailureKind,
): ReportRecoveryViewRecord {
  if (kind === 'network') {
    return {
      reportId: record.reportId,
      savedAt: record.savedAt,
      lookupState: 'offline',
      message: 'Offline. Connect to refresh this report status.',
    };
  }
  if (kind === 'invalid-credential') {
    return {
      reportId: record.reportId,
      savedAt: record.savedAt,
      lookupState: 'invalid-credential',
      message: 'The report ID and recovery key could not be matched.',
    };
  }
  if (kind === 'unavailable' || kind === 'rate-limited') {
    return {
      reportId: record.reportId,
      savedAt: record.savedAt,
      lookupState: 'unavailable',
      message: kind === 'rate-limited'
        ? 'Too many attempts. Wait before trying again.'
        : 'The report status service is temporarily unavailable.',
    };
  }
  return {
    reportId: record.reportId,
    savedAt: record.savedAt,
    lookupState: 'error',
    message: 'This report status could not be loaded.',
  };
}

function cloneSnapshot(snapshot: ReportRecoverySnapshot): ReportRecoverySnapshot {
  return { ...snapshot, records: snapshot.records.map((record) => ({ ...record })) };
}
