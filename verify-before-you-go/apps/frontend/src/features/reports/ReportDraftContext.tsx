import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  createEmptyReportDraft,
  type ReportDraft,
  type ReportEvidenceDraft,
} from './report-model';
import {
  reportDraftPersistenceCoordinator,
  type ReportDraftPersistencePort,
} from './report-persistence-coordinator';
import {
  type ReportEvidenceLifecyclePort,
} from './report-evidence-lifecycle';
import { reportEvidenceLifecycleCoordinator } from './report-evidence-lifecycle-runtime';

type ReportStorageIssue = {
  kind: 'read' | 'write';
  message: string;
};

interface ReportDraftContextValue {
  draft: ReportDraft;
  loading: boolean;
  recoveryNotice?: string;
  retryPending: boolean;
  storageIssue?: ReportStorageIssue;
  updateDraft: (updater: (current: ReportDraft) => ReportDraft) => void;
  addEvidence: (evidence: ReportEvidenceDraft) => Promise<void>;
  removeEvidence: (evidenceId: string) => Promise<void>;
  resetDraft: () => void;
  clearForNewReport: () => Promise<void>;
  retryStorage: () => Promise<void>;
  saveNow: () => Promise<boolean>;
}

const ReportDraftContext = createContext<ReportDraftContextValue | null>(null);

export function ReportDraftProvider({
  children,
  evidenceLifecycle = reportEvidenceLifecycleCoordinator,
  persistence = reportDraftPersistenceCoordinator,
}: {
  children: ReactNode;
  evidenceLifecycle?: ReportEvidenceLifecyclePort;
  persistence?: ReportDraftPersistencePort;
}) {
  const [draft, setDraft] = useState<ReportDraft>(() => createEmptyReportDraft());
  const [loading, setLoading] = useState(true);
  const [recoveryNotice, setRecoveryNotice] = useState<string>();
  const [retryPending, setRetryPending] = useState(false);
  const [storageIssue, setStorageIssue] = useState<ReportStorageIssue>();
  const draftRef = useRef(draft);
  const mountedRef = useRef(false);
  const storageReadSucceededRef = useRef(false);
  const retryInFlightRef = useRef(false);
  const hydrateAttemptRef = useRef(0);
  const evidenceMutationPendingRef = useRef(false);
  const deferredDraftUpdatersRef = useRef<((current: ReportDraft) => ReportDraft)[]>([]);

  const commitDraft = useCallback((next: ReportDraft) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      hydrateAttemptRef.current += 1;
      retryInFlightRef.current = false;
    };
  }, []);

  useEffect(() => persistence.subscribe((result) => {
    if (!mountedRef.current || !result.isLatest) return;
    if (result.status === 'saved') {
      setStorageIssue((current) => current?.kind === 'write' ? undefined : current);
      return;
    }
    setStorageIssue({
      kind: 'write',
      message: 'This draft remains in the current session but could not be saved on this device.',
    });
  }), [persistence]);

  const hydrate = useCallback(async () => {
    const attempt = ++hydrateAttemptRef.current;
    const isActive = () => mountedRef.current && hydrateAttemptRef.current === attempt;
    await evidenceLifecycle.whenIdle();
    if (!isActive()) return;
    const loaded = await persistence.hydrate(isActive);
    if (!isActive()) return;
    const evidenceResult = await evidenceLifecycle.reconcile(loaded.draft);
    if (!isActive()) return;
    storageReadSucceededRef.current = true;
    commitDraft(evidenceResult.draft);
    setRecoveryNotice([
      loaded.status === 'recovered'
        ? 'Invalid saved report data was ignored. A fresh private draft was started.'
        : undefined,
      evidenceResult.recoveryNotice,
    ].filter(Boolean).join(' ') || undefined);
    if (evidenceResult.storageWarning) {
      setStorageIssue({ kind: 'write', message: evidenceResult.storageWarning });
      return;
    }
    setStorageIssue((current) => current?.kind === 'read' ? undefined : current);
  }, [commitDraft, evidenceLifecycle, persistence]);

  useEffect(() => {
    void hydrate()
      .catch(() => {
        if (!mountedRef.current) return;
        storageReadSucceededRef.current = false;
        setStorageIssue({
          kind: 'read',
          message: 'Your private draft could not be read. Retry before editing so saved data is not overwritten.',
        });
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [hydrate]);

  const updateDraft = useCallback((updater: (current: ReportDraft) => ReportDraft) => {
    if (!storageReadSucceededRef.current) return;
    const next = updater(draftRef.current);
    commitDraft(next);
    if (evidenceMutationPendingRef.current) {
      deferredDraftUpdatersRef.current.push(updater);
      return;
    }
    void persistence.enqueue(next);
  }, [commitDraft, persistence]);

  const resetDraft = useCallback(() => {
    updateDraft(() => createEmptyReportDraft());
    setRecoveryNotice(undefined);
  }, [updateDraft]);

  const clearForNewReport = useCallback(async () => {
    await evidenceLifecycle.whenIdle();
    const emptyDraft = createEmptyReportDraft();
    const write = await persistence.enqueue(emptyDraft);
    if (write.status === 'failed') throw write.error;
    const evidenceResult = await evidenceLifecycle.reconcile(emptyDraft);
    storageReadSucceededRef.current = true;
    commitDraft(evidenceResult.draft);
    setRecoveryNotice(evidenceResult.recoveryNotice);
    setStorageIssue(evidenceResult.storageWarning
      ? { kind: 'write', message: evidenceResult.storageWarning }
      : undefined);
  }, [commitDraft, evidenceLifecycle, persistence]);

  const addEvidence = useCallback(async (evidence: ReportEvidenceDraft) => {
    if (!storageReadSucceededRef.current) throw new Error('Private draft storage must be available before adding evidence.');
    if (evidenceMutationPendingRef.current) throw new Error('Another private evidence change is still in progress.');
    evidenceMutationPendingRef.current = true;
    deferredDraftUpdatersRef.current = [];
    const baseDraft = draftRef.current;
    try {
      const result = await evidenceLifecycle.add(baseDraft, evidence);
      if (!mountedRef.current) return;
      const deferred = deferredDraftUpdatersRef.current;
      const merged = deferred.reduce((current, updater) => updater(current), result.draft);
      commitDraft(merged);
      if (deferred.length) void persistence.enqueue(merged);
      if (result.storageWarning) setStorageIssue({ kind: 'write', message: result.storageWarning });
    } catch (error) {
      if (mountedRef.current && deferredDraftUpdatersRef.current.length) void persistence.enqueue(draftRef.current);
      throw error;
    } finally {
      deferredDraftUpdatersRef.current = [];
      evidenceMutationPendingRef.current = false;
    }
  }, [commitDraft, evidenceLifecycle, persistence]);

  const removeEvidence = useCallback(async (evidenceId: string) => {
    if (!storageReadSucceededRef.current) throw new Error('Private draft storage must be available before removing evidence.');
    if (evidenceMutationPendingRef.current) throw new Error('Another private evidence change is still in progress.');
    evidenceMutationPendingRef.current = true;
    deferredDraftUpdatersRef.current = [];
    const baseDraft = draftRef.current;
    try {
      const result = await evidenceLifecycle.remove(baseDraft, evidenceId);
      if (!mountedRef.current) return;
      const deferred = deferredDraftUpdatersRef.current;
      const merged = deferred.reduce((current, updater) => updater(current), result.draft);
      commitDraft(merged);
      if (deferred.length) void persistence.enqueue(merged);
      if (result.storageWarning) setStorageIssue({ kind: 'write', message: result.storageWarning });
    } catch (error) {
      if (mountedRef.current && deferredDraftUpdatersRef.current.length) void persistence.enqueue(draftRef.current);
      throw error;
    } finally {
      deferredDraftUpdatersRef.current = [];
      evidenceMutationPendingRef.current = false;
    }
  }, [commitDraft, evidenceLifecycle, persistence]);

  const retryStorage = useCallback(async () => {
    if (!mountedRef.current || retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    setRetryPending(true);
    try {
      if (!storageReadSucceededRef.current || storageIssue?.kind === 'read') {
        await hydrate();
      } else {
        const result = await persistence.enqueue(draftRef.current);
        if (result.status === 'failed') throw result.error;
        const evidenceResult = await evidenceLifecycle.reconcile(draftRef.current);
        if (mountedRef.current) commitDraft(evidenceResult.draft);
        if (evidenceResult.storageWarning) throw new Error(evidenceResult.storageWarning);
      }
    } catch {
      if (!mountedRef.current) return;
      if (!storageReadSucceededRef.current || storageIssue?.kind === 'read') {
        setStorageIssue({
          kind: 'read',
          message: 'Private draft storage is still unavailable. Existing saved data has not been replaced.',
        });
      } else {
        setStorageIssue({
          kind: 'write',
          message: 'The latest draft still could not be saved. It remains available in this session.',
        });
      }
    } finally {
      if (mountedRef.current) setRetryPending(false);
      retryInFlightRef.current = false;
    }
  }, [commitDraft, evidenceLifecycle, hydrate, persistence, storageIssue]);

  const saveNow = useCallback(async () => {
    if (!storageReadSucceededRef.current) return false;
    const result = await persistence.enqueue(draftRef.current);
    return result.status === 'saved';
  }, [persistence]);

  return (
    <ReportDraftContext.Provider value={{
      addEvidence,
      clearForNewReport,
      draft,
      loading,
      recoveryNotice,
      removeEvidence,
      resetDraft,
      retryPending,
      retryStorage,
      saveNow,
      storageIssue,
      updateDraft,
    }}>
      {children}
    </ReportDraftContext.Provider>
  );
}

export function useReportDraft() {
  const context = useContext(ReportDraftContext);
  if (!context) throw new Error('useReportDraft must be used within ReportDraftProvider');
  return context;
}
