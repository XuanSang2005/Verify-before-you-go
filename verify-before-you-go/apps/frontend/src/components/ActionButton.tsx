import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { colors, layout, radii, spacing, typography } from '@/theme';

import { InteractiveSurface } from './InteractiveSurface';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'quiet';
}

export function ActionButton({
  label,
  onPress,
  accessibilityLabel = label,
  disabled = false,
  loading = false,
  icon,
  variant = 'primary',
}: ActionButtonProps) {
  const primary = variant === 'primary';
  const quiet = variant === 'quiet';
  const foreground = primary ? colors.paper : colors.blue;

  return (
    <InteractiveSurface
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled || loading}
      disabledStyle={styles.disabled}
      focusStyle={styles.focused}
      hoverStyle={primary ? styles.primaryHovered : styles.secondaryHovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[
        styles.button,
        primary && styles.primary,
        !primary && styles.secondary,
        quiet && styles.quiet,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : icon ? (
        <Ionicons color={foreground} name={icon} size={19} />
      ) : null}
      <Text style={[styles.label, { color: foreground }]}>{loading ? 'Working…' : label}</Text>
    </InteractiveSurface>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.minTouchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderRadius: radii.pill,
  },
  primary: {
    borderColor: colors.brightBlue,
    backgroundColor: colors.brightBlue,
  },
  secondary: {
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  quiet: {
    borderColor: 'transparent',
    backgroundColor: colors.ice,
  },
  primaryHovered: {
    borderColor: colors.navyRaised,
    backgroundColor: colors.blue,
    transform: [{ translateY: -1 }],
  },
  secondaryHovered: {
    borderColor: colors.paleBlue,
    backgroundColor: colors.ice,
  },
  focused: {
    borderColor: colors.amber,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
