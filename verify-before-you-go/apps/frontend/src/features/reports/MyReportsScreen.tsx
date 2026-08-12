import { Ionicons } from '@expo/vector-icons';
import {
  ReportIdSchema,
  ReportRecoveryKeySchema,
  type ReportRecoverableStatus,
} from '@vbyg/contracts';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import type { ReportRecoveryViewRecord } from './report-status-recovery-coordinator';

const recoveryMascot = require('../../../assets/mascots/recovery-peek-screen16.png');

const webPrimaryGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

export type MyReportsNoticeKind = 'invalid' | 'offline' | 'unavailable' | 'storage';

export interface MyReportsNotice {
  kind: MyReportsNoticeKind;
  message: string;
}

export interface MyReportsExperienceProps {
  addPending: boolean;
  clearPending: boolean;
  isWeb: boolean;
  loading: boolean;
  notice?: MyReportsNotice;
  onAdd: (reportId: string, recoveryKey: string) => Promise<boolean>;
  onClear: () => Promise<boolean>;
  onRecoverCorruptVault: () => Promise<boolean>;
  onRefresh: (reportId: string) => Promise<void>;
  onRetry: () => Promise<void>;
  records: readonly ReportRecoveryViewRecord[];
  storageCorrupt: boolean;
}

export function MyReportsExperience({
  addPending,
  clearPending,
  isWeb,
  loading,
  notice,
  onAdd,
  onClear,
  onRecoverCorruptVault,
  onRefresh,
  onRetry,
  records,
  storageCorrupt,
}: MyReportsExperienceProps) {
  const [reportId, setReportId] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [formError, setFormError] = useState<string>();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationMode, setConfirmationMode] = useState<'clear' | 'corrupt'>('clear');
  const hasRecords = records.length > 0;

  const restoreConfirmationFocus = (completed: boolean) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const targetId = completed
      ? 'my-reports-report-id-field'
      : confirmationMode === 'corrupt'
        ? 'my-reports-corrupt-trigger'
        : 'my-reports-clear-trigger';
    requestAnimationFrame(() => document.getElementById(targetId)?.focus());
  };

  const closeConfirmation = (completed = false) => {
    setConfirmationOpen(false);
    restoreConfirmationFocus(completed);
  };

  const submitAccess = async () => {
    const normalizedReportId = reportId.trim();
    const normalizedRecoveryKey = recoveryKey.trim();
    if (!ReportIdSchema.safeParse(normalizedReportId).success
      || !ReportRecoveryKeySchema.safeParse(normalizedRecoveryKey).success) {
      setFormError('Enter the report ID and recovery key exactly as shown on the private receipt.');
      return;
    }
    setFormError(undefined);
    const added = await onAdd(normalizedReportId, normalizedRecoveryKey);
    setRecoveryKey('');
    if (!added) return;
    setReportId('');
  };

  const confirmClear = async () => {
    const succeeded = confirmationMode === 'corrupt'
      ? await onRecoverCorruptVault()
      : await onClear();
    if (succeeded) closeConfirmation(true);
  };

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="my-reports-screen">
      <StatusBar style="dark" />

      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>Community · {isWeb ? 'This browser session' : 'Saved on this device'}</Text>
        <Text accessibilityRole="header" style={styles.title}>My reports.</Text>
        <Text style={styles.lede}>{isWeb
          ? 'Add a recovery key to check a report in this session. Refreshing the browser requires the key again.'
          : 'Only reports whose recovery keys are saved securely on this device appear here.'}</Text>
      </View>

      <View style={styles.verdictNote}>
        <Ionicons color={colors.blue} name="information-circle-outline" size={19} />
        <Text style={styles.verdictText}>Received or under review does not mean verified, published or a scam verdict.</Text>
      </View>

      {loading ? (
        <View accessibilityLiveRegion="polite" style={styles.statePanel} testID="my-reports-loading">
          <ActivityIndicator color={colors.blue} size="small" />
          <Text accessibilityRole="header" style={styles.stateTitle}>Loading saved report access…</Text>
          <Text style={styles.stateText}>Private recovery keys are not displayed.</Text>
        </View>
      ) : null}

      {storageCorrupt ? (
        <View accessibilityLiveRegion="assertive" style={[styles.statePanel, styles.errorPanel]} testID="my-reports-corrupt-vault">
          <Ionicons color="#9F2525" name="shield-outline" size={21} />
          <Text accessibilityRole="header" style={styles.stateTitle}>Secure report access needs recovery.</Text>
          <Text style={styles.stateText}>The saved vault is damaged. It was not overwritten. Reset it before adding keys again.</Text>
          <InteractiveSurface
            {...webButtonActivation(() => {
              setConfirmationMode('corrupt');
              setConfirmationOpen(true);
            })}
            accessibilityLabel="Reset damaged secure report access"
            accessibilityRole="button"
            focusStyle={styles.controlFocused}
            nativeID="my-reports-corrupt-trigger"
            onPress={() => {
              setConfirmationMode('corrupt');
              setConfirmationOpen(true);
            }}
            pressedStyle={styles.pressed}
            style={styles.secondaryButton}
            testID="my-reports-recover-corrupt"
          >
            <Text style={styles.secondaryButtonText}>Reset secure report access</Text>
          </InteractiveSurface>
        </View>
      ) : null}

      {!loading && !storageCorrupt && hasRecords ? (
        <View accessibilityLabel="Saved report statuses" accessibilityRole="list" style={styles.reportList}>
          {records.map((record) => (
            <ReportStatusCard
              key={record.reportId}
              onRefresh={() => void onRefresh(record.reportId)}
              record={record}
              refreshing={record.lookupState === 'loading'}
            />
          ))}
        </View>
      ) : null}

      {!loading && !storageCorrupt && !hasRecords ? <EmptyReportsPrototype showExamples={!notice} /> : null}

      {notice ? (
        <View
          accessibilityLiveRegion={notice.kind === 'invalid' ? 'assertive' : 'polite'}
          style={[styles.noticePanel, notice.kind === 'invalid' && styles.errorPanel]}
          testID={`my-reports-notice-${notice.kind}`}
        >
          <Ionicons
            color={notice.kind === 'invalid' ? '#9F2525' : '#7A5200'}
            name={notice.kind === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
            size={20}
          />
          <View style={styles.noticeCopy}>
            <Text accessibilityRole="header" style={styles.noticeTitle}>{noticeHeading(notice.kind)}</Text>
            <Text style={styles.noticeText}>{notice.message}</Text>
          </View>
          {notice.kind !== 'invalid' ? (
            <InteractiveSurface
              {...webButtonActivation(() => void onRetry())}
              accessibilityLabel="Retry loading report status"
              accessibilityRole="button"
              focusStyle={styles.controlFocused}
              onPress={() => void onRetry()}
              pressedStyle={styles.pressed}
              style={styles.retryButton}
              testID="my-reports-retry"
            >
              <Text style={styles.retryText}>Retry</Text>
            </InteractiveSurface>
          ) : null}
        </View>
      ) : null}

      {!storageCorrupt ? (
        <View accessibilityLabel="Add an existing recovery key" role="form" style={styles.addPanel}>
          <View style={styles.panelHeading}>
            <Text style={styles.panelTitle}>Add an existing recovery key</Text>
            <Text style={styles.panelText}>Use the report ID and private key from your receipt. They are sent only in this protected status request.</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text nativeID="report-id-label" style={styles.fieldLabel}>Report ID</Text>
            <TextInput
              accessibilityLabel="Report ID"
              aria-labelledby="report-id-label"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!addPending && !loading}
              onChangeText={(value) => {
                setReportId(value);
                setFormError(undefined);
              }}
              nativeID="my-reports-report-id-field"
              placeholder="R-XXXXXXXXXXXXXXXX"
              placeholderTextColor={colors.quiet}
              returnKeyType="next"
              style={styles.textInput}
              testID="my-reports-report-id"
              value={reportId}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text nativeID="recovery-key-label" style={styles.fieldLabel}>Recovery key</Text>
            <View style={styles.recoveryField}>
              <Image
                accessibilityIgnoresInvertColors
                accessible={false}
                resizeMode="contain"
                source={recoveryMascot}
                style={styles.recoveryMascot}
                testID="my-reports-recovery-mascot"
              />
              <TextInput
                accessibilityLabel="Private recovery key"
                aria-labelledby="recovery-key-label"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect={false}
                editable={!addPending && !loading}
                onChangeText={(value) => {
                  setRecoveryKey(value);
                  setFormError(undefined);
                }}
                onSubmitEditing={() => void submitAccess()}
                placeholder="XXXX-XXXX-…"
                placeholderTextColor={colors.quiet}
                returnKeyType="done"
                secureTextEntry
                style={styles.recoveryInput}
                testID="my-reports-recovery-key"
                value={recoveryKey}
              />
            </View>
          </View>

          {formError ? (
            <Text accessibilityLiveRegion="assertive" style={styles.formError} testID="my-reports-form-error">{formError}</Text>
          ) : null}

          <InteractiveSurface
            {...webButtonActivation(() => void submitAccess(), addPending || loading)}
            accessibilityLabel={addPending ? 'Checking recovery credential' : 'Add recovery key and check report status'}
            accessibilityRole="button"
            accessibilityState={{ busy: addPending, disabled: addPending || loading }}
            disabled={addPending || loading}
            disabledStyle={styles.disabled}
            focusStyle={styles.primaryFocused}
            hoverStyle={styles.primaryHovered}
            onPress={() => void submitAccess()}
            pressedStyle={styles.pressed}
            style={[styles.primaryButton, webPrimaryGradient]}
            testID="my-reports-add-key"
          >
            {addPending ? <ActivityIndicator color={colors.paper} size="small" /> : <Ionicons color={colors.paper} name="key-outline" size={19} />}
            <Text style={styles.primaryButtonText}>{addPending ? 'Checking privately…' : 'Add recovery key'}</Text>
          </InteractiveSurface>
        </View>
      ) : null}

      <View style={styles.clearWarning}>
        <View style={styles.warningCopy}>
          <Text style={styles.warningTitle}>{isWeb ? 'Before closing this browser' : 'Before clearing this phone'}</Text>
          <Text style={styles.warningText}>{isWeb
            ? 'Recovery keys stay only in memory for this open session. Closing or refreshing removes them from this browser.'
            : 'Clearing removes recovery keys from this device. It does not delete any report held by the service.'}</Text>
        </View>
        {hasRecords ? (
          <InteractiveSurface
            {...webButtonActivation(() => {
              setConfirmationMode('clear');
              setConfirmationOpen(true);
            })}
            accessibilityLabel="Clear local report recovery keys"
            accessibilityRole="button"
            focusStyle={styles.controlFocused}
            nativeID="my-reports-clear-trigger"
            onPress={() => {
              setConfirmationMode('clear');
              setConfirmationOpen(true);
            }}
            pressedStyle={styles.pressed}
            style={styles.clearButton}
            testID="my-reports-clear-keys"
          >
            <Ionicons color="#8B2E2E" name="trash-outline" size={18} />
            <Text style={styles.clearButtonText}>Clear local keys</Text>
          </InteractiveSurface>
        ) : null}
      </View>

      <ClearConfirmationDialog
        mode={confirmationMode}
        onCancel={() => closeConfirmation(false)}
        onConfirm={() => void confirmClear()}
        pending={clearPending}
        visible={confirmationOpen}
      />
    </PrototypeTabScreen>
  );
}

function ReportStatusCard({ onRefresh, record, refreshing }: {
  onRefresh: () => void;
  record: ReportRecoveryViewRecord;
  refreshing: boolean;
}) {
  const visual = record.status ? statusVisual(record.status) : pendingStatusVisual(record.lookupState);
  const guidance = record.nextStep ?? record.message ?? 'Checking the latest privacy-safe report status.';
  const metadata = record.submittedAt && record.updatedAt
    ? `Submitted ${formatReportDate(record.submittedAt)} · Updated ${formatReportDate(record.updatedAt)}`
    : `Added ${formatReportDate(record.savedAt)}`;
  return (
    <View
      accessibilityLabel={`Saved access for ${record.reportId}. ${visual.label}. ${guidance}`}
      accessibilityLiveRegion="polite"
      role="listitem"
      style={[styles.reportCard, { borderLeftColor: visual.accent }]}
      testID={`my-report-${record.reportId}`}
    >
      <View style={styles.reportTopRow}>
        <Text selectable style={styles.reportId}>{record.reportId}</Text>
        <View style={[styles.statusBadge, { backgroundColor: visual.background, borderColor: visual.border }]}>
          <Ionicons color={visual.foreground} name={visual.icon} size={14} />
          <Text style={[styles.statusBadgeText, { color: visual.foreground }]}>{visual.label}</Text>
        </View>
      </View>
      <Text style={styles.nextStep}>{guidance}</Text>
      <View style={styles.reportFooter}>
        <Text style={styles.reportMetadata}>{metadata}</Text>
        <InteractiveSurface
          {...webButtonActivation(onRefresh, refreshing)}
          accessibilityLabel={`Refresh status for report ${record.reportId}`}
          accessibilityRole="button"
          accessibilityState={{ busy: refreshing, disabled: refreshing }}
          disabled={refreshing}
          focusStyle={styles.controlFocused}
          onPress={onRefresh}
          pressedStyle={styles.pressed}
          style={styles.refreshButton}
          testID={`my-report-refresh-${record.reportId}`}
        >
          {refreshing ? <ActivityIndicator color={colors.blue} size="small" /> : <Ionicons color={colors.blue} name="refresh" size={17} />}
          <Text style={styles.refreshText}>{refreshing ? 'Refreshing' : 'Refresh status'}</Text>
        </InteractiveSurface>
      </View>
    </View>
  );
}

function EmptyReportsPrototype({ showExamples }: { showExamples: boolean }) {
  return (
    <View style={styles.emptySection} testID="my-reports-empty">
      <View style={styles.emptyCopy}>
        <Text accessibilityRole="header" style={styles.stateTitle}>No report access in this {Platform.OS === 'web' ? 'session' : 'device'}.</Text>
        <Text style={styles.stateText}>Add a valid receipt credential below. A report is never created or guessed from this screen.</Text>
      </View>
      {showExamples ? (
        <>
          <View style={styles.prototypeLabel}><Text style={styles.prototypeLabelText}>Synthetic prototype · Example statuses only</Text></View>
          <PrototypeStatusCard
            guidance="Privacy masks checked. Evidence review is next."
            label="Under review"
            metadata="Submitted today · Status preview"
            reportId="R-1042"
            title="Customer support · Sihanoukville"
            tone="blue"
          />
          <PrototypeStatusCard
            guidance="Add the original domain or a clearer contract page."
            label="More evidence needed"
            metadata="Updated 28 Jul · Evidence preview"
            reportId="R-0981"
            title="Warehouse packing offer"
            tone="amber"
          />
        </>
      ) : null}
    </View>
  );
}

function PrototypeStatusCard({ guidance, label, metadata, reportId, title, tone }: {
  guidance: string;
  label: string;
  metadata: string;
  reportId: string;
  title: string;
  tone: 'amber' | 'blue';
}) {
  const amber = tone === 'amber';
  return (
    <View style={[styles.prototypeCard, amber && styles.prototypeCardAmber]}>
      <View style={styles.reportTopRow}>
        <Text style={styles.reportId}>{reportId}</Text>
        <View style={[styles.statusBadge, amber ? styles.prototypeBadgeAmber : styles.prototypeBadgeBlue]}>
          <Text style={[styles.statusBadgeText, amber ? styles.prototypeBadgeAmberText : styles.prototypeBadgeBlueText]}>{label}</Text>
        </View>
      </View>
      <Text style={styles.prototypeTitle}>{title}</Text>
      <Text style={styles.nextStep}>{guidance}</Text>
      <Text style={styles.prototypeMetadata}>{metadata}</Text>
    </View>
  );
}

function ClearConfirmationDialog({ mode, onCancel, onConfirm, pending, visible }: {
  mode: 'clear' | 'corrupt';
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  visible: boolean;
}) {
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const frame = requestAnimationFrame(() => document.getElementById('my-reports-cancel-clear')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const webKeyboardProps = Platform.OS === 'web'
    ? ({
        onKeyDown: (event: { key: string; preventDefault: () => void; shiftKey?: boolean }) => {
          if (pending) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
            return;
          }
          if (event.key !== 'Tab' || typeof document === 'undefined') return;
          const cancel = document.getElementById('my-reports-cancel-clear');
          const confirm = document.querySelector<HTMLElement>('[data-testid="my-reports-clear-confirm"]');
          if (event.shiftKey && document.activeElement === cancel) {
            event.preventDefault();
            confirm?.focus();
          } else if (!event.shiftKey && document.activeElement === confirm) {
            event.preventDefault();
            cancel?.focus();
          }
        },
      } as unknown as Partial<ComponentProps<typeof View>>)
    : {};

  return (
    <Modal
      animationType="none"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.modalScrim}>
        <View
          {...webKeyboardProps}
          aria-modal
          accessibilityViewIsModal
          role="alertdialog"
          style={styles.dialog}
          testID="my-reports-clear-dialog"
        >
          <View style={styles.dialogIcon}><Ionicons color="#8B2E2E" name="warning-outline" size={23} /></View>
          <Text accessibilityRole="header" style={styles.dialogTitle}>{mode === 'corrupt' ? 'Reset secure report access?' : 'Clear local report keys?'}</Text>
          <Text style={styles.dialogText}>{mode === 'corrupt'
            ? 'This removes the damaged local vault so you can add valid keys again. It does not delete reports from the server.'
            : 'You will need each recovery key to reopen these anonymous reports. Clearing this device does not delete reports from the server.'}</Text>
          <View style={styles.dialogActions}>
            <InteractiveSurface
              {...webButtonActivation(onCancel, pending)}
              accessibilityLabel="Cancel clearing report keys"
              accessibilityRole="button"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              focusStyle={styles.controlFocused}
              nativeID="my-reports-cancel-clear"
              onPress={onCancel}
              pressedStyle={styles.pressed}
              style={styles.dialogCancel}
              testID="my-reports-clear-cancel"
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </InteractiveSurface>
            <InteractiveSurface
              {...webButtonActivation(onConfirm, pending)}
              accessibilityLabel={pending ? 'Clearing local report keys' : 'Confirm clear local report keys'}
              accessibilityRole="button"
              accessibilityState={{ busy: pending, disabled: pending }}
              disabled={pending}
              focusStyle={styles.destructiveFocused}
              onPress={onConfirm}
              pressedStyle={styles.pressed}
              style={styles.dialogConfirm}
              testID="my-reports-clear-confirm"
            >
              {pending ? <ActivityIndicator color={colors.paper} size="small" /> : null}
              <Text style={styles.dialogConfirmText}>{pending ? 'Clearing…' : 'Clear local keys'}</Text>
            </InteractiveSurface>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function noticeHeading(kind: MyReportsNoticeKind): string {
  if (kind === 'invalid') return 'Credential not recognised.';
  if (kind === 'offline') return 'You appear to be offline.';
  if (kind === 'storage') return 'Secure storage is unavailable.';
  return 'Report status is unavailable.';
}

function webButtonActivation(
  onActivate: () => void,
  disabled = false,
): Partial<ComponentProps<typeof InteractiveSurface>> {
  if (Platform.OS !== 'web' || disabled) return {};
  return ({
    onKeyDown: (event: { key: string; preventDefault: () => void }) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onActivate();
    },
  } as unknown as Partial<ComponentProps<typeof InteractiveSurface>>);
}

function statusVisual(status: ReportRecoverableStatus): {
  accent: string;
  background: string;
  border: string;
  foreground: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
} {
  if (status === 'more-evidence-needed') return {
    accent: colors.amber,
    background: colors.amberSoft,
    border: '#ECCB80',
    foreground: '#755000',
    icon: 'document-attach-outline',
    label: 'More evidence needed',
  };
  if (status === 'under-review') return {
    accent: colors.sky,
    background: '#EEF9EB',
    border: '#B8DDB0',
    foreground: '#1E632B',
    icon: 'time-outline',
    label: 'Under review',
  };
  return {
    accent: colors.brightBlue,
    background: colors.ice,
    border: colors.paleBlue,
    foreground: colors.blue,
    icon: 'checkmark-circle-outline',
    label: 'Received',
  };
}

function pendingStatusVisual(state: ReportRecoveryViewRecord['lookupState']): ReturnType<typeof statusVisual> {
  if (state === 'loading') return {
    accent: colors.sky,
    background: colors.ice,
    border: colors.paleBlue,
    foreground: colors.blue,
    icon: 'time-outline',
    label: 'Checking status',
  };
  return {
    accent: colors.amber,
    background: colors.amberSoft,
    border: '#ECCB80',
    foreground: '#755000',
    icon: state === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline',
    label: state === 'offline' ? 'Offline' : 'Status unavailable',
  };
}

function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

const styles = StyleSheet.create({
  screenContent: { gap: 12, paddingTop: 12, paddingBottom: 128 },
  headingBlock: { minWidth: 0, gap: 5 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, lineHeight: 34, letterSpacing: -0.45 },
  lede: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  verdictNote: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.sky, backgroundColor: colors.ice },
  verdictText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  statePanel: { minWidth: 0, alignItems: 'flex-start', gap: 8, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  stateTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  stateText: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  errorPanel: { borderColor: '#E4B8B8', backgroundColor: '#FFF7F7' },
  reportList: { minWidth: 0, gap: 8 },
  reportCard: { minWidth: 0, gap: 8, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderLeftWidth: 4, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  reportTopRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  reportId: { minWidth: 0, flexShrink: 1, color: colors.navy, fontFamily: typography.monoMedium, fontSize: 13, lineHeight: 20, letterSpacing: 0.35 },
  statusBadge: { minWidth: 0, minHeight: 26, flexShrink: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, borderWidth: 1, borderRadius: 5 },
  statusBadgeText: { minWidth: 0, flexShrink: 1, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0.4, textTransform: 'uppercase' },
  nextStep: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  reportFooter: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reportMetadata: { minWidth: 0, flex: 1, color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.35, textTransform: 'uppercase' },
  refreshButton: { minHeight: 48, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 9 },
  refreshText: { color: colors.blue, fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 18 },
  emptySection: { minWidth: 0, gap: 8 },
  emptyCopy: { gap: 4, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  prototypeLabel: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 7, borderRadius: 5, backgroundColor: colors.navy },
  prototypeLabelText: { color: colors.paper, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.55, textTransform: 'uppercase' },
  prototypeCard: { minWidth: 0, gap: 7, padding: 12, borderWidth: 1, borderLeftWidth: 4, borderColor: colors.line, borderLeftColor: colors.sky, borderRadius: 12, backgroundColor: colors.paper, opacity: 0.82 },
  prototypeCardAmber: { borderLeftColor: colors.amber },
  prototypeTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  prototypeMetadata: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.35, textTransform: 'uppercase' },
  prototypeBadgeBlue: { borderColor: '#B8DDB0', backgroundColor: '#EEF9EB' },
  prototypeBadgeBlueText: { color: '#1E632B' },
  prototypeBadgeAmber: { borderColor: '#ECCB80', backgroundColor: colors.amberSoft },
  prototypeBadgeAmberText: { color: '#755000' },
  noticePanel: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 12, backgroundColor: colors.amberSoft },
  noticeCopy: { minWidth: 0, flex: 1, gap: 3 },
  noticeTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  noticeText: { color: colors.body, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  retryButton: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 9 },
  retryText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 12, lineHeight: 18 },
  addPanel: { minWidth: 0, gap: 11, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  panelHeading: { minWidth: 0, gap: 4 },
  panelTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  panelText: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  fieldGroup: { minWidth: 0, gap: 5 },
  fieldLabel: { color: colors.body, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  textInput: { minWidth: 0, width: '100%', minHeight: 52, paddingVertical: 12, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.paper, color: colors.ink, fontFamily: typography.mono, fontSize: 13, lineHeight: 20 },
  recoveryField: { position: 'relative', minWidth: 0, minHeight: 74, justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.paper },
  recoveryMascot: { position: 'absolute', zIndex: 2, left: 5, bottom: -1, width: 98, height: 73 },
  recoveryInput: { minWidth: 0, width: '100%', minHeight: 72, paddingVertical: 12, paddingRight: 13, paddingLeft: 108, color: colors.ink, fontFamily: typography.mono, fontSize: 13, lineHeight: 20 },
  formError: { color: '#9F2525', fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 18 },
  primaryButton: { minWidth: 0, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryButtonText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  primaryHovered: { opacity: 0.94 },
  primaryFocused: { borderWidth: 3, borderColor: colors.navy },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  secondaryButtonText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  clearWarning: { minWidth: 0, gap: 9, padding: 13, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 12, backgroundColor: colors.amberSoft },
  warningCopy: { minWidth: 0, gap: 4 },
  warningTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  warningText: { color: colors.body, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  clearButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 12, borderRadius: 9 },
  clearButtonText: { color: '#8B2E2E', fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  modalScrim: { minWidth: 0, flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,34,74,0.58)' },
  dialog: { minWidth: 0, width: '100%', maxWidth: 420, gap: 10, padding: 20, borderRadius: 18, backgroundColor: colors.paper },
  dialogIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.amberSoft },
  dialogTitle: { color: colors.navy, fontFamily: typography.heading, fontSize: 22, lineHeight: 28 },
  dialogText: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  dialogActions: { minWidth: 0, flexDirection: 'row', gap: 8, paddingTop: 4 },
  dialogCancel: { minWidth: 0, minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  dialogCancelText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  dialogConfirm: { minWidth: 0, minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#8B2E2E' },
  dialogConfirmText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  destructiveFocused: { borderWidth: 3, borderColor: colors.amber },
  controlFocused: { borderWidth: 2, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
