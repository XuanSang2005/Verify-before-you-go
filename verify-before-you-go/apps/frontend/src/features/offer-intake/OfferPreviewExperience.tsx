import type { AnalyseOfferResponse } from '@vbyg/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { analyseOfferDraft } from '@/features/analysis/api';
import { colors, typography } from '@/theme';

import type { OfferDraft } from './model';
import {
  ANALYSIS_STATUS_MESSAGES,
  PreviewAnalysisCoordinator,
  isPreviewAbort,
  shouldAnimateScanBeam,
  waitForPreviewDwell,
  type AnalysePreviewDraft,
  type PreviewDwell,
} from './preview-analysis';

export type OfferPreviewPhase = 'ready' | 'analysing' | 'error';

interface OfferPreviewExperienceProps {
  analyseDraft?: AnalysePreviewDraft;
  draft: OfferDraft;
  dwell?: PreviewDwell;
  mascotSource: ImageSourcePropType;
  onAnalysisComplete: (analysis: AnalyseOfferResponse) => void;
  onAnalysisStart?: () => void;
  onEdit: () => void;
  recentSaveNotice?: string;
  reduceMotion: boolean;
}

export function OfferPreviewExperience({
  analyseDraft = analyseOfferDraft,
  draft,
  dwell = waitForPreviewDwell,
  mascotSource,
  onAnalysisComplete,
  onAnalysisStart,
  onEdit,
  recentSaveNotice,
  reduceMotion,
}: OfferPreviewExperienceProps) {
  const [phase, setPhase] = useState<OfferPreviewPhase>('ready');
  const [analysisError, setAnalysisError] = useState<string>();
  const [statusIndex, setStatusIndex] = useState(0);
  const [scanSheetHeight, setScanSheetHeight] = useState(0);
  const [scanOffset] = useState(() => new Animated.Value(0));
  const analysisInFlightRef = useRef(false);
  const coordinator = useMemo(
    () => new PreviewAnalysisCoordinator(analyseDraft, dwell),
    [analyseDraft, dwell],
  );
  const hasScannableContent = Boolean(draft.text.trim() || draft.link.trim());

  useEffect(() => () => {
    analysisInFlightRef.current = false;
    coordinator.cancel();
  }, [coordinator]);

  useEffect(() => {
    if (phase !== 'analysing') return;
    const timers = ANALYSIS_STATUS_MESSAGES.slice(1).map((_, index) => setTimeout(
      () => setStatusIndex(index + 1),
      (index + 1) * 1_600,
    ));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  useEffect(() => {
    scanOffset.stopAnimation();
    scanOffset.setValue(0);
    if (!shouldAnimateScanBeam(phase, reduceMotion, scanSheetHeight, hasScannableContent)) return;

    const loop = Animated.loop(Animated.timing(scanOffset, {
      duration: 2_600,
      easing: Easing.bezier(0.65, 0, 0.35, 1),
      toValue: scanSheetHeight,
      useNativeDriver: true,
    }));
    loop.start();
    return () => {
      loop.stop();
      scanOffset.stopAnimation();
    };
  }, [hasScannableContent, phase, reduceMotion, scanOffset, scanSheetHeight]);

  const startAnalysis = async () => {
    if (analysisInFlightRef.current) return;
    analysisInFlightRef.current = true;
    setAnalysisError(undefined);
    setStatusIndex(0);
    setPhase('analysing');
    onAnalysisStart?.();

    const attempt = coordinator.start(draft, reduceMotion);
    let result: AnalyseOfferResponse;
    try {
      result = await attempt.completion;
    } catch (error) {
      if (!coordinator.isCurrent(attempt.id) || isPreviewAbort(error, attempt.signal)) return;
      coordinator.finish(attempt.id);
      analysisInFlightRef.current = false;
      setAnalysisError(error instanceof Error ? error.message : 'The local analysis could not be completed.');
      setPhase('error');
      return;
    }

    if (!coordinator.isCurrent(attempt.id)) return;
    coordinator.finish(attempt.id);
    analysisInFlightRef.current = false;
    onAnalysisComplete(result);
  };

  const phaseLabel = phase === 'analysing'
    ? 'CHECK · ANALYSING'
    : phase === 'error'
      ? 'CHECK · ANALYSIS PAUSED'
      : 'CHECK · READY TO ANALYSE';

  return (
    <View style={styles.experience} testID="offer-preview-experience">
      <Text accessibilityRole="header" style={styles.kicker}>{phaseLabel}</Text>

      {recentSaveNotice ? (
        <View accessibilityLiveRegion="polite" style={styles.saveNotice}>
          <Text style={styles.saveNoticeText}>{recentSaveNotice}</Text>
        </View>
      ) : null}

      <View
        accessibilityLabel="Submitted recruitment posting preview"
        onLayout={(event: LayoutChangeEvent) => setScanSheetHeight(event.nativeEvent.layout.height)}
        style={styles.scanSheet}
        testID="preview-scan-sheet"
      >
        {phase === 'analysing' && hasScannableContent ? (
          reduceMotion ? (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.staticScanLines} testID="preview-scan-lines-static">
              <View style={styles.primaryScanLine} />
              <View style={styles.secondaryScanLine} />
            </View>
          ) : (
            <Animated.View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.movingScanLines, { transform: [{ translateY: scanOffset }] }]}
              testID="preview-scan-lines-moving"
            >
              <View style={styles.primaryScanLine} />
              <View style={styles.secondaryScanLine} />
            </Animated.View>
          )
        ) : null}

        <View style={styles.submittedContent}>
          {draft.text.trim() ? <Text selectable style={styles.postingText}>{draft.text}</Text> : null}

          {draft.link.trim() ? (
            <View style={styles.metadataGroup}>
              <Text style={styles.metadataLabel}>SUBMITTED URL TEXT</Text>
              <Text selectable style={styles.urlText}>{draft.link}</Text>
              <Text style={styles.metadataHelper}>The analysis reads the URL text only. It does not open, fetch or verify the destination page.</Text>
            </View>
          ) : null}

          {draft.screenshot ? (
            <View style={styles.screenshotSummary} testID="preview-screenshot-summary">
              <Text style={styles.screenshotCopy}>Screenshot attached · no text extracted or uploaded</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View accessibilityLiveRegion="polite" style={styles.statusRow} testID="preview-analysis-status">
        <Text style={styles.statusNumber}>{statusNumber(phase, statusIndex)}</Text>
        <Text style={styles.statusText}>{statusMessage(phase, statusIndex)}</Text>
      </View>

      {phase === 'analysing' ? (
        <Text style={styles.localDisclosure}>This is a local rule check, not a live employer or licence verification.</Text>
      ) : null}

      <View accessible={false} style={styles.mascotStage} testID="preview-mascot-stage">
        <RainbowStrip />
        <Image accessible={false} resizeMode="contain" source={mascotSource} style={styles.mascot} />
      </View>

      <View style={styles.divider} />
      <Text style={styles.privacyCopy}>Nothing you paste is stored against your name. You can leave this screen and the numbers in Get help still work.</Text>

      {phase === 'error' ? (
        <View accessibilityLiveRegion="polite" style={styles.errorPanel} testID="preview-analysis-error">
          <Text style={styles.errorTitle}>Analysis paused</Text>
          <Text style={styles.errorCopy}>{analysisError}</Text>
        </View>
      ) : null}

      {phase !== 'analysing' ? (
        <View style={styles.actionRow}>
          <PreviewControl kind="secondary" label="Edit posting" onPress={onEdit} testID="preview-edit" />
          <PreviewControl
            kind="primary"
            label={phase === 'error' ? 'Retry analysis' : 'Start analysis'}
            onPress={() => void startAnalysis()}
            testID={phase === 'error' ? 'preview-retry' : 'preview-start'}
          />
        </View>
      ) : null}
    </View>
  );
}

function RainbowStrip() {
  return (
    <View accessible={false} style={[styles.rainbowStrip, webRainbowGradient]}>
      {Platform.OS === 'web' ? null : (
        <>
          <View style={[styles.rainbowSegment, styles.rainbowAmber]} />
          <View style={[styles.rainbowSegment, styles.rainbowGreen]} />
          <View style={[styles.rainbowSegment, styles.rainbowCyan]} />
          <View style={[styles.rainbowSegment, styles.rainbowPurple]} />
        </>
      )}
    </View>
  );
}

function PreviewControl({
  kind,
  label,
  onPress,
  testID,
}: {
  kind: 'primary' | 'secondary';
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <InteractiveSurface
      accessibilityLabel={label}
      accessibilityRole="button"
      focusStyle={kind === 'primary' ? styles.primaryFocused : styles.secondaryFocused}
      hoverStyle={kind === 'primary' ? styles.primaryHovered : styles.secondaryHovered}
      onPress={onPress}
      pressedStyle={styles.controlPressed}
      style={kind === 'primary' ? styles.primaryControl : styles.secondaryControl}
      testID={testID}
    >
      <Text style={kind === 'primary' ? styles.primaryControlText : styles.secondaryControlText}>{label}</Text>
    </InteractiveSurface>
  );
}

function statusNumber(phase: OfferPreviewPhase, statusIndex: number): string {
  if (phase === 'ready') return '00';
  if (phase === 'error') return '--';
  return String(statusIndex + 1).padStart(2, '0');
}

function statusMessage(phase: OfferPreviewPhase, statusIndex: number): string {
  if (phase === 'ready') return 'READY TO ANALYSE';
  if (phase === 'error') return 'ANALYSIS PAUSED';
  return ANALYSIS_STATUS_MESSAGES[statusIndex];
}

const webRainbowGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(90deg,#FFC24D 0%,#8ED97F 34%,#3FB6E8 67%,#A855F7 100%)' },
  default: {},
}) as ViewStyle;

const styles = StyleSheet.create({
  experience: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 16, overflow: 'hidden' },
  kicker: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.32, textTransform: 'uppercase' },
  saveNotice: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#ECCB80', borderRadius: 10, backgroundColor: colors.amberSoft },
  saveNoticeText: { color: '#6F4B00', fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  scanSheet: { position: 'relative', minWidth: 0, width: '100%', maxWidth: '100%', overflow: 'hidden', padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper, ...Platform.select({ web: { boxShadow: '0 1px 2px rgba(34,30,31,.05)' }, default: { shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 } }) },
  submittedContent: { minWidth: 0, width: '100%', gap: 12 },
  postingText: { minWidth: 0, color: colors.body, fontFamily: typography.body, fontSize: 14, lineHeight: 22 },
  metadataGroup: { minWidth: 0, width: '100%', gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E9EDF1' },
  metadataLabel: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.88, textTransform: 'uppercase' },
  urlText: { minWidth: 0, color: colors.body, fontFamily: typography.mono, fontSize: 12, lineHeight: 18 },
  metadataHelper: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  screenshotSummary: { minWidth: 0, width: '100%', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E9EDF1' },
  screenshotCopy: { color: colors.muted, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  movingScanLines: { position: 'absolute', zIndex: 2, top: 0, right: 0, left: 0, height: 5, gap: 3 },
  staticScanLines: { position: 'absolute', zIndex: 2, top: 0, right: 0, left: 0, height: 5, gap: 3 },
  primaryScanLine: { width: '100%', height: 1, backgroundColor: colors.brightBlue },
  secondaryScanLine: { width: '100%', height: 1, backgroundColor: colors.paleBlue },
  statusRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusNumber: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.96 },
  statusText: { minWidth: 0, flex: 1, color: colors.blue, fontFamily: typography.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: 'uppercase' },
  localDisclosure: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  mascotStage: { alignSelf: 'center', width: 268, maxWidth: '100%', overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.paper },
  rainbowStrip: { width: '100%', height: 3, flexDirection: 'row' },
  rainbowSegment: { height: 3, flex: 1 },
  rainbowAmber: { backgroundColor: colors.amber },
  rainbowGreen: { backgroundColor: '#8ED97F' },
  rainbowCyan: { backgroundColor: '#3FB6E8' },
  rainbowPurple: { backgroundColor: '#A855F7' },
  mascot: { width: '100%', height: 172, marginVertical: 8 },
  divider: { width: '100%', height: 1, backgroundColor: colors.line },
  privacyCopy: { maxWidth: 520, color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  errorPanel: { gap: 3, padding: 12, borderWidth: 1, borderColor: '#E5B7B7', borderRadius: 10, backgroundColor: '#FFF3F3' },
  errorTitle: { color: '#8C2424', fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  errorCopy: { color: '#8C2424', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  actionRow: { minWidth: 0, width: '100%', flexDirection: 'row', gap: 10 },
  secondaryControl: { minWidth: 0, minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: colors.paper },
  primaryControl: { minWidth: 0, minHeight: 48, flex: 1.25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.blue },
  secondaryControlText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  primaryControlText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  primaryHovered: { backgroundColor: colors.brightBlue },
  secondaryHovered: { backgroundColor: colors.ice },
  primaryFocused: { borderWidth: 3, borderColor: colors.navy },
  secondaryFocused: { borderWidth: 2, borderColor: colors.blue },
  controlPressed: { opacity: 0.72 },
});
