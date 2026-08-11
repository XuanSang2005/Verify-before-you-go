import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '@/theme';

import { InteractiveSurface } from './InteractiveSurface';

interface HomePrimaryActionProps {
  title: string;
  description: string;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}

export function HomePrimaryAction({
  title,
  description,
  accessibilityLabel,
  disabled = false,
  loading = false,
  onPress,
}: HomePrimaryActionProps) {
  return (
    <InteractiveSurface
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="link"
      disabled={disabled || loading}
      disabledStyle={styles.disabled}
      focusStyle={styles.focused}
      hoverStyle={styles.hovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[styles.card, shadows.floating]}
    >
      <View style={styles.iconFrame}>
        {loading ? (
          <ActivityIndicator color={colors.amber} size="small" />
        ) : (
          <Ionicons color={colors.amber} name="shield-checkmark-outline" size={24} />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Ionicons color={colors.paleBlue} name="arrow-forward" size={22} />
    </InteractiveSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#164A77',
    borderRadius: radii.md,
    backgroundColor: colors.navy,
  },
  hovered: {
    borderColor: colors.sky,
    backgroundColor: colors.navyRaised,
    transform: [{ translateY: -2 }],
  },
  focused: {
    borderColor: colors.focus,
    borderWidth: 3,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
  iconFrame: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168,211,242,0.35)',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    marginBottom: 4,
    color: colors.paper,
    fontFamily: typography.heading,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
  },
  description: {
    color: '#D6E9FA',
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 19,
  },
});
