import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '@/theme';

import { InteractiveSurface } from './InteractiveSurface';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface NavigationCardProps {
  title: string;
  description: string;
  icon: IconName;
  onPress: () => void;
  style?: ViewStyle;
  compact?: boolean;
}

export function NavigationCard({ title, description, icon, onPress, style, compact = false }: NavigationCardProps) {
  return (
    <InteractiveSurface
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="link"
      focusStyle={styles.focused}
      hoverStyle={styles.hovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[styles.card, compact && styles.cardCompact, shadows.card, style]}
    >
      <View style={styles.iconFrame}>
        <Ionicons color={colors.blue} name={icon} size={19} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {compact ? <Ionicons color={colors.sky} name="chevron-forward" size={18} /> : null}
    </InteractiveSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 126,
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.paper,
  },
  cardCompact: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  hovered: {
    borderColor: colors.paleBlue,
    backgroundColor: '#F9FCFF',
    transform: [{ translateY: -2 }],
  },
  focused: {
    borderColor: colors.focus,
    borderWidth: 3,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  iconFrame: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.ice,
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    color: colors.navy,
    fontFamily: typography.heading,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  description: {
    marginTop: 4,
    color: colors.quiet,
    fontFamily: typography.body,
    fontSize: 11,
    lineHeight: 17,
  },
});
