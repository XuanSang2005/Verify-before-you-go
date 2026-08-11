import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, type ImageSourcePropType } from 'react-native';
import type { AnalyseOfferResponse } from '@vbyg/contracts';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import type { AnalysePreviewDraft, PreviewDwell } from './preview-analysis';
import { getDraftInputKinds, type OfferDraft } from './model';
import { OfferPreviewExperience } from './OfferPreviewExperience';
import { useOfferDraft } from './OfferDraftContext';
import { usePreviewReducedMotion } from './use-preview-reduced-motion';

export function OfferPreviewScreen() {
  const { draft, recentSaveNotice, setAnalysis } = useOfferDraft();
  const reduceMotion = usePreviewReducedMotion();

  return (
    <OfferPreviewRoute
      draft={draft}
      mascotSource={require('../../../assets/mascots/screen03-analysis.jpg')}
      onAnalysisComplete={(analysis) => {
        setAnalysis(analysis);
        router.replace('/check/result');
      }}
      onAnalysisStart={() => setAnalysis(undefined)}
      onEdit={() => router.replace('/check')}
      onReturnToCheck={() => router.replace('/check')}
      recentSaveNotice={recentSaveNotice}
      reduceMotion={reduceMotion}
    />
  );
}

export function OfferPreviewRoute({
  analyseDraft,
  draft,
  dwell,
  mascotSource,
  onAnalysisComplete,
  onAnalysisStart,
  onEdit,
  onReturnToCheck,
  recentSaveNotice,
  reduceMotion,
}: {
  analyseDraft?: AnalysePreviewDraft;
  draft: OfferDraft;
  dwell?: PreviewDwell;
  mascotSource: ImageSourcePropType;
  onAnalysisComplete: (analysis: AnalyseOfferResponse) => void;
  onAnalysisStart?: () => void;
  onEdit: () => void;
  onReturnToCheck: () => void;
  recentSaveNotice?: string;
  reduceMotion: boolean;
}) {
  const inputKinds = getDraftInputKinds(draft);

  if (!inputKinds.length) {
    return (
      <PrototypeTabScreen contentStyle={styles.emptyContent} testID="empty-posting-preview">
        <StatusBar style="dark" />
        <Text style={styles.kicker}>CHECK · PREVIEW UNAVAILABLE</Text>
        <Text accessibilityRole="header" style={styles.title}>No draft is available.</Text>
        <Text style={styles.lede}>Offer content is not stored in the URL or browser history. Add the posting again to create a local preview.</Text>
        <InteractiveSurface
          accessibilityLabel="Return to Check"
          accessibilityRole="button"
          focusStyle={styles.returnFocused}
          hoverStyle={styles.returnHovered}
          onPress={onReturnToCheck}
          pressedStyle={styles.returnPressed}
          style={styles.returnControl}
          testID="preview-empty-return"
        >
          <Text style={styles.returnControlText}>Return to Check</Text>
        </InteractiveSurface>
      </PrototypeTabScreen>
    );
  }

  return (
    <PrototypeTabScreen contentStyle={styles.previewContent} testID="posting-preview">
      <StatusBar style="dark" />
      <OfferPreviewExperience
        analyseDraft={analyseDraft}
        draft={draft}
        dwell={dwell}
        mascotSource={mascotSource}
        onAnalysisComplete={onAnalysisComplete}
        onAnalysisStart={onAnalysisStart}
        onEdit={onEdit}
        recentSaveNotice={recentSaveNotice}
        reduceMotion={reduceMotion}
      />
    </PrototypeTabScreen>
  );
}

const styles = {
  previewContent: {
    gap: 0,
    paddingTop: 12,
  },
  emptyContent: {
    gap: 12,
    paddingTop: 12,
  },
  kicker: {
    color: colors.blue,
    fontFamily: typography.monoMedium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.32,
  },
  title: {
    color: colors.navy,
    fontFamily: typography.heading,
    fontSize: 25,
    fontWeight: '700' as const,
    lineHeight: 31,
  },
  lede: {
    maxWidth: 520,
    color: colors.body,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 22,
  },
  returnControl: {
    minHeight: 48,
    alignSelf: 'flex-start' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  returnControlText: {
    color: colors.paper,
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  returnHovered: { backgroundColor: colors.brightBlue },
  returnFocused: { borderWidth: 3, borderColor: colors.navy },
  returnPressed: { opacity: 0.72 },
};
