import { Ionicons } from '@expo/vector-icons';
import type { AnalysisFinding, AnalyseOfferResponse } from '@vbyg/contracts';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { verticalScrollViewProps } from '@/components/vertical-scroll-props';
import { useOfferDraft } from '@/features/offer-intake/OfferDraftContext';
import { layout, typography } from '@/theme';

import { buildMarkedTextSegments, MIN_MARKED_PASSAGE_TARGET } from './marked-segments';
import { orderFindingsForPresentation } from './finding-order';
import { analysisActionRoutes } from './navigation';

const navy = '#00224A';
const navyRaised = '#00305C';
const paleBlue = '#A8D3F2';
const sky = '#4DA3E4';

const webGridTexture = Platform.select({
  web: {
    backgroundImage:
      'linear-gradient(rgba(168,211,242,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(168,211,242,.09) 1px,transparent 1px)',
    backgroundSize: '24px 24px',
  },
  default: {},
}) as ViewStyle;

export function AnalysisOverviewScreen() {
  const { analysis, draft } = useOfferDraft();

  if (!analysis) return <EmptyAnalysis />;

  const displayFindings = orderFindingsForPresentation(analysis.findings);
  const title = analysis.observedSignalCount === 0
    ? 'No prototype signals observed'
    : analysis.observedSignalCount === 1
      ? 'One warning sign'
      : 'Several warning signs';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} testID="analysis-overview">
      <StatusBar style="light" />
      <View style={styles.pageFrame}>
        <View style={styles.contentFrame}>
          <ScrollView
            {...verticalScrollViewProps}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.summaryCard}>
            <View style={styles.summaryMain}>
              <View accessibilityElementsHidden style={styles.signalGlyph}>
                <View style={styles.signalBarHidden} />
                <View style={styles.signalBar} />
                <View style={styles.signalBar} />
              </View>
              <View style={styles.summaryCopy}>
                <Text accessibilityRole="header" style={styles.summaryTitle}>{title}</Text>
                <Text style={styles.summaryCount}>
                  {analysis.observedSignalCount} of {analysis.checkedRuleCount} signals we check for
                </Text>
                <View style={styles.notVerdictRow}>
                  <Ionicons color="#FFFFFF" name="information-circle-outline" size={16} />
                  <Text style={styles.notVerdictText}>
                    <Text style={styles.notVerdictStrong}>Not a verdict. </Text>
                    Verify through independent official sources.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionRule}>
            <Text style={styles.sectionRuleText}>The posting you pasted</Text>
            <View style={styles.ruleLine} />
            <Text style={styles.sectionRuleCount}>{analysis.markedPassages.length} marked</Text>
          </View>

          <PostingCard
            analysis={analysis}
            displayFindings={displayFindings}
            postingText={draft.text}
            recruitmentLink={draft.link}
          />

          <View style={styles.guideRow}>
            <Image
              accessibilityIgnoresInvertColors
              accessible={false}
              resizeMode="contain"
              source={require('../../../assets/mascots/screen04-guide.jpg')}
              style={styles.guideMascot}
            />
            <View style={styles.guideCopy}>
              <Text style={styles.guideText}>Tap a number in the margin to see what we noticed and how to check it yourself.</Text>
              <InteractiveSurface
                accessibilityLabel="Share observations"
                accessibilityRole="link"
                focusStyle={styles.inlineLinkFocused}
                hoverStyle={styles.inlineLinkHovered}
                onPress={() => router.push(analysisActionRoutes.share.route)}
                pressedStyle={styles.pressed}
                style={styles.inlineLink}
              >
                <Ionicons color={paleBlue} name="share-social-outline" size={16} />
                <Text style={styles.inlineLinkText}>Share observations</Text>
              </InteractiveSurface>
            </View>
          </View>
          </ScrollView>

          <View style={styles.footer}>
          <InteractiveSurface
            accessibilityLabel="Open verification checklist"
            accessibilityRole="link"
            focusStyle={styles.footerPrimaryFocused}
            hoverStyle={styles.footerPrimaryHovered}
            onPress={() => router.push(analysisActionRoutes.checklist.route)}
            pressedStyle={styles.pressed}
            style={styles.footerPrimary}
          >
            <Ionicons color="#005CA8" name="checkbox-outline" size={18} />
            <Text style={styles.footerPrimaryText}>Verification checklist</Text>
          </InteractiveSurface>
          <InteractiveSurface
            accessibilityLabel="Report this offer"
            accessibilityRole="link"
            focusStyle={styles.footerSecondaryFocused}
            hoverStyle={styles.footerSecondaryHovered}
            onPress={() => router.push(analysisActionRoutes.report.route)}
            pressedStyle={styles.pressed}
            style={styles.footerSecondary}
          >
            <Ionicons color={paleBlue} name="flag-outline" size={17} />
            <Text style={styles.footerSecondaryText}>Report this offer</Text>
          </InteractiveSurface>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function PostingCard({
  analysis,
  displayFindings,
  postingText,
  recruitmentLink,
}: {
  analysis: AnalyseOfferResponse;
  displayFindings: AnalysisFinding[];
  postingText: string;
  recruitmentLink: string;
}) {
  const segments = buildMarkedTextSegments(postingText, analysis.markedPassages);
  const absenceFindings = displayFindings.filter((finding) => finding.evidence.kind === 'absence');
  const linkFindings = displayFindings.filter(
    (finding) => finding.evidence.kind === 'passage' && finding.evidence.source === 'recruitmentLink',
  );

  return (
    <View style={[styles.postingCard, webGridTexture]}>
      <View style={styles.postingContent}>
        <View style={styles.evidenceLayout}>
          {displayFindings.length ? (
            <View accessibilityLabel={`${displayFindings.length} signal controls`} style={styles.annotationRail}>
              {displayFindings.map((finding, index) => (
                <MarginFindingControl finding={finding} index={index} key={finding.id} />
              ))}
            </View>
          ) : null}
          <View style={styles.postingCopy}>
            {postingText ? (
              <Text selectable style={styles.postingParagraph}>
                {segments.map((segment, index) => {
                  if (!segment.findingId) return <Text key={`plain-${index}`}>{segment.text}</Text>;
                  const finding = displayFindings.find((item) => item.id === segment.findingId);
                  return (
                    <Text
                      accessibilityHint="Use the numbered margin controls for a 44 pixel touch target"
                      accessibilityLabel={`Marked evidence: ${segment.text}`}
                      accessibilityRole={finding ? 'link' : undefined}
                      key={`${segment.findingId}-${index}`}
                      onPress={finding ? () => openFinding(finding.id) : undefined}
                      style={styles.inlineMarkedPassage}
                    >
                      {segment.text}
                    </Text>
                  );
                })}
              </Text>
            ) : (
              <Text style={styles.postingParagraph}>No transcription was provided, so there is no posting text to mark.</Text>
            )}

            {linkFindings.map((finding) => (
              <InteractiveSurface
                accessibilityLabel={`Open URL signal: ${finding.observedPattern}`}
                accessibilityRole="link"
                focusStyle={styles.urlEvidenceFocused}
                hoverStyle={styles.urlEvidenceHovered}
                key={finding.id}
                onPress={() => openFinding(finding.id)}
                pressedStyle={styles.pressed}
                style={styles.urlEvidence}
              >
                <Text style={styles.urlEvidenceLabel}>URL field</Text>
                <Text numberOfLines={2} selectable style={styles.urlEvidenceText}>
                  {recruitmentLink || (finding.evidence.kind === 'passage' ? finding.evidence.text : '')}
                </Text>
              </InteractiveSurface>
            ))}

            {absenceFindings.map((finding) => (
              <View key={finding.id} style={styles.absenceNote}>
                <Text style={styles.absenceNoteText}>{finding.evidence.kind === 'absence' ? finding.evidence.description : finding.observedPattern}</Text>
              </View>
            ))}

            {analysis.findings.length === 0 ? (
              <View style={styles.zeroFinding}>
                <Text style={styles.zeroFindingTitle}>No prototype rule matched.</Text>
                <Text style={styles.zeroFindingText}>This does not confirm the offer. Employer and recruiter claims still need independent verification.</Text>
              </View>
            ) : null}

            {analysis.screenshotNote ? <Text style={styles.screenshotNote}>{analysis.screenshotNote}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function MarginFindingControl({
  finding,
  index,
}: {
  finding: AnalysisFinding;
  index: number;
}) {
  const number = String(index + 1).padStart(2, '0');

  return (
    <InteractiveSurface
      accessibilityHint="Opens why this signal matters and how to check it"
      accessibilityLabel={`Signal ${number}: ${finding.observedPattern}`}
      accessibilityRole="link"
      focusStyle={styles.annotationTargetFocused}
      hoverStyle={styles.annotationTargetHovered}
      onPress={() => openFinding(finding.id)}
      pressedStyle={styles.pressed}
      style={styles.annotationTarget}
    >
      <View style={styles.annotationNumberVisual}><Text style={styles.annotationNumber}>{number}</Text></View>
      <View accessibilityElementsHidden style={styles.leaderLine} />
      <View accessibilityElementsHidden style={styles.leaderDot} />
    </InteractiveSurface>
  );
}

function openFinding(id: AnalysisFinding['id']) {
  router.push({ pathname: '/check/finding/[id]', params: { id } });
}

function EmptyAnalysis() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} testID="empty-analysis-overview">
      <StatusBar style="light" />
      <View style={styles.pageFrame}>
        <View style={styles.contentFrame}>
          <View style={styles.emptyState}>
            <Ionicons color={paleBlue} name="scan-outline" size={34} />
            <Text style={styles.emptyKicker}>Analysis · session only</Text>
            <Text accessibilityRole="header" style={styles.emptyTitle}>No analysis is available.</Text>
            <Text style={styles.emptyBody}>Results are transient. Run the local check again to rebuild the marked posting.</Text>
            <InteractiveSurface
              accessibilityRole="link"
              focusStyle={styles.footerPrimaryFocused}
              hoverStyle={styles.footerPrimaryHovered}
              onPress={() => router.replace('/check')}
              pressedStyle={styles.pressed}
              style={styles.emptyButton}
            >
              <Text style={styles.footerPrimaryText}>Run a new check</Text>
            </InteractiveSurface>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { minWidth: 0, width: '100%', maxWidth: '100%', flex: 1, overflow: 'hidden', backgroundColor: navy },
  pageFrame: { minWidth: 0, width: '100%', maxWidth: '100%', flex: 1, alignItems: 'center', overflow: 'hidden', backgroundColor: navy },
  contentFrame: { minWidth: 0, width: '100%', maxWidth: 760, flex: 1, overflow: 'hidden', backgroundColor: navy },
  pressed: { opacity: 0.7 },
  scrollContent: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, overflow: 'hidden' },
  summaryCard: { overflow: 'hidden', borderWidth: 1, borderColor: sky, borderRadius: 12, backgroundColor: '#0077D4' },
  summaryMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  signalGlyph: { width: 26, height: 26, justifyContent: 'flex-end', gap: 2, marginTop: 3, padding: 4, borderWidth: 1.5, borderColor: '#FFFFFF', borderRadius: 4 },
  signalBarHidden: { height: 4, backgroundColor: 'transparent' },
  signalBar: { height: 4, backgroundColor: '#FFFFFF' },
  summaryCopy: { minWidth: 0, flex: 1 },
  summaryTitle: { color: '#FFFFFF', fontFamily: typography.heading, fontSize: 21, fontWeight: '700', lineHeight: 26, letterSpacing: -0.2 },
  summaryCount: { marginTop: 2, color: 'rgba(255,255,255,.88)', fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  notVerdictRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  notVerdictText: { flex: 1, color: 'rgba(255,255,255,.9)', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  notVerdictStrong: { fontFamily: typography.bodySemiBold },
  sectionRule: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionRuleText: { color: paleBlue, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, letterSpacing: 1.05, textTransform: 'uppercase' },
  ruleLine: { minWidth: 12, height: 1, flex: 1, backgroundColor: 'rgba(168,211,242,.32)' },
  sectionRuleCount: { color: '#7FA6C8', fontFamily: typography.mono, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  postingCard: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(168,211,242,.28)', borderRadius: 12, backgroundColor: navyRaised, shadowColor: sky, shadowOpacity: 0.3, shadowRadius: 1, shadowOffset: { width: 0, height: 0 } },
  postingContent: { paddingTop: 20, paddingRight: 16, paddingBottom: 6, paddingLeft: 8 },
  evidenceLayout: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  annotationRail: { width: 44, flexShrink: 0 },
  annotationTarget: { position: 'relative', width: MIN_MARKED_PASSAGE_TARGET, height: MIN_MARKED_PASSAGE_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: 4, zIndex: 3 },
  annotationTargetHovered: { backgroundColor: 'rgba(77,163,228,.15)' },
  annotationTargetFocused: { borderWidth: 2, borderColor: '#FFC24D' },
  annotationNumberVisual: { width: 24, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: sky, borderRadius: 4 },
  annotationNumber: { color: paleBlue, fontFamily: typography.mono, fontSize: 10, lineHeight: 14, letterSpacing: 0.4 },
  leaderLine: { position: 'absolute', right: -3, top: 21, width: 10, height: 1, backgroundColor: sky },
  leaderDot: { position: 'absolute', right: -4, top: 19, width: 4, height: 4, borderRadius: 2, backgroundColor: sky },
  postingCopy: { minWidth: 0, flex: 1, gap: 10, paddingLeft: 3 },
  postingParagraph: { color: '#FFFFFF', fontFamily: typography.body, fontSize: 15, lineHeight: 26 },
  inlineMarkedPassage: { color: '#FFFFFF', backgroundColor: 'rgba(77,163,228,.30)', textDecorationLine: 'underline', textDecorationColor: sky, textDecorationStyle: 'double' },
  urlEvidence: { minHeight: MIN_MARKED_PASSAGE_TARGET, justifyContent: 'center', gap: 2, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: sky, borderRadius: 5, backgroundColor: 'rgba(77,163,228,.16)' },
  urlEvidenceHovered: { backgroundColor: 'rgba(77,163,228,.3)' },
  urlEvidenceFocused: { borderWidth: 2, borderColor: '#FFC24D' },
  urlEvidenceLabel: { color: paleBlue, fontFamily: typography.monoMedium, fontSize: 8, lineHeight: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  urlEvidenceText: { color: '#FFFFFF', fontFamily: typography.mono, fontSize: 10, lineHeight: 16, textDecorationLine: 'underline' },
  absenceNote: { paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: sky, borderRadius: 4 },
  absenceNoteText: { color: paleBlue, fontFamily: typography.mono, fontSize: 9, lineHeight: 14, letterSpacing: 0.7, textTransform: 'uppercase' },
  screenshotNote: { color: paleBlue, fontFamily: typography.body, fontSize: 12, lineHeight: 19 },
  zeroFinding: { gap: 5, paddingVertical: 8 },
  zeroFindingTitle: { color: '#FFFFFF', fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 23 },
  zeroFindingText: { color: paleBlue, fontFamily: typography.body, fontSize: 13, lineHeight: 21 },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  guideMascot: { width: 74, height: 72, flexShrink: 0, borderRadius: 16, backgroundColor: '#FFFFFF' },
  guideCopy: { minWidth: 0, flex: 1 },
  guideText: { color: paleBlue, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  inlineLink: { minHeight: layout.minTouchTarget, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, paddingHorizontal: 4, borderRadius: 4 },
  inlineLinkHovered: { backgroundColor: '#0B4679' },
  inlineLinkFocused: { borderWidth: 2, borderColor: '#FFC24D' },
  inlineLinkText: { color: paleBlue, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19, textDecorationLine: 'underline' },
  footer: { flexShrink: 0, gap: 6, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: 'rgba(168,211,242,.24)', backgroundColor: navyRaised },
  footerPrimary: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, borderRadius: 999, backgroundColor: '#FFFFFF' },
  footerPrimaryHovered: { backgroundColor: '#EDF5FD' },
  footerPrimaryFocused: { borderWidth: 3, borderColor: '#FFC24D' },
  footerPrimaryText: { color: '#005CA8', fontFamily: typography.bodySemiBold, fontSize: 16, lineHeight: 23 },
  footerSecondary: { minHeight: layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, borderRadius: 999 },
  footerSecondaryHovered: { backgroundColor: '#0B4679' },
  footerSecondaryFocused: { borderWidth: 2, borderColor: '#FFC24D' },
  footerSecondaryText: { color: paleBlue, fontFamily: typography.bodyMedium, fontSize: 15, lineHeight: 22 },
  emptyState: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', gap: 12, padding: 24 },
  emptyKicker: { color: paleBlue, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  emptyTitle: { color: '#FFFFFF', fontFamily: typography.heading, fontSize: 32, fontWeight: '700', lineHeight: 38 },
  emptyBody: { maxWidth: 520, color: paleBlue, fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  emptyButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 24, borderRadius: 999, backgroundColor: '#FFFFFF' },
});
