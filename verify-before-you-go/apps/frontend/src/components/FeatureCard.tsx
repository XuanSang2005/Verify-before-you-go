import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '@/theme';

import { InteractiveSurface } from './InteractiveSurface';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface FeatureCardProps {
  eyebrow: string;
  title: string;
  description: string;
  metadata: string;
  icon: IconName;
  tone: 'blue' | 'purple';
  onPress: () => void;
  style?: ViewStyle;
}

export function FeatureCard({
  eyebrow,
  title,
  description,
  metadata,
  icon,
  tone,
  onPress,
  style,
}: FeatureCardProps) {
  const visualColor = tone === 'purple' ? colors.purple : colors.brightBlue;

  return (
    <InteractiveSurface
      accessibilityLabel={`${eyebrow}. ${title}. ${metadata}`}
      accessibilityRole="link"
      focusStyle={styles.focused}
      hoverStyle={styles.hovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[styles.card, shadows.card, style]}
    >
      <View style={[styles.visual, { backgroundColor: visualColor }]}>
        <View style={styles.visualRing} />
        <View style={styles.visualDotRow}>
          <View style={[styles.dot, { backgroundColor: colors.amber }]} />
          <View style={[styles.dot, { backgroundColor: '#8ED97F' }]} />
          <View style={[styles.dot, { backgroundColor: tone === 'purple' ? colors.paleBlue : colors.purple }]} />
        </View>
        <Ionicons color={colors.paper} name={icon} size={27} style={styles.visualIcon} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.metadata}>{metadata}</Text>
      </View>
      <Ionicons color={colors.sky} name="arrow-forward" size={20} />
    </InteractiveSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 166,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D6E9FA',
    borderRadius: radii.md,
    backgroundColor: colors.paper,
  },
  hovered: {
    borderColor: colors.sky,
    backgroundColor: '#F9FCFF',
    transform: [{ translateY: -2 }],
  },
  focused: {
    borderColor: colors.focus,
    borderWidth: 3,
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }],
  },
  visual: {
    position: 'relative',
    width: 92,
    height: 116,
    flexShrink: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  visualRing: {
    position: 'absolute',
    top: -25,
    right: -25,
    width: 82,
    height: 82,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radii.pill,
  },
  visualIcon: {
    marginTop: -10,
  },
  visualDotRow: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  eyebrow: {
    marginBottom: 5,
    color: colors.blue,
    fontFamily: typography.monoMedium,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.navy,
    fontFamily: typography.heading,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  description: {
    marginTop: 5,
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 11,
    lineHeight: 17,
  },
  metadata: {
    marginTop: 7,
    color: colors.quiet,
    fontFamily: typography.mono,
    fontSize: 8,
    lineHeight: 13,
  },
});
