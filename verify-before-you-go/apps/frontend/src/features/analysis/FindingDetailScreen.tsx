import { Ionicons } from '@expo/vector-icons';
import type { AnalysisFinding, AnalysisFindingId } from '@vbyg/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
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
import { colors, layout, typography } from '@/theme';

import { orderFindingsForPresentation } from './finding-order';

const webGridTexture = Platform.select({
  web: {
    backgroundImage:
      'linear-gradient(rgba(168,211,242,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(168,211,242,.09) 1px,transparent 1px)',
    backgroundSize: '24px 24px',
  },
  default: {},
}) as ViewStyle;

type ReviewState = 'checked' | 'doubts';

const competencies: Record<AnalysisFindingId, { label: 'Verify' | 'Evaluate' | 'Reflect' | 'Access' | 'Act'; description: string }> = {
  'urgency-pressure': { label: 'Reflect', description: 'Pausing before pressure controls the next step.' },
  'identity-document-request': { label: 'Act', description: 'Choosing a next step that protects your documents.' },
  'upfront-payment-request': { label: 'Evaluate', description: 'Testing whether a demand belongs in legitimate hiring.' },
  'off-platform-contact': { label: 'Verify', description: 'Checking the recruiter through an independent channel.' },
  'missing-employer-identity': { label: 'Access', description: 'Finding the official source that names the employer.' },
  'unverifiable-licence-claim': { label: 'Verify', description: 'Comparing a claim with the issuing authority.' },
  'shortened-link': { label: 'Access', description: 'Opening information through a source you control.' },
  'unsupported-salary-claim': { label: 'Evaluate', description: 'Weighing how a message is built to persuade you.' },
  'discourages-independent-contact': { label: 'Act', description: 'Choosing an independent contact route you control.' },
};

export function FindingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { analysis, draft } = useOfferDraft();
  const [reviewSelection, setReviewSelection] = useState<{ findingId: string; state: ReviewState }>();
  const displayFindings = orderFindingsForPresentation(analysis?.findings ?? []);
  const findingIndex = displayFindings.findIndex((finding) => finding.id === id);
  const finding = findingIndex >= 0 ? displayFindings[findingIndex] : undefined;

  if (!analysis || !finding) return <EmptyFinding />;

  const reviewState = reviewSelection?.findingId === finding.id ? reviewSelection.state : undefined;
  const total = displayFindings.length;
  const previous = displayFindings[findingIndex - 1];
  const next = displayFindings[findingIndex + 1];
  const navigateTo = (findingId: string) => router.replace({ pathname: '/check/finding/[id]', params: { id: findingId } });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} testID="finding-detail">
      <StatusBar style="dark" />
      <View style={styles.pageFrame}>
        <View style={styles.contentFrame}>
          <View style={styles.stage}>
          <EvidenceBackdrop finding={finding} findingIndex={findingIndex} postingText={draft.text} />
          <View style={styles.scrim} />
          <View accessibilityViewIsModal style={styles.sheet}>
            <Image
              accessibilityIgnoresInvertColors
              accessible={false}
              resizeMode="contain"
              source={require('../../../assets/mascots/welcome-wave.png')}
              style={styles.sheetMascot}
            />
            <View style={styles.handleWrap}>
              <View style={styles.handle}>
                <View style={[styles.handleSegment, styles.handleYellow]} />
                <View style={[styles.handleSegment, styles.handleGreen]} />
                <View style={[styles.handleSegment, styles.handleBlue]} />
                <View style={[styles.handleSegment, styles.handlePurple]} />
              </View>
            </View>
            <View style={styles.sheetHeader}>
              <Text numberOfLines={1} style={styles.sheetEyebrow}>What we noticed</Text>
              <InteractiveSurface
                accessibilityLabel="Close finding"
                accessibilityRole="link"
                focusStyle={styles.closeFocused}
                hoverStyle={styles.closeHovered}
                onPress={() => router.replace('/check/result')}
                pressedStyle={styles.pressed}
                style={styles.closeButton}
              >
                <Ionicons color="#5E5859" name="close" size={22} />
              </InteractiveSurface>
            </View>

            <ScrollView
              {...verticalScrollViewProps}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <DetailSection label="What we saw">
                <View style={[styles.evidenceQuote, webGridTexture]}>
                  <Text selectable style={styles.evidenceQuoteText}>
                    {finding.evidence.kind === 'passage' ? finding.evidence.text : finding.evidence.description}
                  </Text>
                </View>
              </DetailSection>

              <DetailSection label="Why it matters">
                <Text style={styles.bodyText}>{finding.explanation}</Text>
              </DetailSection>

              <DetailSection label="What remains unknown">
                <View style={styles.list}>
                  {finding.unknownInformation.map((item, index) => (
                    <View key={`${index}-${item}`} style={styles.listItem}>
                      <Text style={styles.listNumber}>{String(index + 1).padStart(2, '0')}</Text>
                      <Text style={styles.listText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </DetailSection>

              <DetailSection label="How to check it yourself">
                <View style={styles.list}>
                  {finding.verificationSteps.map((step, index) => (
                    <View key={`${index}-${step}`} style={styles.listItem}>
                      <Text style={styles.listNumber}>{String(index + 1).padStart(2, '0')}</Text>
                      <Text style={styles.listText}>{step}</Text>
                    </View>
                  ))}
                </View>
              </DetailSection>

              <Competency findingId={finding.id} />
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.reviewRow}>
                <InteractiveSurface
                  accessibilityLabel="Mark this signal as checked"
                  accessibilityRole="button"
                  accessibilityState={{ selected: reviewState === 'checked' }}
                  focusStyle={styles.reviewFocused}
                  hoverStyle={styles.reviewHovered}
                  onPress={() => setReviewSelection(
                    reviewState === 'checked' ? undefined : { findingId: finding.id, state: 'checked' },
                  )}
                  pressedStyle={styles.pressed}
                  style={[styles.checkedButton, reviewState === 'checked' && styles.checkedButtonActive]}
                >
                  <Ionicons color={reviewState === 'checked' ? '#FFFFFF' : '#221E1F'} name="checkmark" size={17} />
                  <Text style={[styles.checkedButtonText, reviewState === 'checked' && styles.checkedButtonTextActive]}>Mark as checked</Text>
                </InteractiveSurface>
                <InteractiveSurface
                  accessibilityLabel="I still have doubts about this signal"
                  accessibilityRole="button"
                  accessibilityState={{ selected: reviewState === 'doubts' }}
                  focusStyle={styles.doubtsFocused}
                  hoverStyle={styles.doubtsHovered}
                  onPress={() => setReviewSelection(
                    reviewState === 'doubts' ? undefined : { findingId: finding.id, state: 'doubts' },
                  )}
                  pressedStyle={styles.pressed}
                  style={[styles.doubtsButton, reviewState === 'doubts' && styles.doubtsButtonActive]}
                >
                  <Text style={[styles.doubtsButtonText, reviewState === 'doubts' && styles.doubtsButtonTextActive]}>I still have doubts</Text>
                </InteractiveSurface>
              </View>
              <View style={styles.paginationRow}>
                <Text style={styles.positionLabel}>Signal {String(findingIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</Text>
                <View style={styles.paginationSpacer} />
                <InteractiveSurface
                  accessibilityLabel="Previous signal"
                  accessibilityRole="link"
                  disabled={!previous}
                  disabledStyle={styles.paginationDisabled}
                  focusStyle={styles.paginationFocused}
                  hoverStyle={styles.paginationHovered}
                  onPress={() => previous && navigateTo(previous.id)}
                  pressedStyle={styles.pressed}
                  style={styles.paginationButton}
                >
                  <Ionicons color="#3D3839" name="chevron-back" size={20} />
                </InteractiveSurface>
                <InteractiveSurface
                  accessibilityLabel="Next signal"
                  accessibilityRole="link"
                  disabled={!next}
                  disabledStyle={styles.paginationDisabled}
                  focusStyle={styles.paginationFocused}
                  hoverStyle={styles.paginationHovered}
                  onPress={() => next && navigateTo(next.id)}
                  pressedStyle={styles.pressed}
                  style={styles.paginationButton}
                >
                  <Ionicons color="#3D3839" name="chevron-forward" size={20} />
                </InteractiveSurface>
              </View>
            </View>
          </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function EvidenceBackdrop({
  finding,
  findingIndex,
  postingText,
}: {
  finding: AnalysisFinding;
  findingIndex: number;
  postingText: string;
}) {
  const evidence = finding.evidence.kind === 'passage' ? finding.evidence.text : finding.evidence.description;
  const context = getEvidenceContext(postingText, finding);
  return (
    <View style={[styles.backdropCard, webGridTexture]}>
      <View style={styles.backdropMarker}><Text style={styles.backdropMarkerText}>{String(findingIndex + 1).padStart(2, '0')}</Text></View>
      <View style={styles.backdropLeader} />
      <Text numberOfLines={2} style={styles.backdropContext}>{context.before}</Text>
      <Text numberOfLines={3} style={styles.backdropEvidence}>{evidence}</Text>
      <Text numberOfLines={2} style={styles.backdropContext}>{context.after}</Text>
    </View>
  );
}

function getEvidenceContext(postingText: string, finding: AnalysisFinding): { before: string; after: string } {
  if (!postingText || finding.evidence.kind !== 'passage' || finding.evidence.source !== 'postingText') return { before: '', after: '' };
  return {
    before: postingText.slice(Math.max(0, finding.evidence.start - 70), finding.evidence.start).trim(),
    after: postingText.slice(finding.evidence.end, Math.min(postingText.length, finding.evidence.end + 70)).trim(),
  };
}

function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Competency({ findingId }: { findingId: AnalysisFindingId }) {
  const competency = competencies[findingId];
  return (
    <View style={styles.competencySection}>
      <View style={styles.competencyChip}>
        <View style={styles.competencyDot} />
        <Text style={styles.competencyLabel}>{competency.label}</Text>
      </View>
      <Text style={styles.competencyDescription}>{competency.description}</Text>
    </View>
  );
}

function EmptyFinding() {
  return (
    <SafeAreaView edges={['top']} style={styles.emptySafeArea} testID="empty-finding-detail">
      <StatusBar style="dark" />
      <View style={styles.emptyPageFrame}>
        <View style={styles.emptyContentFrame}>
          <View style={styles.emptyState}>
            <Ionicons color="#005CA8" name="document-text-outline" size={34} />
            <Text style={styles.emptyKicker}>Finding detail · session only</Text>
            <Text accessibilityRole="header" style={styles.emptyTitle}>This finding is not available.</Text>
            <Text style={styles.emptyBody}>Finding details require the transient analysis from this app session.</Text>
            <InteractiveSurface
              accessibilityRole="link"
              focusStyle={styles.emptyButtonFocused}
              hoverStyle={styles.emptyButtonHovered}
              onPress={() => router.replace('/check')}
              pressedStyle={styles.pressed}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>Run a new check</Text>
            </InteractiveSurface>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { minWidth: 0, width: '100%', maxWidth: '100%', flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  pageFrame: { minWidth: 0, width: '100%', maxWidth: '100%', flex: 1, alignItems: 'center', overflow: 'hidden', backgroundColor: colors.canvas },
  contentFrame: { minWidth: 0, width: '100%', maxWidth: 760, flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  pressed: { opacity: 0.7 },
  stage: { minHeight: 0, flex: 1, position: 'relative', overflow: 'hidden' },
  backdropCard: { marginHorizontal: 20, paddingTop: 16, paddingRight: 16, paddingBottom: 18, paddingLeft: 56, borderWidth: 1, borderColor: 'rgba(168,211,242,.24)', borderRadius: 12, backgroundColor: '#00305C' },
  backdropMarker: { position: 'absolute', left: 10, top: 44, width: 24, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4DA3E4', borderRadius: 4 },
  backdropMarkerText: { color: '#A8D3F2', fontFamily: typography.mono, fontSize: 10, lineHeight: 14 },
  backdropLeader: { position: 'absolute', left: 36, top: 54, width: 16, height: 1, backgroundColor: '#4DA3E4' },
  backdropContext: { color: '#FFFFFF', fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  backdropEvidence: { alignSelf: 'flex-start', marginVertical: 10, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: '#4DA3E4', borderRadius: 4, backgroundColor: 'rgba(77,163,228,.18)', color: '#FFFFFF', fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,34,74,.38)', zIndex: 1, pointerEvents: 'none' },
  sheetMascot: { position: 'absolute', left: 18, top: -34, width: 36, height: 46, zIndex: 4, shadowColor: '#00224A', shadowOpacity: 0.12, shadowRadius: 7, shadowOffset: { width: 0, height: 8 } },
  sheet: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 3, height: '88%', overflow: 'visible', borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#FFFFFF', shadowColor: '#00224A', shadowOpacity: 0.34, shadowRadius: 24, shadowOffset: { width: 0, height: -8 } },
  handleWrap: { height: 20, alignItems: 'center', justifyContent: 'flex-end' },
  handle: { width: 36, height: 4, flexDirection: 'row', overflow: 'hidden', borderRadius: 2 },
  handleSegment: { width: 9, height: 4 },
  handleYellow: { backgroundColor: '#FFC24D' },
  handleGreen: { backgroundColor: '#8ED97F' },
  handleBlue: { backgroundColor: '#3FB6E8' },
  handlePurple: { backgroundColor: '#A855F7' },
  sheetHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 10 },
  sheetEyebrow: { minWidth: 0, flex: 1, color: '#5E5859', fontFamily: typography.mono, fontSize: 11, lineHeight: 17, letterSpacing: 0.75, textTransform: 'uppercase' },
  closeButton: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  closeHovered: { backgroundColor: '#F0F2F4' },
  closeFocused: { borderWidth: 2, borderColor: '#005CA8' },
  sheetContent: { gap: 22, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 22 },
  section: { gap: 8 },
  sectionLabel: { color: '#8C8788', fontFamily: typography.mono, fontSize: 11, lineHeight: 18, letterSpacing: 0.85, textTransform: 'uppercase' },
  evidenceQuote: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 4, backgroundColor: '#00305C' },
  evidenceQuoteText: { color: '#FFFFFF', fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 24 },
  bodyText: { color: '#3D3839', fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  list: { gap: 10 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  listNumber: { flexShrink: 0, paddingTop: 3, color: '#005CA8', fontFamily: typography.mono, fontSize: 11, lineHeight: 18 },
  listText: { minWidth: 0, flex: 1, color: '#3D3839', fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  competencySection: { alignItems: 'flex-start', gap: 8 },
  competencyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: '#D6E9FA' },
  competencyDot: { width: 6, height: 6, borderRadius: 1, backgroundColor: '#3FB6E8' },
  competencyLabel: { color: '#005CA8', fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  competencyDescription: { color: '#5E5859', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  footer: { flexShrink: 0, gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#E9EDF1', backgroundColor: '#FFFFFF' },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkedButton: { minHeight: layout.minTouchTarget, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#D8DDE2', borderRadius: 999 },
  checkedButtonActive: { borderColor: '#0077D4', backgroundColor: '#0077D4' },
  checkedButtonText: { color: '#221E1F', fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 21 },
  checkedButtonTextActive: { color: '#FFFFFF' },
  reviewHovered: { borderColor: '#8FC4EC', backgroundColor: '#EDF5FD' },
  reviewFocused: { borderWidth: 2, borderColor: '#005CA8' },
  doubtsButton: { minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: 'transparent', borderRadius: 999 },
  doubtsButtonActive: { borderColor: '#FFC24D', backgroundColor: '#FFF1D6' },
  doubtsButtonText: { color: '#005CA8', fontFamily: typography.bodyMedium, fontSize: 14, lineHeight: 21 },
  doubtsButtonTextActive: { color: '#9B5D00' },
  doubtsHovered: { backgroundColor: '#EDF5FD' },
  doubtsFocused: { borderWidth: 2, borderColor: '#005CA8' },
  paginationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  positionLabel: { color: '#5E5859', fontFamily: typography.mono, fontSize: 11, lineHeight: 17, letterSpacing: 0.75, textTransform: 'uppercase' },
  paginationSpacer: { flex: 1 },
  paginationButton: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D8DDE2', borderRadius: 4 },
  paginationHovered: { borderColor: '#8FC4EC', backgroundColor: '#EDF5FD' },
  paginationFocused: { borderWidth: 2, borderColor: '#005CA8' },
  paginationDisabled: { opacity: 0.35 },
  emptySafeArea: { minWidth: 0, width: '100%', maxWidth: '100%', flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  emptyPageFrame: { minWidth: 0, width: '100%', maxWidth: '100%', flex: 1, alignItems: 'center', overflow: 'hidden' },
  emptyContentFrame: { minWidth: 0, width: '100%', maxWidth: 760, flex: 1, overflow: 'hidden' },
  emptyState: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', gap: 12, padding: 24 },
  emptyKicker: { color: '#005CA8', fontFamily: typography.mono, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  emptyTitle: { color: '#00224A', fontFamily: typography.heading, fontSize: 32, fontWeight: '700', lineHeight: 38 },
  emptyBody: { maxWidth: 520, color: '#3D3839', fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  emptyButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 24, borderRadius: 999, backgroundColor: '#005CA8' },
  emptyButtonHovered: { backgroundColor: '#0077D4' },
  emptyButtonFocused: { borderWidth: 3, borderColor: '#FFC24D' },
  emptyButtonText: { color: '#FFFFFF', fontFamily: typography.bodySemiBold, fontSize: 16, lineHeight: 23 },
});
