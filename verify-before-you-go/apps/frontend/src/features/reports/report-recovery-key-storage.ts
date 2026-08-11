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

interface RecoveryVaultRecord {
  reportId: string;
  recoveryKey: string;
  savedAt: string;
}

interface RecoveryVault {
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

  const resolvedStorage = storage ?? await createSecureStorePort();
  const currentVault = parseRecoveryVault(await resolvedStorage.getItemAsync(RECOVERY_KEY_VAULT_STORAGE_KEY));
  const nextRecord: RecoveryVaultRecord = {
    reportId: response.report.reportId,
    recoveryKey: response.recoveryKey,
    savedAt: now().toISOString(),
  };
  const nextVault: RecoveryVault = {
    schemaVersion: RECOVERY_KEY_VAULT_SCHEMA_VERSION,
    records: [
      ...currentVault.records.filter((record) => record.reportId !== nextRecord.reportId),
      nextRecord,
    ],
  };
  const secureStore = storage ? undefined : await import('expo-secure-store');
  const options = secureStore
    ? { keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    : undefined;
  await resolvedStorage.setItemAsync(RECOVERY_KEY_VAULT_STORAGE_KEY, JSON.stringify(nextVault), options);
  return {
    status: 'saved-securely',
    message: 'The recovery key was saved in secure device storage.',
  };
}

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

async function createSecureStorePort(): Promise<SecureRecoveryStoragePort> {
  const secureStore = await import('expo-secure-store');
  return {
    getItemAsync: secureStore.getItemAsync,
    setItemAsync: secureStore.setItemAsync,
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
