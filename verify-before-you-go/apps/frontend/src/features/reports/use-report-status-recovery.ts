import { useCallback, useEffect, useRef, useState } from 'react';

import {
  reportStatusRecoveryCoordinator,
  type ReportRecoverySnapshot,
  type ReportStatusRecoveryCoordinator,
} from './report-status-recovery-coordinator';

export interface ReportStatusRecoveryController extends ReportRecoverySnapshot {
  addPending: boolean;
  clearPending: boolean;
  add: (reportId: string, recoveryKey: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  refresh: (reportId: string) => Promise<void>;
  retry: () => Promise<void>;
}

export function useReportStatusRecovery(
  coordinator: ReportStatusRecoveryCoordinator = reportStatusRecoveryCoordinator,
): ReportStatusRecoveryController {
  const [snapshot, setSnapshot] = useState(() => coordinator.getSnapshot());
  const [addPending, setAddPending] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const mountedRef = useRef(false);
  const addPendingRef = useRef(false);
  const clearPendingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = coordinator.subscribe((next) => {
      if (mountedRef.current) setSnapshot(next);
    });
    void coordinator.hydrate().then((next) => {
      if (mountedRef.current) setSnapshot(next);
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
      coordinator.suspend();
    };
  }, [coordinator]);

  const add = useCallback(async (reportId: string, recoveryKey: string) => {
    if (addPendingRef.current || clearPendingRef.current) return false;
    addPendingRef.current = true;
    setAddPending(true);
    try {
      const next = await coordinator.addCredential(reportId, recoveryKey);
      return next.records.some((record) => record.reportId === reportId.trim() && record.lookupState === 'ready');
    } finally {
      addPendingRef.current = false;
      if (mountedRef.current) setAddPending(false);
    }
  }, [coordinator]);

  const clear = useCallback(async () => {
    if (clearPendingRef.current) return false;
    clearPendingRef.current = true;
    setClearPending(true);
    try {
      const next = await coordinator.clear();
      return next.phase === 'ready' && !next.storageMessage;
    } finally {
      clearPendingRef.current = false;
      if (mountedRef.current) setClearPending(false);
    }
  }, [coordinator]);

  const refresh = useCallback(async (reportId: string) => {
    if (!clearPendingRef.current) await coordinator.refresh(reportId);
  }, [coordinator]);

  const retry = useCallback(async () => {
    if (!clearPendingRef.current) await coordinator.retry();
  }, [coordinator]);

  return { ...snapshot, add, addPending, clear, clearPending, refresh, retry };
}
