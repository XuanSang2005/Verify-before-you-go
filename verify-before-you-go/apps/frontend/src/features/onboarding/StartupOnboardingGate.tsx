import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ElementRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { verticalScrollViewProps } from '@/components/vertical-scroll-props';
import { colors, typography } from '@/theme';

import { STARTUP_ONBOARDING_CARDS } from './onboarding-content';
import {
  STARTUP_ONBOARDING_CARD_ONE_IMAGE,
  STARTUP_ONBOARDING_CARD_THREE_IMAGE,
  STARTUP_ONBOARDING_CARD_TWO_IMAGE,
} from './onboarding-image-data';

const onboardingImages: readonly ImageSourcePropType[] = [
  { uri: STARTUP_ONBOARDING_CARD_ONE_IMAGE },
  { uri: STARTUP_ONBOARDING_CARD_TWO_IMAGE },
  { uri: STARTUP_ONBOARDING_CARD_THREE_IMAGE },
];

const webOverlayPosition = Platform.select({
  web: { position: 'fixed' },
  default: { position: 'absolute' },
}) as ViewStyle;

const webPhoneFrame = Platform.select({
  web: {
    boxShadow: '0 1px 2px rgba(34,30,31,.06), 0 20px 54px -30px rgba(0,34,74,.34)',
  },
  default: {},
}) as ViewStyle;

const webPrimaryGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

export function StartupOnboardingGate({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [cardIndex, setCardIndex] = useState(0);
  const headingRef = useRef<ElementRef<typeof Text>>(null);
  const card = STARTUP_ONBOARDING_CARDS[cardIndex];
  const lastCard = cardIndex === STARTUP_ONBOARDING_CARDS.length - 1;

  useEffect(() => {
    if (!visible) return;

    const announce = () => {
      if (Platform.OS === 'web') {
        (headingRef.current as unknown as { focus?: () => void } | null)?.focus?.();
      } else {
        AccessibilityInfo.announceForAccessibility(`${card.label}. ${card.title}`);
      }
    };
    const frame = requestAnimationFrame(announce);
    return () => cancelAnimationFrame(frame);
  }, [card.label, card.title, visible]);

  const dismiss = () => setVisible(false);
  const advance = () => {
    if (lastCard) {
      dismiss();
      return;
    }
    setCardIndex((current) => current + 1);
  };

  return (
    <View style={styles.root}>
      <View
        accessibilityElementsHidden={visible}
        aria-hidden={visible}
        importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}
        style={[styles.application, visible && styles.applicationBlocked]}
      >
        {children}
      </View>

      {visible ? (
        <SafeAreaView
          accessibilityViewIsModal
          edges={['top', 'bottom']}
          style={[styles.overlay, webOverlayPosition]}
          testID="startup-onboarding"
        >
          <StatusBar style="dark" />
          <View style={[styles.phone, webPhoneFrame]}>
            <View style={styles.topBar}>
              <Text style={styles.brand}>Verify before you go</Text>
              <InteractiveSurface
                accessibilityLabel="Skip onboarding and open the app"
                accessibilityRole="button"
                focusStyle={styles.controlFocused}
                onPress={dismiss}
                pressedStyle={styles.controlPressed}
                style={styles.skipButton}
              >
                <Text style={styles.skipLabel}>Skip</Text>
              </InteractiveSurface>
            </View>

            <ScrollView
              {...verticalScrollViewProps}
              contentContainerStyle={styles.scrollContent}
              key={card.id}
              showsVerticalScrollIndicator={false}
              testID="startup-onboarding-scroll"
            >
              <View style={styles.illustrationCard}>
                <View style={styles.rainbowRule}>
                  <View style={[styles.rainbowSegment, styles.yellow]} />
                  <View style={[styles.rainbowSegment, styles.green]} />
                  <View style={[styles.rainbowSegment, styles.blue]} />
                  <View style={[styles.rainbowSegment, styles.purple]} />
                </View>
                <Image
                  accessibilityIgnoresInvertColors
                  accessible={false}
                  resizeMode="contain"
                  source={onboardingImages[cardIndex]}
                  style={styles.illustration}
                  testID={`startup-onboarding-image-${cardIndex + 1}`}
                />
              </View>

              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text
                accessibilityRole="header"
                aria-level={1}
                ref={headingRef}
                style={styles.title}
                tabIndex={-1}
                testID="startup-onboarding-heading"
              >
                {card.title}
              </Text>
              <Text style={styles.body}>{card.body}</Text>

              {'callout' in card ? (
                <View style={styles.callout}>
                  <Ionicons color={colors.blue} name="cloud-offline-outline" size={19} />
                  <Text style={styles.calloutText}>{card.callout}</Text>
                </View>
              ) : (
                <View style={styles.divider} />
              )}

              <View style={styles.spacer} />
              <View accessibilityLabel={`${cardIndex + 1} of ${STARTUP_ONBOARDING_CARDS.length}`} style={styles.progress}>
                {STARTUP_ONBOARDING_CARDS.map((item, index) => (
                  <View
                    key={item.id}
                    style={[styles.progressSegment, index === cardIndex && styles.progressSegmentActive]}
                  />
                ))}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <InteractiveSurface
                accessibilityLabel={lastCard ? 'Start using Verify Before You Go' : `Next onboarding card, ${cardIndex + 2} of ${STARTUP_ONBOARDING_CARDS.length}`}
                accessibilityRole="button"
                focusStyle={styles.primaryFocused}
                onPress={advance}
                pressedStyle={styles.primaryPressed}
                style={[styles.primaryButton, webPrimaryGradient]}
              >
                <Text style={styles.primaryLabel}>{lastCard ? 'Start' : 'Next'}</Text>
              </InteractiveSurface>
              <Text style={styles.anonymousNote}>Anonymous by default. No passport, no ID.</Text>
            </View>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    flex: 1,
    backgroundColor: colors.canvas,
  },
  application: {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    flex: 1,
  },
  applicationBlocked: { pointerEvents: 'none' },
  overlay: {
    zIndex: 1000,
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  phone: {
    minWidth: 0,
    width: '100%',
    maxWidth: 390,
    height: '100%',
    maxHeight: 844,
    overflow: 'hidden',
    backgroundColor: colors.paper,
  },
  topBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  brand: {
    color: '#8C8788',
    fontFamily: typography.mono,
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
  },
  skipButton: {
    minWidth: 56,
    minHeight: 48,
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  skipLabel: {
    color: colors.blue,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    lineHeight: 20,
  },
  scrollContent: {
    minWidth: 0,
    width: '100%',
    flexGrow: 1,
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  illustrationCard: {
    width: 268,
    height: 196,
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: colors.paper,
  },
  rainbowRule: {
    height: 3,
    flexDirection: 'row',
  },
  rainbowSegment: { flex: 1 },
  yellow: { backgroundColor: colors.amber },
  green: { backgroundColor: '#8ED97F' },
  blue: { backgroundColor: '#3FB6E8' },
  purple: { backgroundColor: '#A855F7' },
  illustration: {
    width: '100%',
    height: 176,
    marginVertical: 8,
  },
  cardLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.paleBlue,
    borderRadius: 4,
    color: colors.blue,
    fontFamily: typography.mono,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontFamily: typography.heading,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.68,
    outlineColor: 'transparent',
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  body: {
    color: colors.body,
    fontFamily: typography.body,
    fontSize: 17,
    lineHeight: 27,
  },
  divider: {
    height: 1,
    marginVertical: 4,
    backgroundColor: colors.line,
  },
  callout: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.canvas,
  },
  calloutText: {
    color: colors.body,
    fontFamily: typography.body,
    fontSize: 15,
    lineHeight: 24,
  },
  spacer: { flex: 1, minHeight: 4 },
  progress: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  progressSegment: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6E9FA',
  },
  progressSegmentActive: { backgroundColor: colors.brightBlue },
  footer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: colors.paper,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: colors.brightBlue,
  },
  primaryLabel: {
    color: colors.paper,
    fontFamily: typography.bodySemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  anonymousNote: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  controlFocused: {
    outlineColor: colors.focus,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  controlPressed: { opacity: 0.68 },
  primaryFocused: {
    outlineColor: colors.paper,
    outlineOffset: -4,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  primaryPressed: { opacity: 0.84 },
});
