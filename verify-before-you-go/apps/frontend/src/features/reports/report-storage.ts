import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseReportDraft,
  serializeReportDraft,
  type ReportDraft,
  type ReportDraftParseStatus,
} from './report-model';

export const REPORT_DRAFT_STORAGE_KEY = '@vbyg/report-draft/v1';

export interface ReportDraftStoragePort {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export interface ReportDraftReadResult {
  draft: ReportDraft;
  requiresCanonicalWrite: boolean;
  status: ReportDraftParseStatus;
}

const asyncStoragePort: ReportDraftStoragePort = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

export async function readReportDraft(
  storage: ReportDraftStoragePort = asyncStoragePort,
  fallbackTimestamp?: string,
): Promise<ReportDraftReadResult> {
  const raw = await storage.getItem(REPORT_DRAFT_STORAGE_KEY);
  const result = parseReportDraft(raw, fallbackTimestamp);
  const canonical = serializeReportDraft(result.draft);
  return {
    ...result,
    requiresCanonicalWrite: result.status === 'recovered' || (raw !== null && raw !== canonical),
  };
}

export async function saveReportDraft(
  draft: ReportDraft,
  storage: ReportDraftStoragePort = asyncStoragePort,
): Promise<void> {
  await storage.setItem(REPORT_DRAFT_STORAGE_KEY, serializeReportDraft(draft));
}
