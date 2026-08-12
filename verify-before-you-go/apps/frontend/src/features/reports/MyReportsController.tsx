import { Platform } from 'react-native';

import {
  InvalidReportRecoveryCredentialError,
  type ReportRecoveryViewRecord,
} from './report-status-recovery-coordinator';
import { MyReportsExperience, type MyReportsNotice } from './MyReportsScreen';
import { useReportStatusRecovery } from './use-report-status-recovery';

export function MyReportsScreen() {
  const recovery = useReportStatusRecovery();
  const visibleRecords = recovery.records.filter((record) => record.lookupState !== 'invalid-credential');
  const issueRecord = recovery.records.find((record) => record.lookupState !== 'ready' && record.lookupState !== 'loading');
  const notice = toNotice(recovery.storageMessage, issueRecord);

  const add = async (reportId: string, recoveryKey: string) => {
    try {
      return await recovery.add(reportId, recoveryKey);
    } catch (error) {
      if (error instanceof InvalidReportRecoveryCredentialError) return false;
      return false;
    }
  };

  const clear = async () => {
    return recovery.clear();
  };

  return (
    <MyReportsExperience
      addPending={recovery.addPending}
      clearPending={recovery.clearPending}
      isWeb={Platform.OS === 'web'}
      loading={recovery.phase === 'loading'}
      notice={notice}
      onAdd={add}
      onClear={clear}
      onRecoverCorruptVault={clear}
      onRefresh={recovery.refresh}
      onRetry={recovery.retry}
      records={visibleRecords}
      storageCorrupt={recovery.phase === 'corrupt-vault'}
    />
  );
}

function toNotice(
  storageMessage: string | undefined,
  issue: ReportRecoveryViewRecord | undefined,
): MyReportsNotice | undefined {
  if (storageMessage) return { kind: 'storage', message: storageMessage };
  if (!issue) return undefined;
  if (issue.lookupState === 'offline') return { kind: 'offline', message: issue.message ?? 'Connect to retry.' };
  if (issue.lookupState === 'invalid-credential') {
    return {
      kind: 'invalid',
      message: 'The report ID and recovery key could not be matched. Check both values and try again.',
    };
  }
  return { kind: 'unavailable', message: issue.message ?? 'Try again later.' };
}
