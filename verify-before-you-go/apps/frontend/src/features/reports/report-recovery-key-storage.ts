import {
  ReportIdSchema,
  ReportRecoveryKeySchema,
  type ReportSubmissionResponse,
} from '@vbyg/contracts';

export const RECOVERY_KEY_VAULT_SCHEMA_VERSION = 2 as const;
export const RECOVERY_KEY_VAULT_STORAGE_KEY = 'vbyg.report-recovery.vault.v2';

export interface SecureRecoveryStoragePort {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: Record<string, unknown>) => Promise<void>;
}

export interface RecoveryKeyRetentionResult {
  status: 'saved-securely' | 'shown-once-web' | 'storage-failed' | 'unavailable';
  message: string;
}

export interface RecoveryVaultRecord {
  reportId: string;
  recoveryKey: string;
  savedAt: string;
}

export interface RecoveryVault {
  schemaVersion: typeof RECOVERY_KEY_VAULT_SCHEMA_VERSION;
  records: RecoveryVaultRecord[];
}

export class InvalidRecoveryKeyVaultError extends Error {
  constructor() {
    super('Secure recovery-key storage is invalid. Retry after checking this device storage; no saved key was replaced.');
    this.name = 'InvalidRecoveryKeyVaultError';
  }
}

export async function retainRecoveryKey(
  response: ReportSubmissionResponse,
  platform?: string,
  storage?: SecureRecoveryStoragePort,
  now = () => new Date(),
): Promise<RecoveryKeyRetentionResult> {
  if (!response.recoveryKey || response.recoveryKeyStatus === 'unavailable') {
    return {
      status: 'unavailable',
      message: 'The recovery key is no longer available from this retry. Use the copy saved from the initial receipt.',
    };
  }

  const targetPlatform = platform ?? (await import('react-native')).Platform.OS;
  if (targetPlatform === 'web') {
    return {
      status: 'shown-once-web',
      message: 'This browser does not save the recovery key automatically. Copy or download it now.',
    };
  }

  const nextRecord: RecoveryVaultRecord = {
    reportId: response.report.reportId,
    recoveryKey: response.recoveryKey,
    savedAt: now().toISOString(),
  };
  const vault = storage
    ? new RecoveryKeyVaultCoordinator(async () => ({ storage }))
    : recoveryKeyVaultCoordinator;
  await vault.upsert(nextRecord);
  return {
    status: 'saved-securely',
    message: 'The recovery key was saved in secure device storage.',
  };
}

export interface RecoveryKeyVaultStorageBinding {
  storage: SecureRecoveryStoragePort;
  options?: Record<string, unknown>;
}

type RecoveryKeyVaultStorageFactory = () => Promise<RecoveryKeyVaultStorageBinding>;

/**
 * Serializes every mutation of the existing single-key SecureStore vault. A failed
 * mutation leaves the previously committed vault untouched and a corrupt vault is
 * never silently replaced.
 */
export class RecoveryKeyVaultCoordinator {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly createStorage: RecoveryKeyVaultStorageFactory = createSecureStoreBinding) {}

  read(): Promise<RecoveryVault> {
    return this.serialize(async () => {
      const { storage } = await this.createStorage();
      return parseRecoveryVault(await storage.getItemAsync(RECOVERY_KEY_VAULT_STORAGE_KEY));
    });
  }

  upsert(record: RecoveryVaultRecord): Promise<RecoveryVault> {
    return this.serialize(async () => {
      if (!isRecoveryVaultRecord(record)) throw new InvalidRecoveryKeyVaultError();
      const { options, storage } = await this.createStorage();
      const current = parseRecoveryVault(await storage.getItemAsync(RECOVERY_KEY_VAULT_STORAGE_KEY));
      const next: RecoveryVault = {
        schemaVersion: RECOVERY_KEY_VAULT_SCHEMA_VERSION,
        records: [...current.records.filter((item) => item.reportId !== record.reportId), record],
      };
      await storage.setItemAsync(RECOVERY_KEY_VAULT_STORAGE_KEY, JSON.stringify(next), options);
      return next;
    });
  }

  /** Explicit recovery action: one authoritative write replaces the entire vault. */
  clear(): Promise<void> {
    return this.serialize(async () => {
      const { options, storage } = await this.createStorage();
      const empty: RecoveryVault = { schemaVersion: RECOVERY_KEY_VAULT_SCHEMA_VERSION, records: [] };
      await storage.setItemAsync(RECOVERY_KEY_VAULT_STORAGE_KEY, JSON.stringify(empty), options);
    });
  }

  async whenIdle(): Promise<void> {
    while (true) {
      const tail = this.tail;
      await tail;
      if (tail === this.tail) return;
    }
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

export const recoveryKeyVaultCoordinator = new RecoveryKeyVaultCoordinator();

export function parseRecoveryVault(raw: string | null): RecoveryVault {
  if (raw === null) return { schemaVersion: RECOVERY_KEY_VAULT_SCHEMA_VERSION, records: [] };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new InvalidRecoveryKeyVaultError();
  }
  if (!isRecord(value)
    || Object.keys(value).length !== 2
    || value.schemaVersion !== RECOVERY_KEY_VAULT_SCHEMA_VERSION
    || !Array.isArray(value.records)
    || !value.records.every(isRecoveryVaultRecord)) {
    throw new InvalidRecoveryKeyVaultError();
  }
  const reportIds = value.records.map((record) => record.reportId);
  if (new Set(reportIds).size !== reportIds.length) throw new InvalidRecoveryKeyVaultError();
  return value as unknown as RecoveryVault;
}

async function createSecureStoreBinding(): Promise<RecoveryKeyVaultStorageBinding> {
  const secureStore = await import('expo-secure-store');
  return {
    storage: {
      getItemAsync: secureStore.getItemAsync,
      setItemAsync: secureStore.setItemAsync,
    },
    options: { keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  };
}

function isRecoveryVaultRecord(value: unknown): value is RecoveryVaultRecord {
  if (!isRecord(value) || Object.keys(value).length !== 3) return false;
  return ReportIdSchema.safeParse(value.reportId).success
    && ReportRecoveryKeySchema.safeParse(value.recoveryKey).success
    && typeof value.savedAt === 'string'
    && Number.isFinite(Date.parse(value.savedAt));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
