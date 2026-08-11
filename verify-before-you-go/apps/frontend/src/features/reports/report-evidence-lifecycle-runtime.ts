import { localReportEvidenceStorage } from './local-report-evidence-storage';
import { ReportEvidenceLifecycleCoordinator } from './report-evidence-lifecycle';
import { LocalReportEvidenceLifecycleJournal } from './report-evidence-lifecycle-storage';
import { reportDraftPersistenceCoordinator } from './report-persistence-coordinator';

export const reportEvidenceLifecycleCoordinator = new ReportEvidenceLifecycleCoordinator(
  reportDraftPersistenceCoordinator,
  localReportEvidenceStorage,
  new LocalReportEvidenceLifecycleJournal(),
);
