import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { colors } from '@/theme';

export function SupportContactLink({
  accessibilityLabel,
  actionUri,
  children,
  hoverStyle,
  onNativeOpen,
  style,
}: {
  accessibilityLabel: string;
  actionUri: string;
  children?: ReactNode;
  hoverStyle: ViewStyle;
  onNativeOpen: () => void;
  style: ViewStyle;
}) {
  const surface = (
    <InteractiveSurface
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="link"
      focusStyle={styles.focused}
      hoverStyle={hoverStyle}
      onPress={Platform.OS === 'web' ? undefined : onNativeOpen}
      pressedStyle={styles.pressed}
      style={style}
    >
      {children}
    </InteractiveSurface>
  );

  if (Platform.OS !== 'web') return surface;
  return (
    <Link asChild href={actionUri as Href}>
      {surface}
    </Link>
  );
}

export function SupportInternalLink({
  accessibilityLabel,
  children,
  href,
  hoverStyle,
  style,
}: {
  accessibilityLabel: string;
  children?: ReactNode;
  href: Href;
  hoverStyle: ViewStyle;
  style: ViewStyle;
}) {
  return (
    <Link asChild href={href}>
      <InteractiveSurface
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="link"
        focusStyle={styles.focused}
        hoverStyle={hoverStyle}
        pressedStyle={styles.pressed}
        style={style}
      >
        {children}
      </InteractiveSurface>
    </Link>
  );
}

const styles = StyleSheet.create({
  focused: { borderWidth: 2, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
});
