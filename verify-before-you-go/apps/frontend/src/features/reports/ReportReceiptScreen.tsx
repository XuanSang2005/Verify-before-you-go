import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import type { ReportSubmissionResponse } from '@vbyg/contracts';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import { useReportSubmission } from './ReportSubmissionContext';

const receiptMascot = require('../../../assets/mascots/receipt-highfive-screen11.png');

const webPrimaryGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

const webRibbonGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(110deg,#EEF9EB 0%,#FFFFFF 100%)' },
  default: {},
}) as ViewStyle;

export function ReportReceiptScreen() {
  const submission = useReportSubmission();
  if (!submission.receipt) {
    return (
      <MissingReceiptExperience
        onReturnToPrivacy={() => router.replace('/reports/privacy')}
        onStartNew={() => router.replace('/reports/new')}
      />
    );
  }
  return (
    <ReportReceiptExperience
      onViewStatus={() => router.replace('/reports')}
      receipt={submission.receipt}
      retentionNotice={submission.retentionNotice}
    />
  );
}

export function ReportReceiptExperience({
  onViewStatus,
  receipt,
  retentionNotice,
}: {
  onViewStatus: () => void;
  receipt: ReportSubmissionResponse;
  retentionNotice?: string;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [downloaded, setDownloaded] = useState(false);
  const recoveryKeyAvailable = receipt.recoveryKeyStatus === 'delivered' && Boolean(receipt.recoveryKey);

  const copyRecoveryKey = async () => {
    if (!receipt.recoveryKey) return;
    try {
      await Clipboard.setStringAsync(receipt.recoveryKey);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const downloadRecoveryKey = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !receipt.recoveryKey) return;
    const content = [
      'Verify Before You Go — private report recovery key',
      `Report ID: ${receipt.report.reportId}`,
      `Recovery key: ${receipt.recoveryKey}`,
      `Submitted: ${receipt.report.submittedAt}`,
      '',
      'Keep this file private. The receipt does not mean the report was reviewed, verified or published.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${receipt.report.reportId}-recovery-key.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="report-receipt-screen">
      <StatusBar style="dark" />
      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>Case {receipt.report.reportId} · Private intake</Text>
        <Text accessibilityRole="header" style={styles.title}>Report received.</Text>
      </View>

      <View style={[styles.receiptRibbon, webRibbonGradient]} testID="report-receipt-ribbon">
        <Image accessible={false} resizeMode="contain" source={receiptMascot} style={styles.receiptMascot} />
        <View style={styles.receivedBadge}>
          <Ionicons color="#1E632B" name="checkmark-circle" size={16} />
          <Text style={styles.receivedBadgeText}>Submitted · Private</Text>
        </View>
      </View>

      <View style={styles.receivedPanel}>
        <Text style={styles.receivedLead}>{receipt.report.statusLabel}</Text>
        <Text style={styles.receivedText}>{receipt.report.privateIntakeNotice}</Text>
      </View>

      <View style={styles.detailsPanel}>
        <ReceiptDetail label="Report ID" value={receipt.report.reportId} />
        <View style={styles.rule} />
        <ReceiptDetail label="Submitted" value={formatSubmissionTime(receipt.report.submittedAt)} />
        <View style={styles.rule} />
        <ReceiptDetail label="Initial status" value="Received" />
      </View>

      <View style={styles.stepsPanel}>
        <Text style={styles.panelTitle}>What happens next</Text>
        <ReceiptStep index="1" strong="Submitted" text="now" />
        <ReceiptStep index="2" text="Safety and privacy review · next" />
        <ReceiptStep index="3" text="Evidence review" />
        <ReceiptStep index="4" text="Included in an alert, or closed" />
      </View>

      <View style={styles.recoveryPanel} testID="report-recovery-panel">
        <Text style={styles.recoveryKicker}>{recoveryKeyAvailable ? 'Recovery key · shown in this receipt' : 'Recovery key · unavailable on this retry'}</Text>
        {recoveryKeyAvailable ? (
          <Text accessibilityLabel={`Recovery key ${receipt.recoveryKey}`} selectable style={styles.recoveryCode} testID="report-recovery-key">
            {receipt.recoveryKey}
          </Text>
        ) : (
          <Text accessibilityRole="header" style={styles.recoveryUnavailable} testID="report-recovery-key-unavailable">Not available again</Text>
        )}
        <Text style={styles.recoveryText}>{recoveryKeyAvailable
          ? 'Save this key privately. It is the only way to reopen this anonymous report on another device.'
          : 'For security, the raw key is only delivered during a short retry window. Use the copy saved from the initial receipt.'}</Text>
        {retentionNotice ? (
          <View style={styles.retentionNotice}>
            <Ionicons color={colors.sky} name="lock-closed-outline" size={17} />
            <Text style={styles.retentionText}>{retentionNotice}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.localEvidenceNote}>
        <Ionicons color="#7A5200" name="images-outline" size={20} />
        <Text style={styles.localEvidenceText}>Images in the private draft remain on this device. This CP11 submission sends the reviewed structured report only.</Text>
      </View>

      <View style={styles.actionPanel}>
        {recoveryKeyAvailable ? <InteractiveSurface
          accessibilityLabel={copyState === 'copied' ? 'Recovery key copied' : 'Copy recovery key'}
          accessibilityRole="button"
          focusStyle={styles.primaryFocused}
          hoverStyle={styles.primaryHovered}
          onPress={() => void copyRecoveryKey()}
          pressedStyle={styles.pressed}
          style={[styles.primaryButton, webPrimaryGradient]}
          testID="report-copy-recovery-key"
        >
          <Ionicons color={colors.paper} name={copyState === 'copied' ? 'checkmark' : 'copy-outline'} size={19} />
          <Text style={styles.primaryButtonText}>{copyState === 'copied' ? 'Recovery key copied' : 'Copy recovery key'}</Text>
        </InteractiveSurface> : null}
        {recoveryKeyAvailable && Platform.OS === 'web' ? (
          <InteractiveSurface
            accessibilityLabel="Download recovery key as a private text file"
            accessibilityRole="button"
            focusStyle={styles.controlFocused}
            hoverStyle={styles.secondaryHovered}
            onPress={downloadRecoveryKey}
            pressedStyle={styles.pressed}
            style={styles.secondaryButton}
            testID="report-download-recovery-key"
          >
            <Ionicons color={colors.blue} name={downloaded ? 'checkmark' : 'download-outline'} size={18} />
            <Text style={styles.secondaryButtonText}>{downloaded ? 'Recovery key downloaded' : 'Download recovery key'}</Text>
          </InteractiveSurface>
        ) : null}
        <InteractiveSurface
          accessibilityLabel="View private report status"
          accessibilityRole="link"
          focusStyle={styles.controlFocused}
          hoverStyle={styles.linkHovered}
          onPress={onViewStatus}
          pressedStyle={styles.pressed}
          style={styles.statusLink}
          testID="report-view-status"
        >
          <Text style={styles.statusLinkText}>View report status</Text>
          <Ionicons color={colors.blue} name="chevron-forward" size={18} />
        </InteractiveSurface>
        {copyState === 'failed' ? (
          <Text accessibilityLiveRegion="assertive" style={styles.copyError}>Copy failed. Select the recovery key above and save it manually.</Text>
        ) : null}
      </View>
    </PrototypeTabScreen>
  );
}

function MissingReceiptExperience({ onReturnToPrivacy, onStartNew }: {
  onReturnToPrivacy: () => void;
  onStartNew: () => void;
}) {
  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="report-receipt-missing">
      <StatusBar style="dark" />
      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>Private report receipt</Text>
        <Text accessibilityRole="header" style={styles.title}>No receipt in this session.</Text>
        <Text style={styles.missingLede}>A receipt appears here only after the backend confirms a private submission. No case ID or recovery key has been generated on this screen.</Text>
      </View>
      <View style={styles.receivedPanel}>
        <Text style={styles.receivedLead}>Your local draft may still be available.</Text>
        <Text style={styles.receivedText}>Return to privacy review to submit or retry. A failed request never creates a simulated receipt.</Text>
      </View>
      <InteractiveSurface
        accessibilityLabel="Return to report privacy review"
        accessibilityRole="link"
        focusStyle={styles.primaryFocused}
        onPress={onReturnToPrivacy}
        pressedStyle={styles.pressed}
        style={[styles.primaryButton, webPrimaryGradient]}
        testID="report-receipt-return-privacy"
      >
        <Text style={styles.primaryButtonText}>Return to privacy review</Text>
      </InteractiveSurface>
      <InteractiveSurface
        accessibilityLabel="Start a new private report"
        accessibilityRole="link"
        focusStyle={styles.controlFocused}
        onPress={onStartNew}
        pressedStyle={styles.pressed}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Open report details</Text>
      </InteractiveSurface>
    </PrototypeTabScreen>
  );
}

function ReceiptDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ReceiptStep({ index, strong, text }: { index: string; strong?: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIndex}><Text style={styles.stepIndexText}>{index}</Text></View>
      <Text style={styles.stepText}>{strong ? <Text style={styles.stepStrong}>{strong} · </Text> : null}{text}</Text>
    </View>
  );
}

function formatSubmissionTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  screenContent: { gap: 12, paddingTop: 12, paddingBottom: 116 },
  headingBlock: { gap: 5 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, lineHeight: 34, letterSpacing: -0.45 },
  missingLede: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  receiptRibbon: { minWidth: 0, width: '100%', minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2, paddingRight: 12, paddingBottom: 2, paddingLeft: 1, borderWidth: 1, borderColor: '#B8DDB0', borderRadius: 14, overflow: 'hidden', backgroundColor: '#EEF9EB' },
  receiptMascot: { width: 112, height: 66, marginTop: -4, marginBottom: -3, flexShrink: 0 },
  receivedBadge: { minWidth: 0, minHeight: 30, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: '#B8DDB0', borderRadius: 5, backgroundColor: '#EEF9EB' },
  receivedBadgeText: { minWidth: 0, flexShrink: 1, color: '#1E632B', fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.7, textTransform: 'uppercase' },
  receivedPanel: { gap: 4, padding: 13, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  receivedLead: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 22 },
  receivedText: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  detailsPanel: { paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  detailRow: { minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detailLabel: { minWidth: 0, flex: 1, color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  detailValue: { maxWidth: '62%', color: colors.navy, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.35, textAlign: 'right', textTransform: 'uppercase' },
  rule: { height: 1, backgroundColor: '#E9EDF1' },
  stepsPanel: { gap: 10, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  panelTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  stepRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepIndex: { width: 25, height: 25, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.navy },
  stepIndexText: { color: colors.paper, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16 },
  stepText: { minWidth: 0, flex: 1, paddingTop: 2, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  stepStrong: { fontFamily: typography.bodySemiBold },
  recoveryPanel: { gap: 8, padding: 14, borderWidth: 1, borderColor: '#164A77', borderRadius: 12, backgroundColor: colors.navy },
  recoveryKicker: { color: colors.paleBlue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  recoveryCode: { color: colors.paper, fontFamily: typography.monoMedium, fontSize: 18, lineHeight: 28, letterSpacing: 1.25 },
  recoveryUnavailable: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 18, lineHeight: 26 },
  recoveryText: { color: '#EAF3FB', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  retentionNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingTop: 5, borderTopWidth: 1, borderTopColor: 'rgba(168,211,242,0.24)' },
  retentionText: { minWidth: 0, flex: 1, color: colors.paleBlue, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  localEvidenceNote: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 10, backgroundColor: colors.amberSoft },
  localEvidenceText: { minWidth: 0, flex: 1, color: '#6F4B00', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  actionPanel: { gap: 8 },
  primaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryButtonText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  primaryHovered: { opacity: 0.94 },
  primaryFocused: { borderWidth: 3, borderColor: colors.navy },
  secondaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  secondaryButtonText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  secondaryHovered: { backgroundColor: colors.ice },
  statusLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 10 },
  statusLinkText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  linkHovered: { backgroundColor: colors.ice },
  copyError: { color: '#9F2525', fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  controlFocused: { borderWidth: 3, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
});
