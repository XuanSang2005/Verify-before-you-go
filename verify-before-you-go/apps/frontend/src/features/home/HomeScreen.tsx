import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import {
  CompactActionCard,
  CompactFeatureStrip,
  PrototypeTabScreen,
} from '@/components/prototype/PrototypeShell';
import { colors, layout, typography } from '@/theme';

import { homeActionCards, homeUtilityLinks, primaryHomeAction } from './home-content';

const homeMascot = require('../../../assets/mascots/home-support-v3.png');

export function HomeScreen() {
  const go = (href: string) => router.push(href as Href);

  return (
    <PrototypeTabScreen testID="homepage">
      <StatusBar style="dark" />
      <Text style={styles.kicker}>Your evidence-first recruitment companion</Text>
      <Text accessibilityRole="header" style={styles.title}>Your next safer step.</Text>
      <View accessibilityElementsHidden style={styles.rainbowRule}>
        <View style={[styles.rainbowSegment, styles.rainbowYellow]} />
        <View style={[styles.rainbowSegment, styles.rainbowGreen]} />
        <View style={[styles.rainbowSegment, styles.rainbowBlue]} />
        <View style={[styles.rainbowSegment, styles.rainbowPurple]} />
      </View>
      <Text style={styles.lede}>Check an offer, follow reviewed updates or practise one verification skill.</Text>

      <View accessibilityLabel="Pause, check, decide" style={[styles.mascotStage, webStageGradient]}>
        <View accessibilityElementsHidden style={styles.stageRing} />
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={homeMascot}
          style={styles.mascot}
        />
        <Text style={styles.stageCopy}>Pause · Check · Decide</Text>
      </View>

      <InteractiveSurface
        accessibilityLabel={primaryHomeAction.accessibilityLabel}
        accessibilityRole="link"
        focusStyle={styles.primaryFocused}
        hoverStyle={styles.primaryHovered}
        onPress={() => go(primaryHomeAction.href)}
        pressedStyle={styles.pressed}
        style={[styles.primaryAction, webCtaGradient, webCtaShadow]}
      >
        <View style={styles.primaryIcon}><Ionicons color={colors.amber} name="shield-checkmark-outline" size={22} /></View>
        <View style={styles.primaryCopy}>
          <Text style={styles.primaryTitle}>{primaryHomeAction.title}</Text>
          <Text style={styles.primaryDescription}>{primaryHomeAction.description}</Text>
        </View>
        <Ionicons color={colors.paleBlue} name="arrow-forward" size={19} />
      </InteractiveSurface>

      <View style={styles.actionGrid}>
        {homeActionCards.map((item) => (
          <CompactActionCard
            description={item.description}
            icon={item.icon}
            key={item.href}
            onPress={() => go(item.href)}
            title={item.title}
          />
        ))}
      </View>

      <CompactFeatureStrip
        description="Check before paying or sharing ID."
        metadata="Synthetic demo · 03 Aug"
        onPress={() => go('/news')}
        title="Today’s recruitment brief"
      />
      <CompactFeatureStrip
        description="Can a polished certificate prove it’s genuine?"
        metadata="Synthetic demo · Question 2 of 5"
        onPress={() => go('/quiz')}
        title="Quick practice"
        tone="purple"
      />

      <View accessibilityLabel="More options" style={styles.utilityGroup}>
        {homeUtilityLinks.map((item) => (
          <InteractiveSurface
            accessibilityLabel={`${item.title}. ${item.description}`}
            accessibilityRole="link"
            focusStyle={styles.utilityFocused}
            hoverStyle={styles.utilityHovered}
            key={item.href}
            onPress={() => go(item.href)}
            pressedStyle={styles.pressed}
            style={styles.utilityRow}
          >
            <Ionicons color={colors.blue} name={item.icon} size={18} />
            <View style={styles.utilityCopy}>
              <Text style={styles.utilityTitle}>{item.title}</Text>
              <Text style={styles.utilityDescription}>{item.description}</Text>
            </View>
          </InteractiveSurface>
        ))}
        <View
          accessibilityLabel="Evidence, not verdict. This app shows observed signals and independent checks. It does not decide whether an offer is safe."
          style={styles.trustRow}
        >
          <Ionicons color={colors.amber} name="compass-outline" size={18} />
          <Text style={styles.trustText}>
            <Text style={styles.trustStrong}>Evidence, not verdict. </Text>
            Observed signals support your checks; they do not decide whether an offer is safe.
          </Text>
        </View>
      </View>
    </PrototypeTabScreen>
  );
}

const webStageGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(115deg,#EFF9FF 0%,#F8F4FF 55%,#FFF9E9 100%)' },
  default: {},
}) as ViewStyle;

const webCtaGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#00224A 0%,#00477E 72%,#175785 100%)' },
  default: {},
}) as ViewStyle;

const webCtaShadow = Platform.select({
  web: { boxShadow: '0 10px 22px rgba(0,34,74,.22)' },
  default: {
    shadowColor: '#00224A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
}) as ViewStyle;

const styles = StyleSheet.create({
  kicker: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.05, textTransform: 'uppercase' },
  title: { color: colors.blue, fontFamily: typography.heading, fontSize: 29, fontWeight: '700', lineHeight: 34, letterSpacing: -0.45 },
  rainbowRule: { width: 56, height: 3, flexDirection: 'row', overflow: 'hidden', borderRadius: 999 },
  rainbowSegment: { flex: 1 },
  rainbowYellow: { backgroundColor: '#FFC24D' },
  rainbowGreen: { backgroundColor: '#8ED97F' },
  rainbowBlue: { backgroundColor: '#3FB6E8' },
  rainbowPurple: { backgroundColor: '#A855F7' },
  lede: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  mascotStage: { position: 'relative', minHeight: 106, overflow: 'hidden', borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 16, backgroundColor: '#F7FAFD' },
  stageRing: { position: 'absolute', top: -100, right: 40, width: 150, height: 150, borderWidth: 26, borderColor: 'rgba(77,163,228,.05)', borderRadius: 75 },
  mascot: { position: 'absolute', bottom: -15, left: 3, width: 165, height: 123 },
  stageCopy: { position: 'absolute', top: 37, left: 177, width: 127, color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 17, letterSpacing: 0.8, textAlign: 'center', textTransform: 'uppercase' },
  primaryAction: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderWidth: 1, borderColor: '#164A77', borderRadius: 15, backgroundColor: colors.navy },
  primaryHovered: { borderColor: colors.sky, backgroundColor: colors.navyRaised },
  primaryFocused: { borderWidth: 3, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
  primaryIcon: { width: 43, height: 43, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(168,211,242,.35)', borderRadius: 12, backgroundColor: 'rgba(255,255,255,.08)' },
  primaryCopy: { minWidth: 0, flex: 1 },
  primaryTitle: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 16, lineHeight: 21 },
  primaryDescription: { marginTop: 4, color: '#D6E9FA', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 },
  utilityGroup: { overflow: 'hidden', marginTop: 4, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  utilityRow: { minHeight: layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#E9EDF1' },
  utilityHovered: { backgroundColor: colors.ice },
  utilityFocused: { borderWidth: 2, borderColor: colors.blue },
  utilityCopy: { minWidth: 0, flex: 1 },
  utilityTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  utilityDescription: { color: colors.quiet, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  trustRow: { minHeight: 56, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, backgroundColor: colors.navy },
  trustText: { minWidth: 0, flex: 1, color: '#D6E9FA', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  trustStrong: { color: colors.paper, fontFamily: typography.bodySemiBold },
});
