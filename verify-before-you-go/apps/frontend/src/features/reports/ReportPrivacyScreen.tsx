import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Image,
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

import { useReportDraft } from './ReportDraftContext';
import { useReportSubmission } from './ReportSubmissionContext';
import {
  hasReportDraftErrors,
  updateReportDraft,
  validateReportDraftForPrivacy,
  type ReportDraft,
  type ReportSharingPermissions,
} from './report-model';
import {
  containsDirectIdentifier,
  createReportRedactionPreview,
} from './report-redaction';

const privacyMascot = require('../../../assets/mascots/privacy-reader-screen10.png');

const webGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

export function ReportPrivacyScreen() {
  const report = useReportDraft();
  const submission = useReportSubmission();
  const [savePending, setSavePending] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string>();
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string>();

  const update = (updater: (current: ReportDraft) => ReportDraft) => {
    report.updateDraft(updater);
    setSaveNotice(undefined);
  };

  const savePrivateDraft = async () => {
    setSavePending(true);
    const saved = await report.saveNow();
    setSavePending(false);
    setSaveNotice(saved
      ? 'Private draft saved on this device. Nothing was submitted or published.'
      : 'The draft remains in this session but could not be saved on this device.');
  };

  const submitPrivateReport = async () => {
    const submitted = await submission.submitDraft(report.draft);
    if (submitted) router.replace('/reports/receipt');
  };

  const recoverCorruptSubmission = async () => {
    if (recoveryPending) return;
    setRecoveryPending(true);
    setRecoveryError(undefined);
    try {
      await report.clearForNewReport();
      await submission.clearForNewReport();
      router.replace('/reports/new');
    } catch {
      setRecoveryError('The damaged submission state could not be reset. No new report was started; retry this recovery action.');
    } finally {
      setRecoveryPending(false);
    }
  };

  return (
    <ReportPrivacyExperience
      draft={report.draft}
      loading={report.loading}
      onBackToEdit={() => router.replace('/reports/new')}
      onPermissionChange={(permission, value) => update((current) => updateReportDraft(current, {
        permissions: { ...current.permissions, [permission]: value },
      }))}
      onPublicPreviewChange={(redactedPreview) => update((current) => updateReportDraft(current, { redactedPreview }))}
      onRestoreSuggested={() => update((current) => updateReportDraft(current, { redactedPreview: undefined }))}
      onRecoverCorruptReport={() => void recoverCorruptSubmission()}
      onSave={() => void savePrivateDraft()}
      onSubmit={() => void submitPrivateReport()}
      onPartnerNameChange={(namedPartner) => update((current) => updateReportDraft(current, {
        permissions: { ...current.permissions, namedPartner },
      }))}
      saveNotice={saveNotice}
      savePending={savePending}
      recoveryError={recoveryError}
      recoveryPending={recoveryPending}
      storageIssue={report.storageIssue?.message}
      submissionError={submission.submissionError}
      submissionPending={submission.submissionPending}
      submissionRecoveryRequired={submission.submissionRecoveryRequired}
    />
  );
}

export function ReportPrivacyExperience({
  draft,
  loading,
  onBackToEdit,
  onPartnerNameChange,
  onPermissionChange,
  onPublicPreviewChange,
  onRestoreSuggested,
  onRecoverCorruptReport,
  onSave,
  onSubmit,
  saveNotice,
  savePending,
  recoveryError,
  recoveryPending,
  storageIssue,
  submissionError,
  submissionPending,
  submissionRecoveryRequired,
}: {
  draft: ReportDraft;
  loading: boolean;
  onBackToEdit: () => void;
  onPartnerNameChange: (value: string) => void;
  onPermissionChange: (permission: keyof Omit<ReportSharingPermissions, 'namedPartner'>, value: boolean) => void;
  onPublicPreviewChange: (value: string) => void;
  onRestoreSuggested: () => void;
  onRecoverCorruptReport: () => void;
  onSave: () => void;
  onSubmit: () => void;
  saveNotice?: string;
  savePending: boolean;
  recoveryError?: string;
  recoveryPending: boolean;
  storageIssue?: string;
  submissionError?: string;
  submissionPending: boolean;
  submissionRecoveryRequired: boolean;
}) {
  const [confirmRecovery, setConfirmRecovery] = useState(false);
  const preview = useMemo(() => createReportRedactionPreview(draft), [draft]);
  const publicVersion = draft.redactedPreview ?? preview.possiblePublicVersion;
  const errors = validateReportDraftForPrivacy(draft);
  const incomplete = hasReportDraftErrors({
    identifier: errors.identifier,
    behaviours: errors.behaviours,
    evidence: errors.evidence,
  });
  const directIdentifierWarning = containsDirectIdentifier(publicVersion);
  const disabled = loading || savePending || submissionPending || recoveryPending || Boolean(storageIssue?.includes('could not be read'));

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="report-privacy-screen">
      <StatusBar style="dark" />
      <View style={styles.backRow}>
        <InteractiveSurface
          accessibilityLabel="Back to edit report"
          accessibilityRole="link"
          focusStyle={styles.controlFocused}
          hoverStyle={styles.backHovered}
          onPress={onBackToEdit}
          pressedStyle={styles.pressed}
          style={styles.backButton}
          testID="report-privacy-back"
        >
          <Ionicons color={colors.blue} name="chevron-back" size={20} />
          <Text style={styles.backText}>Back to edit</Text>
        </InteractiveSurface>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>Step 2 of 2</Text></View>
      </View>

      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>Report · Privacy review</Text>
        <Text accessibilityRole="header" style={styles.title}>Check what leaves your phone.</Text>
        <Text style={styles.lede}>Nothing is published automatically. A person must review every alert.</Text>
      </View>

      {loading ? (
        <View accessibilityLiveRegion="polite" style={styles.loadingPanel}>
          <ActivityIndicator color={colors.blue} size="small" />
          <Text style={styles.loadingText}>Loading private draft…</Text>
        </View>
      ) : null}

      {incomplete && !loading ? (
        <View style={styles.incompletePanel} testID="report-privacy-incomplete">
          <Ionicons color="#7A5200" name="alert-circle-outline" size={22} />
          <View style={styles.incompleteCopy}>
            <Text accessibilityRole="header" style={styles.incompleteTitle}>Finish the report details first.</Text>
            <Text style={styles.incompleteText}>Add one identifier or source and select at least one observed behaviour before reviewing privacy.</Text>
            <InteractiveSurface
              accessibilityLabel="Return to report details"
              accessibilityRole="link"
              focusStyle={styles.controlFocused}
              onPress={onBackToEdit}
              pressedStyle={styles.pressed}
              style={styles.inlineButton}
              testID="report-privacy-return-to-edit"
            >
              <Text style={styles.inlineButtonText}>Return to report details</Text>
            </InteractiveSurface>
          </View>
        </View>
      ) : null}

      {!incomplete && !loading ? (
        <>
          <View style={styles.previewCard}>
            <Text style={styles.cardTitle}>Redaction preview</Text>
            <Image accessible={false} resizeMode="contain" source={privacyMascot} style={styles.privacyMascot} />
            <View style={styles.previewStack}>
              <View style={styles.previewBlock}>
                <Text style={styles.previewLabel}>Private evidence</Text>
                <Text selectable style={styles.privateValue}>{preview.privateEvidence}</Text>
              </View>
              <View style={styles.previewBlock}>
                <Text style={styles.previewLabel}>Possible public version</Text>
                <TextInput
                  accessibilityLabel="Editable possible public version"
                  multiline
                  onChangeText={onPublicPreviewChange}
                  style={[styles.publicPreviewInput, directIdentifierWarning && styles.previewInputWarning]}
                  testID="report-public-preview-input"
                  value={publicVersion}
                />
              </View>
            </View>
            <View style={styles.previewFooter}>
              <View style={styles.hiddenBadge}>
                <Text style={styles.hiddenBadgeText}>{preview.hiddenSummary}</Text>
              </View>
              {draft.redactedPreview !== undefined ? (
                <InteractiveSurface
                  accessibilityLabel="Restore suggested redaction"
                  accessibilityRole="button"
                  focusStyle={styles.controlFocused}
                  hoverStyle={styles.restoreHovered}
                  onPress={onRestoreSuggested}
                  pressedStyle={styles.pressed}
                  style={styles.restoreButton}
                  testID="report-restore-redaction"
                >
                  <Text style={styles.restoreText}>Restore suggestion</Text>
                </InteractiveSurface>
              ) : null}
            </View>
            {directIdentifierWarning ? (
              <Text accessibilityLiveRegion="polite" style={styles.previewWarning}>This edited preview may still contain a direct identifier. The server must redact it again before any submission or publication.</Text>
            ) : (
              <Text style={styles.previewNote}>Client preview only · server-side redaction must run again before submission.</Text>
            )}
          </View>

          <View style={styles.permissionsCard}>
            <Text style={styles.cardTitle}>Privacy controls</Text>
            <PermissionRow
              checked={draft.permissions.useForPrivateMatching}
              description="Private review team · match related reports · protected identifier only."
              label="Use full identifier for private matching"
              onPress={() => onPermissionChange('useForPrivateMatching', !draft.permissions.useForPrivateMatching)}
              testID="report-permission-private-matching"
            />
            <View style={styles.rule} />
            <PermissionRow
              checked={draft.permissions.allowRedactedPublicAlert}
              description="Public audience · sanitized pattern only · human review required first."
              label="Allow a redacted alert after review"
              onPress={() => onPermissionChange('allowRedactedPublicAlert', !draft.permissions.allowRedactedPublicAlert)}
              testID="report-permission-public-alert"
            />
            <View style={styles.rule} />
            <PermissionRow
              checked={draft.permissions.shareWithNamedPartner}
              description="Only the partner you name · support purpose · no automatic sharing."
              label="Share with a named support partner"
              onPress={() => onPermissionChange('shareWithNamedPartner', !draft.permissions.shareWithNamedPartner)}
              testID="report-permission-partner"
            />
            {draft.permissions.shareWithNamedPartner ? (
              <View style={styles.partnerField}>
                <Text style={styles.previewLabel}>Named support partner</Text>
                <TextInput
                  accessibilityLabel="Named support partner"
                  onChangeText={onPartnerNameChange}
                  placeholder="Enter the organisation name"
                  placeholderTextColor={colors.quiet}
                  style={[styles.partnerInput, errors.namedPartner && styles.previewInputWarning]}
                  testID="report-partner-name"
                  value={draft.permissions.namedPartner}
                />
                {errors.namedPartner ? <Text style={styles.errorText}>{errors.namedPartner}</Text> : null}
              </View>
            ) : null}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Review what stays in the draft</Text>
            <SummaryRow label="Observed behaviours" value={`${draft.behaviourIds.length} selected`} />
            <SummaryRow label="Evidence images" value={`${draft.evidence.length} kept locally`} />
            <SummaryRow label="Reporter identity" value="Not requested" />
            <SummaryRow label="Submission status" value="Waiting to submit" />
          </View>

          <View style={styles.warningPanel}>
            <Ionicons color="#7A5200" name="warning-outline" size={20} />
            <Text style={styles.warningText}>Do not include your passport, home address or unrelated conversations. Protected originals and redacted versions must remain separate.</Text>
          </View>

          {storageIssue ? (
            <View accessibilityLiveRegion="assertive" style={styles.storageError}>
              <Text style={styles.storageErrorText}>{storageIssue}</Text>
            </View>
          ) : null}

          {saveNotice ? (
            <View accessibilityLiveRegion="polite" style={styles.saveNotice} testID="report-save-notice">
              <Ionicons color="#1E632B" name="checkmark-circle-outline" size={20} />
              <Text style={styles.saveNoticeText}>{saveNotice}</Text>
            </View>
          ) : null}

          {submissionError ? (
            <View accessibilityLiveRegion="assertive" style={styles.submissionError} testID="report-submission-error">
              <Ionicons color="#9F2525" name="cloud-offline-outline" size={21} />
              <View style={styles.submissionErrorCopy}>
                <Text accessibilityRole="header" style={styles.submissionErrorTitle}>Report not submitted</Text>
                <Text style={styles.submissionErrorText}>{submissionError}</Text>
                <Text style={styles.submissionErrorText}>{submissionRecoveryRequired
                  ? 'Do not retry or silently clear this state. The earlier request may already have reached the server.'
                  : 'Retry uses the same private submission key, so an interrupted request cannot silently create a duplicate.'}</Text>
              </View>
            </View>
          ) : null}

          {submissionRecoveryRequired ? (
            <View accessibilityLiveRegion="assertive" style={styles.recoveryPanel} testID="report-corrupt-submission-recovery">
              <Text accessibilityRole="header" style={styles.recoveryTitle}>Submission recovery required</Text>
              {!confirmRecovery ? (
                <>
                  <Text style={styles.recoveryText}>The saved retry key cannot be trusted. Review the warning before clearing this draft and its local evidence.</Text>
                  <InteractiveSurface
                    accessibilityLabel="Review submission recovery options"
                    accessibilityRole="button"
                    focusStyle={styles.controlFocused}
                    onPress={() => setConfirmRecovery(true)}
                    pressedStyle={styles.pressed}
                    style={styles.recoveryButton}
                    testID="report-review-corrupt-recovery"
                  >
                    <Text style={styles.recoveryButtonText}>Review recovery options</Text>
                  </InteractiveSurface>
                </>
              ) : (
                <>
                  <Text style={styles.recoveryText}>An earlier request may already have created a private report. Starting again can create a separate report. This confirmed action clears the damaged attempt, private draft and local evidence.</Text>
                  {recoveryError ? <Text style={styles.errorText}>{recoveryError}</Text> : null}
                  <View style={styles.recoveryActions}>
                    <InteractiveSurface
                      accessibilityLabel="Cancel submission recovery"
                      accessibilityRole="button"
                      disabled={recoveryPending}
                      focusStyle={styles.controlFocused}
                      onPress={() => setConfirmRecovery(false)}
                      pressedStyle={styles.pressed}
                      style={styles.recoveryCancel}
                      testID="report-cancel-corrupt-recovery"
                    >
                      <Text style={styles.recoveryCancelText}>Cancel</Text>
                    </InteractiveSurface>
                    <InteractiveSurface
                      accessibilityLabel={recoveryPending ? 'Resetting damaged submission state' : 'Confirm reset and start a new private report'}
                      accessibilityRole="button"
                      accessibilityState={{ busy: recoveryPending, disabled: recoveryPending }}
                      disabled={recoveryPending}
                      focusStyle={styles.controlFocused}
                      onPress={onRecoverCorruptReport}
                      pressedStyle={styles.pressed}
                      style={styles.recoveryConfirm}
                      testID="report-confirm-corrupt-recovery"
                    >
                      {recoveryPending ? <ActivityIndicator color={colors.paper} size="small" /> : null}
                      <Text style={styles.recoveryConfirmText}>{recoveryPending ? 'Resetting…' : 'Start a new report'}</Text>
                    </InteractiveSurface>
                  </View>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.actionPanel}>
            <InteractiveSurface
              accessibilityLabel={submissionPending ? 'Submitting private report' : submissionError ? 'Retry private report submission' : 'Submit private report'}
              accessibilityRole="button"
              accessibilityState={{ busy: submissionPending, disabled: disabled || submissionRecoveryRequired || Boolean(errors.namedPartner) }}
              disabled={disabled || submissionRecoveryRequired || Boolean(errors.namedPartner)}
              disabledStyle={styles.disabled}
              focusStyle={styles.primaryFocused}
              hoverStyle={styles.primaryHovered}
              onPress={onSubmit}
              pressedStyle={styles.pressed}
              style={[styles.primaryButton, webGradient]}
              testID="report-submit-private"
            >
              {submissionPending ? <ActivityIndicator color={colors.paper} size="small" /> : <Ionicons color={colors.paper} name="lock-closed-outline" size={19} />}
              <Text style={styles.primaryButtonText}>{submissionPending ? 'Submitting private report…' : submissionError ? 'Retry private submission' : 'Submit private report'}</Text>
            </InteractiveSurface>
            <InteractiveSurface
              accessibilityLabel={savePending ? 'Saving private report draft' : 'Save private report draft'}
              accessibilityRole="button"
              accessibilityState={{ busy: savePending, disabled }}
              disabled={disabled}
              disabledStyle={styles.disabled}
              focusStyle={styles.controlFocused}
              hoverStyle={styles.secondaryHovered}
              onPress={onSave}
              pressedStyle={styles.pressed}
              style={styles.secondaryButton}
              testID="report-save-private-draft"
            >
              {savePending ? <ActivityIndicator color={colors.blue} size="small" /> : <Ionicons color={colors.blue} name="save-outline" size={18} />}
              <Text style={styles.secondaryButtonText}>{savePending ? 'Saving private draft…' : 'Save private draft'}</Text>
            </InteractiveSurface>
            <InteractiveSurface
              accessibilityLabel="Back to edit report"
              accessibilityRole="link"
              focusStyle={styles.controlFocused}
              hoverStyle={styles.linkHovered}
              onPress={onBackToEdit}
              pressedStyle={styles.pressed}
              style={styles.backToEditLink}
              testID="report-back-to-edit"
            >
              <Text style={styles.backToEditText}>Back to edit</Text>
            </InteractiveSurface>
            <Text style={styles.notSubmitted}>Submission sends the reviewed structured facts and permissions. Local evidence images stay on this device; nothing is published automatically.</Text>
          </View>
        </>
      ) : null}
    </PrototypeTabScreen>
  );
}

function PermissionRow({ checked, description, label, onPress, testID }: {
  checked: boolean;
  description: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const webKeyboardProps = Platform.OS === 'web'
    ? ({
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (event.key !== ' ') return;
          event.preventDefault();
          onPress();
        },
      } as unknown as Partial<ComponentProps<typeof InteractiveSurface>>)
    : {};
  return (
    <InteractiveSurface
      {...webKeyboardProps}
      aria-checked={checked}
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      focusStyle={styles.controlFocused}
      hoverStyle={styles.permissionHovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={styles.permissionRow}
      testID={testID}
    >
      <View style={styles.permissionCopy}>
        <Text style={styles.permissionLabel}>{label}</Text>
        <Text style={styles.permissionDescription}>{description}</Text>
      </View>
      <View style={styles.switchTarget}>
        <View style={[styles.switchTrack, checked && styles.switchTrackChecked]}>
          <View style={[styles.switchThumb, checked && styles.switchThumbChecked]} />
        </View>
      </View>
    </InteractiveSurface>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { gap: 12, paddingTop: 12, paddingBottom: 116 },
  backRow: { minWidth: 0, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8, paddingHorizontal: 8, borderRadius: 10 },
  backText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 20 },
  backHovered: { backgroundColor: colors.ice },
  stepBadge: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 9, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 6, backgroundColor: colors.ice },
  stepBadgeText: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.7, textTransform: 'uppercase' },
  headingBlock: { gap: 5 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, lineHeight: 34, letterSpacing: -0.45 },
  lede: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  loadingPanel: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 10, backgroundColor: colors.ice },
  loadingText: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  incompletePanel: { minWidth: 0, width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 12, backgroundColor: colors.amberSoft },
  incompleteCopy: { minWidth: 0, flex: 1, gap: 7 },
  incompleteTitle: { color: '#6F4B00', fontFamily: typography.bodySemiBold, fontSize: 16, lineHeight: 22 },
  incompleteText: { color: '#6F4B00', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  inlineButton: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#B67C00', borderRadius: 999, backgroundColor: colors.paper },
  inlineButtonText: { color: '#6F4B00', fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  previewCard: { position: 'relative', minWidth: 0, width: 'auto', gap: 9, marginLeft: 24, paddingTop: 13, paddingRight: 13, paddingBottom: 13, paddingLeft: 70, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  privacyMascot: { position: 'absolute', zIndex: 2, top: 57, left: -32, width: 100, height: 72 },
  cardTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  previewStack: { minWidth: 0, gap: 7 },
  previewBlock: { minWidth: 0, gap: 4, padding: 10, borderRadius: 8, backgroundColor: colors.canvas },
  previewLabel: { color: colors.quiet, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.7, textTransform: 'uppercase' },
  privateValue: { color: colors.ink, fontFamily: typography.mono, fontSize: 12, lineHeight: 18 },
  publicPreviewInput: { minWidth: 0, width: '100%', minHeight: 62, padding: 0, color: colors.ink, fontFamily: typography.mono, fontSize: 12, lineHeight: 18 },
  previewInputWarning: { borderWidth: 1, borderColor: '#B83939', borderRadius: 7, padding: 8 },
  previewFooter: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  hiddenBadge: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 5, backgroundColor: colors.ice },
  hiddenBadgeText: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.5, textTransform: 'uppercase' },
  restoreButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8 },
  restoreText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 12, lineHeight: 18 },
  restoreHovered: { backgroundColor: colors.ice },
  previewNote: { color: colors.quiet, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  previewWarning: { color: '#9F2525', fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 18 },
  permissionsCard: { minWidth: 0, width: '100%', gap: 3, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  permissionRow: { minWidth: 0, width: '100%', minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: -5, paddingHorizontal: 5, paddingVertical: 6, borderRadius: 8 },
  permissionCopy: { minWidth: 0, flex: 1, gap: 2 },
  permissionLabel: { color: colors.body, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  permissionDescription: { color: colors.quiet, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  permissionHovered: { backgroundColor: '#F8FBFE' },
  switchTarget: { width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  switchTrack: { position: 'relative', width: 38, height: 22, borderRadius: 999, backgroundColor: '#B9C0C7' },
  switchTrackChecked: { backgroundColor: colors.blue },
  switchThumb: { position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.paper },
  switchThumbChecked: { left: 19 },
  rule: { height: 1, backgroundColor: '#E9EDF1' },
  partnerField: { gap: 6, paddingTop: 8 },
  partnerInput: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.canvas, color: colors.ink, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  errorText: { color: '#9F2525', fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 18 },
  summaryCard: { minWidth: 0, width: '100%', gap: 0, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  summaryRow: { minWidth: 0, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E9EDF1' },
  summaryLabel: { minWidth: 0, flex: 1, color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  summaryValue: { color: colors.navy, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'right' },
  warningPanel: { minWidth: 0, width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 12, backgroundColor: colors.amberSoft },
  warningText: { minWidth: 0, flex: 1, color: '#6F4B00', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  storageError: { padding: 11, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 10, backgroundColor: colors.amberSoft },
  storageErrorText: { color: '#6F4B00', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  saveNotice: { minWidth: 0, width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderWidth: 1, borderColor: '#B8DDB0', borderRadius: 10, backgroundColor: '#EEF9EB' },
  saveNoticeText: { minWidth: 0, flex: 1, color: '#1E632B', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  actionPanel: { gap: 8 },
  primaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryButtonText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  primaryHovered: { opacity: 0.94 },
  primaryFocused: { borderWidth: 3, borderColor: colors.navy },
  secondaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  secondaryButtonText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  secondaryHovered: { backgroundColor: colors.ice },
  backToEditLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  backToEditText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  linkHovered: { backgroundColor: colors.ice },
  submissionError: { minWidth: 0, width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#E3A0A0', borderRadius: 12, backgroundColor: '#FFF2F2' },
  submissionErrorCopy: { minWidth: 0, flex: 1, gap: 3 },
  submissionErrorTitle: { color: '#9F2525', fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  submissionErrorText: { color: '#7C2929', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  recoveryPanel: { minWidth: 0, width: '100%', gap: 9, padding: 12, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 12, backgroundColor: colors.amberSoft },
  recoveryTitle: { color: '#6F4B00', fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  recoveryText: { color: '#6F4B00', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  recoveryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#C58B12', borderRadius: 999, backgroundColor: colors.paper },
  recoveryButtonText: { color: '#6F4B00', fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  recoveryActions: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recoveryCancel: { minWidth: 0, minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C58B12', borderRadius: 999, backgroundColor: colors.paper },
  recoveryCancelText: { color: '#6F4B00', fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  recoveryConfirm: { minWidth: 0, minHeight: 48, flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#9F2525' },
  recoveryConfirmText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  notSubmitted: { color: colors.quiet, fontFamily: typography.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  controlFocused: { borderWidth: 3, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
