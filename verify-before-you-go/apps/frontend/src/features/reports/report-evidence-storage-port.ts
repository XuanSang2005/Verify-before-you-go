import type { ReportEvidenceDraft } from './report-model';

export interface LocalReportEvidenceStoragePort {
  persist: (evidence: ReportEvidenceDraft) => Promise<ReportEvidenceDraft>;
  remove: (evidenceId: string) => Promise<void>;
  listEvidenceIds: () => Promise<string[]>;
}
