import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { colors, typography } from '@/theme';

import {
  chooseScenarioPosting,
  getScenarioChoiceForRadioKey,
  resetScenarioChoice,
  scenarioPostings,
  type ScenarioChoice,
  type ScenarioPosting,
} from './scenario-model';

const ctaGradientColors = [
  '#0077D4',
  '#126FD6',
  '#2864D9',
  '#3E5ADC',
  '#5450DF',
  '#6847E2',
  '#7B3FE4',
] as const;

const cardShadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(34,30,31,.05)' },
  default: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
}) as ViewStyle;

type ScenarioExerciseProps = {
  backIcon?: ReactNode;
  ctaIcon?: ReactNode;
  gridTextureSource: ImageSourcePropType;
  illustrationSource: ImageSourcePropType;
  infoIcon?: ReactNode;
  onBack: () => void;
  onCta: () => void;
  /** Test seam for verifying focus movement without a browser DOM. */
  focusOption?: (choice: Exclude<ScenarioChoice, null>) => void;
  /** Native ignores keyboard handlers; rendered tests can explicitly exercise web behavior. */
  webKeyboardEnabled?: boolean;
};

export function ScenarioExercise({
  backIcon,
  ctaIcon,
  focusOption,
  gridTextureSource,
  illustrationSource,
  infoIcon,
  onBack,
  onCta,
  webKeyboardEnabled = Platform.OS === 'web',
}: ScenarioExerciseProps) {
  const [choice, setChoice] = useState<ScenarioChoice>(null);
  const picked = choice !== null;

  const moveFocus = (nextChoice: Exclude<ScenarioChoice, null>) => {
    if (focusOption) {
      focusOption(nextChoice);
      return;
    }
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      document.getElementById(`scenario-posting-${nextChoice}`)?.focus();
    });
  };

  const selectPosting = (
    nextChoice: Exclude<ScenarioChoice, null>,
    shouldMoveFocus = false,
  ) => {
    setChoice(chooseScenarioPosting(nextChoice));
    if (shouldMoveFocus) moveFocus(nextChoice);
  };

  return (
    <View style={styles.contentFrame}>
      <View style={styles.utilityRow}>
        <InteractiveSurface
          accessibilityLabel="Back to Check"
          accessibilityRole="link"
          focusStyle={styles.utilityFocused}
          hoverStyle={styles.utilityHovered}
          onPress={onBack}
          pressedStyle={styles.controlPressed}
          style={styles.backControl}
          testID="scenario-back"
        >
          {backIcon ?? <Text style={styles.fallbackIcon}>‹</Text>}
        </InteractiveSurface>
        <Text style={styles.scenarioMeta}>Scenario 04 · evaluate</Text>
        <InteractiveSurface
          accessibilityLabel="Reset scenario"
          accessibilityRole="button"
          accessibilityState={{ disabled: !picked }}
          disabled={!picked}
          disabledStyle={styles.resetDisabled}
          focusStyle={styles.utilityFocused}
          hitSlop={6}
          hoverStyle={styles.utilityHovered}
          onPress={() => setChoice(resetScenarioChoice())}
          pressedStyle={styles.controlPressed}
          style={styles.resetControl}
          testID="scenario-reset"
        >
          <Text style={styles.resetText}>Reset</Text>
        </InteractiveSurface>
      </View>

      <View style={[styles.illustrationCard, cardShadow]}>
        <RainbowStrip />
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={illustrationSource}
          style={styles.illustration}
        />
      </View>

      <Text accessibilityRole="header" style={styles.title}>Which one would you trust?</Text>
      <Text style={styles.lede}>Two synthetic postings. Pick the one you would have replied to.</Text>

      <View
        accessibilityLabel="Choose one synthetic posting"
        accessibilityRole="radiogroup"
        style={styles.postingGroup}
        testID="scenario-radio-group"
      >
        {scenarioPostings.map((posting) => (
          <ScenarioPostingCard
            gridTextureSource={gridTextureSource}
            key={posting.id}
            onSelect={selectPosting}
            picked={picked}
            posting={posting}
            selected={choice === posting.id}
            tabbable={choice === null ? posting.id === 'A' : choice === posting.id}
            webKeyboardEnabled={webKeyboardEnabled}
          />
        ))}
      </View>

      {picked ? (
        <View
          accessibilityLiveRegion="polite"
          style={styles.feedbackPanel}
          testID="scenario-feedback"
        >
          <Text style={styles.feedbackMeta}>Result · no score kept</Text>
          <Text style={styles.feedbackTitle}>Both had problems. The polished one was harder to spot.</Text>
          <Text style={styles.feedbackBody}>
            Ad B looks professional, but presentation is not evidence. Its synthetic licence claim is independently checkable, and the demo mismatch matters more than how polished the posting looks.
          </Text>
          <View style={styles.registryNotice}>
            {infoIcon ?? <Text style={styles.fallbackInfoIcon}>i</Text>}
            <Text style={styles.registryNoticeText}>The registry and licence in this exercise are synthetic—not official or live data.</Text>
          </View>
          <View style={styles.skillRow}>
            <View style={styles.skillChip}><RainbowMark /><Text style={styles.skillChipText}>Skill · Verification</Text></View>
            <Text style={styles.skillCopy}>Check a claim against a source you found independently.</Text>
          </View>
        </View>
      ) : null}

      {picked ? (
        <InteractiveSurface
          accessibilityLabel="Practise with your own offer"
          accessibilityRole="link"
          focusStyle={styles.ctaFocused}
          hoverStyle={styles.ctaHovered}
          onPress={onCta}
          pressedStyle={styles.controlPressed}
          style={styles.cta}
          testID="scenario-cta"
        >
          <GradientBands />
          <View style={styles.ctaContent}>
            {ctaIcon ?? <Text style={styles.fallbackCtaIcon}>▱</Text>}
            <Text style={styles.ctaText}>Practise with your own offer</Text>
          </View>
        </InteractiveSurface>
      ) : null}
    </View>
  );
}

function ScenarioPostingCard({
  gridTextureSource,
  onSelect,
  picked,
  posting,
  selected,
  tabbable,
  webKeyboardEnabled,
}: {
  gridTextureSource: ImageSourcePropType;
  onSelect: (choice: Exclude<ScenarioChoice, null>, moveFocus?: boolean) => void;
  picked: boolean;
  posting: ScenarioPosting;
  selected: boolean;
  tabbable: boolean;
  webKeyboardEnabled: boolean;
}) {
  const stateLabel = selected ? 'Selected' : 'Not selected';
  const webKeyboardProps = webKeyboardEnabled
    ? ({
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          const nextChoice = getScenarioChoiceForRadioKey(posting.id, event.key);
          if (!nextChoice) return;
          event.preventDefault();
          onSelect(nextChoice, true);
        },
      } as unknown as Partial<ComponentProps<typeof InteractiveSurface>>)
    : {};

  return (
    <View style={[styles.postingCard, cardShadow]} testID={`scenario-card-${posting.id}`}>
      {selected ? (
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.postingSelectionRing}
        />
      ) : null}

      <InteractiveSurface
        {...webKeyboardProps}
        aria-checked={selected}
        accessibilityLabel={`${posting.title}. ${posting.disclosure}. ${posting.body} ${stateLabel}.`}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        focusStyle={styles.postingRowFocused}
        hoverStyle={styles.postingRowHovered}
        nativeID={`scenario-posting-${posting.id}`}
        onPress={() => onSelect(posting.id)}
        pressedStyle={styles.controlPressed}
        style={styles.postingMainRow}
        tabIndex={tabbable ? 0 : -1}
        testID={`scenario-option-${posting.id}`}
      >
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.postingBadge}
        >
          <Text style={styles.postingBadgeText}>{posting.id}</Text>
        </View>
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.postingCopy}
        >
          <Text style={styles.syntheticLabel}>{posting.disclosure}</Text>
          <Text style={styles.postingBody}>{posting.body}</Text>
        </View>
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.postingState}
        >
          <View style={[styles.radioIndicator, selected && styles.radioIndicatorSelected]}>
            {selected ? <View style={styles.radioIndicatorDot} /> : null}
          </View>
          {selected ? <Text style={styles.selectedText}>Selected</Text> : null}
        </View>
      </InteractiveSurface>

      {picked ? (
        <View style={styles.evidenceSection} testID={`scenario-evidence-${posting.id}`}>
          <ImageBackground
            accessible={false}
            imageStyle={styles.evidenceTexture}
            resizeMode="cover"
            source={gridTextureSource}
            style={styles.evidencePanel}
            testID={`scenario-grid-texture-${posting.id}`}
          >
            <View style={styles.annotationRow}>
              <Text style={styles.annotation}>{posting.evidenceLabel}</Text>
              <Text style={styles.annotationNumber}>{posting.evidenceNumber}</Text>
            </View>
            <Text style={styles.evidenceExplanation}>{posting.evidenceExplanation}</Text>
          </ImageBackground>
        </View>
      ) : null}
    </View>
  );
}

function RainbowStrip() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.rainbowStrip}>
      {['#FFC24D', '#8ED97F', '#3FB6E8', '#A855F7'].map((color) => (
        <View key={color} style={[styles.rainbowSegment, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function RainbowMark() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.rainbowMark}>
      <View style={[styles.rainbowMarkHalf, { backgroundColor: colors.amber }]} />
      <View style={[styles.rainbowMarkHalf, { backgroundColor: colors.purple }]} />
    </View>
  );
}

function GradientBands() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      {ctaGradientColors.map((color, index) => (
        <View
          key={color}
          style={[
            styles.gradientBand,
            {
              backgroundColor: color,
              left: `${(index / ctaGradientColors.length) * 100}%`,
              width: `${100 / ctaGradientColors.length + 0.5}%`,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  contentFrame: { minWidth: 0, width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16 },
  utilityRow: { minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backControl: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12, borderRadius: 22 },
  scenarioMeta: { minWidth: 0, flex: 1, color: colors.muted, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.32, textTransform: 'uppercase' },
  resetControl: { minWidth: 58, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 6, backgroundColor: colors.paper },
  resetText: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.32, textTransform: 'uppercase' },
  resetDisabled: { opacity: 0.42 },
  fallbackIcon: { color: colors.body, fontSize: 28, lineHeight: 28 },
  fallbackInfoIcon: { width: 18, height: 18, color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  fallbackCtaIcon: { color: colors.paper, fontSize: 18, lineHeight: 20 },
  utilityHovered: { backgroundColor: colors.ice },
  utilityFocused: { borderWidth: 2, borderColor: colors.focus },
  controlPressed: { opacity: 0.72 },
  illustrationCard: { width: 280, maxWidth: '100%', alignSelf: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.paper },
  rainbowStrip: { width: '100%', height: 3, flexDirection: 'row' },
  rainbowSegment: { flex: 1 },
  illustration: { width: '100%', height: 178, marginVertical: 8 },
  title: { color: colors.ink, fontFamily: typography.heading, fontSize: 27, fontWeight: '700', lineHeight: 32, letterSpacing: -0.4 },
  lede: { color: colors.muted, fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  postingGroup: { minWidth: 0, width: '100%', flexDirection: 'column', gap: 12 },
  postingCard: { position: 'relative', minWidth: 0, width: '100%', minHeight: 48, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  postingSelectionRing: { position: 'absolute', top: -3, right: -3, bottom: -3, left: -3, borderWidth: 2, borderColor: colors.brightBlue, borderRadius: 15, pointerEvents: 'none' },
  postingMainRow: { minWidth: 0, width: '100%', minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 8 },
  postingRowHovered: { backgroundColor: '#FAFCFE' },
  postingRowFocused: { backgroundColor: colors.ice },
  postingBadge: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.ice },
  postingBadgeText: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 16, lineHeight: 22, letterSpacing: 0.8 },
  postingCopy: { minWidth: 0, flex: 1, gap: 4 },
  syntheticLabel: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  postingBody: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  postingState: { width: 66, minHeight: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  radioIndicator: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.quiet, borderRadius: 11 },
  radioIndicatorSelected: { borderColor: colors.brightBlue },
  radioIndicatorDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brightBlue },
  selectedText: { color: colors.blue, fontFamily: typography.bodyMedium, fontSize: 11, lineHeight: 16 },
  evidenceSection: { minWidth: 0, width: '100%', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E9EDF1' },
  evidencePanel: { minWidth: 0, overflow: 'hidden', gap: 8, padding: 10, borderRadius: 6, backgroundColor: colors.navyRaised },
  evidenceTexture: { opacity: 0.07 },
  annotationRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  annotation: { minWidth: 0, flexShrink: 1, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: colors.sky, borderRadius: 4, backgroundColor: 'rgba(77,163,228,.18)', color: colors.paper, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  annotationNumber: { paddingTop: 2, color: colors.sky, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.1 },
  evidenceExplanation: { color: colors.paleBlue, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  feedbackPanel: { gap: 10, padding: 16, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  feedbackMeta: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.32, textTransform: 'uppercase' },
  feedbackTitle: { color: colors.navy, fontFamily: typography.heading, fontSize: 21, fontWeight: '700', lineHeight: 27, letterSpacing: -0.2 },
  feedbackBody: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  registryNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 2 },
  registryNoticeText: { minWidth: 0, flex: 1, color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  skillRow: { gap: 8, paddingTop: 2 },
  skillChip: { alignSelf: 'flex-start', minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 5, backgroundColor: '#D6E9FA' },
  rainbowMark: { width: 8, height: 8, flexDirection: 'row', overflow: 'hidden', borderRadius: 2 },
  rainbowMarkHalf: { flex: 1 },
  skillChipText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  skillCopy: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  cta: { position: 'relative', minHeight: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.brightBlue },
  ctaContent: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  ctaText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 16, lineHeight: 22 },
  ctaHovered: { opacity: 0.92 },
  ctaFocused: { borderWidth: 2, borderColor: colors.amber },
  gradientBand: { position: 'absolute', top: 0, bottom: 0 },
});
