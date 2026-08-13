import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

import type { ReportSubmissionResponse } from '@vbyg/contracts';

import { createReportSubmissionRequest } from '@/api/reports';
import { useReward } from '@/features/rewards/RewardContext';

import type { ReportDraft } from './report-model';
import { InvalidReportSubmissionAttemptError } from './report-submission-attempt-storage';
import {
  reportSubmissionCoordinator,
  type ReportSubmissionCoordinator,
} from './report-submission-coordinator';

interface ReportSubmissionContextValue {
  receipt?: ReportSubmissionResponse;
  retentionNotice?: string;
  submissionError?: string;
  submissionPending: boolean;
  submissionRecoveryRequired: boolean;
  submitDraft: (draft: ReportDraft) => Promise<boolean>;
  clearForNewReport: () => Promise<void>;
}

const ReportSubmissionContext = createContext<ReportSubmissionContextValue | null>(null);

export function ReportSubmissionProvider({
  children,
  coordinator = reportSubmissionCoordinator,
}: {
  children: ReactNode;
  coordinator?: ReportSubmissionCoordinator;
}) {
  const { clearEligibility, unlock } = useReward();
  const [receipt, setReceipt] = useState<ReportSubmissionResponse>();
  const [retentionNotice, setRetentionNotice] = useState<string>();
  const [submissionError, setSubmissionError] = useState<string>();
  const [submissionPending, setSubmissionPending] = useState(false);
  const [submissionRecoveryRequired, setSubmissionRecoveryRequired] = useState(false);
  const inFlightRef = useRef(false);

  const submitDraft = useCallback(async (draft: ReportDraft) => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    clearEligibility('private-report-submitted');
    setSubmissionPending(true);
    setSubmissionError(undefined);
    setSubmissionRecoveryRequired(false);
    try {
      const result = await coordinator.submit(createReportSubmissionRequest(draft));
      setReceipt(result.response);
      setRetentionNotice(result.retention.message);
      unlock('private-report-submitted');
      return true;
    } catch (error) {
      setReceipt(undefined);
      setRetentionNotice(undefined);
      const corruptAttempt = error instanceof InvalidReportSubmissionAttemptError;
      setSubmissionRecoveryRequired(corruptAttempt);
      setSubmissionError(corruptAttempt
        ? 'The saved submission safety state is damaged. It was not cleared because an earlier request may already have reached the server.'
        : error instanceof Error
          ? error.message
          : 'The private report could not be submitted. Your local draft is still available.');
      return false;
    } finally {
      inFlightRef.current = false;
      setSubmissionPending(false);
    }
  }, [clearEligibility, coordinator, unlock]);

  const clearForNewReport = useCallback(async () => {
    await coordinator.clearAttempt();
    setReceipt(undefined);
    setRetentionNotice(undefined);
    setSubmissionError(undefined);
    setSubmissionRecoveryRequired(false);
    clearEligibility('private-report-submitted');
  }, [clearEligibility, coordinator]);

  return (
    <ReportSubmissionContext.Provider value={{
      clearForNewReport,
      receipt,
      retentionNotice,
      submissionError,
      submissionPending,
      submissionRecoveryRequired,
      submitDraft,
    }}>
      {children}
    </ReportSubmissionContext.Provider>
  );
}

export function useReportSubmission() {
  const context = useContext(ReportSubmissionContext);
  if (!context) throw new Error('useReportSubmission must be used within ReportSubmissionProvider');
  return context;
}
