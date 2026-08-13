import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { ComponentProps } from 'react';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { colors, typography } from '@/theme';

export function RewardUnlockCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <View style={styles.card} testID="reward-unlocked-card">
      <View style={styles.iconBox}>
        <Ionicons color="#755000" name="gift-outline" size={22} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.meta}>Demo reward</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Link asChild href={'/rewards/voucher' as Href}>
        <InteractiveSurface
          {...webSpaceActivationProps}
          accessibilityLabel="View demo voucher"
          accessibilityRole="link"
          focusStyle={styles.focused}
          hoverStyle={styles.hovered}
          pressedStyle={styles.pressed}
          style={voucherLinkStyle}
          testID="view-voucher"
        >
          <Text style={styles.linkText}>View voucher</Text>
          <Ionicons color={colors.paper} name="arrow-forward" size={18} />
        </InteractiveSurface>
      </Link>
    </View>
  );
}

const webGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#005CA8 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

const webSpaceActivationProps = Platform.OS === 'web'
  ? ({
      onKeyUp: (event: { currentTarget: { click: () => void }; key: string; preventDefault: () => void }) => {
        if (event.key !== ' ') return;
        event.preventDefault();
        event.currentTarget.click();
      },
    } as unknown as Partial<ComponentProps<typeof InteractiveSurface>>)
  : {};

const styles = StyleSheet.create({
  card: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 10, padding: 14, borderWidth: 1, borderColor: '#ECCB80', borderRadius: 16, backgroundColor: colors.amberSoft },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.paper },
  copy: { minWidth: 0, gap: 4 },
  meta: { color: '#755000', fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.9, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 16, lineHeight: 22 },
  description: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  link: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.blue },
  linkText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  hovered: { opacity: 0.92 },
  focused: { borderWidth: 3, borderColor: colors.navy },
  pressed: { opacity: 0.72 },
});

const voucherLinkStyle = StyleSheet.flatten([styles.link, webGradient]);
