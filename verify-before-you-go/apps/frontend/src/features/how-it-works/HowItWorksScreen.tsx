import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import { deviceAndServerFacts, howItWorksLinks, howItWorksSteps } from './how-it-works-content';

const primaryLinkStyle = StyleSheet.flatten<ViewStyle>({
  minWidth: 0,
  minHeight: 48,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  paddingHorizontal: 18,
  borderWidth: 2,
  borderColor: colors.brightBlue,
  borderRadius: 999,
  backgroundColor: colors.brightBlue,
});

const secondaryLinkStyle = StyleSheet.flatten<ViewStyle>({
  minWidth: 0,
  minHeight: 48,
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  paddingHorizontal: 12,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 999,
  backgroundColor: colors.paper,
});

const webPrimaryGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

const resolvedPrimaryLinkStyle = StyleSheet.flatten<ViewStyle>([
  primaryLinkStyle,
  webPrimaryGradient,
]);

const webCardShadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(34,30,31,.05)' },
  default: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
}) as ViewStyle;

export function HowItWorksScreen({
  illustrationSource = require('../../../assets/mascots/alerts-guide-screen12.jpg'),
}: {
  illustrationSource?: ImageSourcePropType;
} = {}) {
  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="how-it-works-screen">
      <StatusBar style="dark" />

      <View style={styles.intro}>
        <Text style={styles.kicker}>Evidence-first method · Read any time</Text>
        <Text accessibilityRole="header" style={styles.title}>How it works</Text>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.rainbowRule}>
          <View style={[styles.rainbowSegment, styles.rainbowYellow]} />
          <View style={[styles.rainbowSegment, styles.rainbowGreen]} />
          <View style={[styles.rainbowSegment, styles.rainbowBlue]} />
          <View style={[styles.rainbowSegment, styles.rainbowPurple]} />
        </View>
        <Text style={styles.lede}>Paste an offer, see the observed wording, then verify what matters through a source you found independently.</Text>
      </View>

      <View style={[styles.illustrationCard, webCardShadow]} testID="how-it-works-screen01-illustration">
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.illustrationRainbow}>
          <View style={[styles.rainbowSegment, styles.rainbowYellow]} />
          <View style={[styles.rainbowSegment, styles.rainbowGreen]} />
          <View style={[styles.rainbowSegment, styles.rainbowBlue]} />
          <View style={[styles.rainbowSegment, styles.rainbowPurple]} />
        </View>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={illustrationSource}
          style={styles.illustration}
        />
      </View>

      <View style={styles.methodSection}>
        <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Pause. Check. Decide.</Text>
        {howItWorksSteps.map((step) => (
          <View key={step.id} style={[styles.methodCard, webCardShadow]} testID={`how-it-works-step-${step.id}`}>
            <View style={styles.methodHeadingRow}>
              <Text style={styles.stepNumber}>{step.number}</Text>
              <Text accessibilityRole="header" aria-level={3} style={styles.methodTitle}>{step.title}</Text>
            </View>
            <Text style={styles.bodyCopy}>{step.body}</Text>
            <View style={styles.methodNote}>
              <Ionicons color={colors.blue} name="information-circle-outline" size={18} />
              <Text style={styles.noteCopy}>{step.note}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.verdictPanel}>
        <Ionicons color={colors.amber} name="compass-outline" size={22} />
        <View style={styles.verdictCopy}>
          <Text accessibilityRole="header" aria-level={2} style={styles.verdictTitle}>No scam score. No verdict.</Text>
          <Text style={styles.verdictBody}>Observed signals can guide the next check. They do not prove that an offer is safe, fraudulent or connected to the person or company named.</Text>
        </View>
      </View>

      <View style={styles.dataSection}>
        <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Know what stays where</Text>
        <Text style={styles.sectionLede}>Nothing is published automatically. A report is sent only after you review its privacy preview and choose to submit.</Text>
        <View style={styles.dataCards}>
          {deviceAndServerFacts.map((fact) => (
            <View key={fact.id} style={[styles.dataCard, webCardShadow]} testID={`how-it-works-data-${fact.id}`}>
              <View style={styles.dataHeadingRow}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dataIcon}>
                  <Ionicons color={colors.blue} name={fact.icon} size={19} />
                </View>
                <Text accessibilityRole="header" aria-level={3} style={styles.dataTitle}>{fact.title}</Text>
              </View>
              <Text style={styles.bodyCopy}>{fact.body}</Text>
              <Text style={styles.dataNote}>{fact.note}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.verifyPanel}>
        <Text accessibilityRole="header" aria-level={2} style={styles.verifyTitle}>Independent verification is the next step</Text>
        <Text style={styles.verifyBody}>Start outside the message or link you received. Find the legal employer, issuing authority or official contact separately, then compare the details yourself.</Text>
      </View>

      <View accessibilityLabel="How it works actions" style={styles.actions}>
        <Link asChild href={howItWorksLinks[1].href}>
          <InteractiveSurface
            accessibilityLabel={howItWorksLinks[1].label}
            accessibilityRole="link"
            focusStyle={styles.primaryFocused}
            hoverStyle={styles.primaryHovered}
            pressedStyle={styles.pressed}
            style={resolvedPrimaryLinkStyle}
            testID="how-it-works-check-link"
          >
            <Ionicons color={colors.paper} name={howItWorksLinks[1].icon} size={18} />
            <Text style={styles.primaryLinkText}>{howItWorksLinks[1].label}</Text>
          </InteractiveSurface>
        </Link>
        <View style={styles.secondaryActions}>
          {[howItWorksLinks[0], howItWorksLinks[2]].map((link) => (
            <Link asChild href={link.href} key={link.href}>
              <InteractiveSurface
                accessibilityLabel={link.label}
                accessibilityRole="link"
                focusStyle={styles.secondaryFocused}
                hoverStyle={styles.secondaryHovered}
                pressedStyle={styles.pressed}
                style={secondaryLinkStyle}
                testID={link.href === '/' ? 'how-it-works-home-link' : 'how-it-works-help-link'}
              >
                <Ionicons color={colors.blue} name={link.icon} size={18} />
                <Text style={styles.secondaryLinkText}>{link.label}</Text>
              </InteractiveSurface>
            </Link>
          ))}
        </View>
      </View>
    </PrototypeTabScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { gap: 16, paddingTop: 12, paddingBottom: 112 },
  intro: { minWidth: 0, gap: 9 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.05, textTransform: 'uppercase' },
  title: { color: colors.blue, fontFamily: typography.heading, fontSize: 29, fontWeight: '700', lineHeight: 34, letterSpacing: -0.45 },
  rainbowRule: { width: 56, height: 3, flexDirection: 'row', overflow: 'hidden', borderRadius: 999 },
  rainbowSegment: { flex: 1 },
  rainbowYellow: { backgroundColor: '#FFC24D' },
  rainbowGreen: { backgroundColor: '#8ED97F' },
  rainbowBlue: { backgroundColor: '#3FB6E8' },
  rainbowPurple: { backgroundColor: '#A855F7' },
  lede: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  illustrationCard: { width: '78%', maxWidth: 310, alignSelf: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.paper },
  illustrationRainbow: { height: 3, flexDirection: 'row' },
  illustration: { width: '100%', height: 176, marginVertical: 8 },
  methodSection: { minWidth: 0, gap: 10 },
  sectionTitle: { color: colors.navy, fontFamily: typography.heading, fontSize: 20, fontWeight: '700', lineHeight: 25 },
  sectionLede: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  methodCard: { minWidth: 0, gap: 8, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  methodHeadingRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNumber: { width: 30, color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1 },
  methodTitle: { minWidth: 0, flex: 1, color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  bodyCopy: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  methodNote: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E9EDF1' },
  noteCopy: { minWidth: 0, flex: 1, color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  verdictPanel: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderWidth: 1, borderColor: '#164A77', borderRadius: 14, backgroundColor: colors.navy },
  verdictCopy: { minWidth: 0, flex: 1, gap: 4 },
  verdictTitle: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  verdictBody: { color: '#D6E9FA', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  dataSection: { minWidth: 0, gap: 9 },
  dataCards: { minWidth: 0, gap: 9 },
  dataCard: { minWidth: 0, gap: 8, padding: 14, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  dataHeadingRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  dataIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.paper },
  dataTitle: { minWidth: 0, flex: 1, color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  dataNote: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  verifyPanel: { minWidth: 0, gap: 5, padding: 14, borderLeftWidth: 4, borderLeftColor: colors.sky, backgroundColor: colors.ice },
  verifyTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  verifyBody: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  actions: { minWidth: 0, gap: 10 },
  secondaryActions: { minWidth: 0, flexDirection: 'row', gap: 8 },
  primaryHovered: { borderColor: colors.purple, backgroundColor: colors.purple },
  primaryFocused: { borderColor: colors.navy },
  secondaryHovered: { borderColor: colors.paleBlue, backgroundColor: colors.ice },
  secondaryFocused: { borderWidth: 2, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
  primaryLinkText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  secondaryLinkText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
