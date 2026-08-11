import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '@/theme';

import { InteractiveSurface } from '../InteractiveSurface';
import { verticalScrollViewProps } from '../vertical-scroll-props';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function PrototypeTabScreen({
  children,
  overlay,
  contentStyle,
  scrollResetKey,
  testID,
}: {
  children: ReactNode;
  overlay?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollResetKey?: string | number;
  testID: string;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const previousScrollResetKeyRef = useRef(scrollResetKey);

  useEffect(() => {
    if (Object.is(previousScrollResetKeyRef.current, scrollResetKey)) return;
    previousScrollResetKeyRef.current = scrollResetKey;
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollResetKey]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} testID={testID}>
      <View style={styles.pageFrame}>
        <View style={styles.contentFrame}>
          {overlay}
          <ScrollView
            {...verticalScrollViewProps}
            contentContainerStyle={[styles.scrollContent, contentStyle]}
            keyboardShouldPersistTaps="handled"
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

export function CompactActionCard({
  description,
  icon,
  onPress,
  title,
}: {
  description: string;
  icon: IconName;
  onPress: () => void;
  title: string;
}) {
  return (
    <InteractiveSurface
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="link"
      focusStyle={styles.cardFocused}
      hoverStyle={styles.cardHovered}
      onPress={onPress}
      pressedStyle={styles.controlPressed}
      style={styles.actionCard}
    >
      <View style={styles.actionIcon}><Ionicons color={colors.blue} name={icon} size={16} /></View>
      <View>
        <Text style={styles.actionTitle}>{title}</Text>
      </View>
    </InteractiveSurface>
  );
}

export function CompactFeatureStrip({
  description,
  metadata,
  onPress,
  title,
  tone = 'blue',
}: {
  description: string;
  metadata: string;
  onPress: () => void;
  title: string;
  tone?: 'blue' | 'purple';
}) {
  return (
    <InteractiveSurface
      accessibilityLabel={`${title}. ${description}. ${metadata}`}
      accessibilityRole="link"
      focusStyle={styles.cardFocused}
      hoverStyle={styles.featureHovered}
      onPress={onPress}
      pressedStyle={styles.controlPressed}
      style={[
        styles.featureStrip,
        tone === 'purple' ? webPurpleFeatureGradient : webBlueFeatureGradient,
      ]}
    >
      <View style={[styles.thumbnail, tone === 'purple' && styles.thumbnailPurple]}>
        <View style={styles.thumbnailRing} />
        <View style={[styles.thumbnailDot, styles.dotYellow]} />
        <View style={[styles.thumbnailDot, styles.dotGreen]} />
        <View style={[styles.thumbnailDot, styles.dotPurple]} />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
        <Text style={styles.featureMetadata}>{metadata}</Text>
      </View>
    </InteractiveSurface>
  );
}

const webBlueFeatureGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(105deg,#F4FAFF 0%,#E6F3FE 100%)' },
  default: {},
}) as ViewStyle;

const webPurpleFeatureGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(105deg,#FAF7FF 0%,#EFE8FF 100%)' },
  default: {},
}) as ViewStyle;

const styles = StyleSheet.create({
  safeArea: { minWidth: 0, width: '100%', maxWidth: '100%', flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  pageFrame: { minWidth: 0, width: '100%', maxWidth: '100%', flex: 1, alignItems: 'center', overflow: 'hidden', backgroundColor: colors.canvas },
  contentFrame: { minWidth: 0, width: '100%', maxWidth: 760, flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  scrollContent: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 98, overflow: 'hidden' },
  controlPressed: { opacity: 0.72 },
  actionCard: { minWidth: 0, minHeight: 86, flexBasis: '47%', flexGrow: 1, flexShrink: 1, flexDirection: 'column', justifyContent: 'space-between', gap: 8, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  actionIcon: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.ice },
  actionTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  cardHovered: { borderColor: colors.paleBlue, backgroundColor: '#FAFCFE' },
  cardFocused: { borderWidth: 2, borderColor: colors.blue },
  featureStrip: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: '#F1F8FE' },
  featureHovered: { borderColor: colors.paleBlue, backgroundColor: colors.ice },
  thumbnail: { position: 'relative', width: 66, height: 58, flexShrink: 0, overflow: 'hidden', borderRadius: 9, backgroundColor: '#005CA8' },
  thumbnailPurple: { backgroundColor: '#5C35AA' },
  thumbnailRing: { position: 'absolute', top: -16, right: -14, width: 54, height: 54, borderWidth: 1, borderColor: 'rgba(255,255,255,.35)', borderRadius: 27 },
  thumbnailDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dotYellow: { bottom: 11, left: 12, backgroundColor: '#FFC24D' },
  dotGreen: { bottom: 19, left: 30, backgroundColor: '#8ED97F' },
  dotPurple: { right: 10, bottom: 8, backgroundColor: '#A855F7' },
  featureCopy: { minWidth: 0, flex: 1 },
  featureTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  featureDescription: { marginTop: 3, color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  featureMetadata: { marginTop: 3, color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.25 },
});
