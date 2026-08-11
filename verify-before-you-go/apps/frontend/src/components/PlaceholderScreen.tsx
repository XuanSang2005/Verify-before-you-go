import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, layout, radii, spacing, typography } from '@/theme';

import { InteractiveSurface } from './InteractiveSurface';
import { ScreenContainer } from './ScreenContainer';

interface PlaceholderScreenProps {
  title: string;
  checkpoint: string;
  description: string;
}

export function PlaceholderScreen({ title, checkpoint, description }: PlaceholderScreenProps) {
  return (
    <ScreenContainer maxWidth={layout.readingMaxWidth}>
      <View style={styles.page}>
        <View style={styles.iconFrame} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons color={colors.blue} name="construct-outline" size={28} />
        </View>
        <Text style={styles.kicker}>UNFINISHED LOCAL PROTOTYPE · {checkpoint}</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.notice}>
          <Ionicons color={colors.blue} name="information-circle-outline" size={20} />
          <Text style={styles.noticeText}>
            This route exists only so the current checkpoint navigation can be inspected. No future workflow or business logic is active.
          </Text>
        </View>
        <InteractiveSurface
          accessibilityLabel="Return to Homepage"
          accessibilityRole="link"
          focusStyle={styles.buttonFocused}
          hoverStyle={styles.buttonHovered}
          onPress={() => router.push('/')}
          pressedStyle={styles.buttonPressed}
          style={styles.button}
        >
          <Ionicons color={colors.paper} name="home-outline" size={19} />
          <Text style={styles.buttonText}>Return to Homepage</Text>
        </InteractiveSurface>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'flex-start',
    paddingTop: spacing.xl,
  },
  iconFrame: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.ice,
  },
  kicker: {
    color: colors.blue,
    fontFamily: typography.monoMedium,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1,
  },
  title: {
    marginTop: spacing.sm,
    color: colors.navy,
    fontFamily: typography.heading,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
  },
  description: {
    maxWidth: 620,
    marginTop: spacing.md,
    color: colors.body,
    fontFamily: typography.body,
    fontSize: 15,
    lineHeight: 24,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D6E9FA',
    borderRadius: radii.sm,
    backgroundColor: colors.ice,
  },
  noticeText: {
    flex: 1,
    color: colors.body,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 19,
  },
  button: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: colors.navy,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
  },
  buttonHovered: {
    borderColor: colors.brightBlue,
    backgroundColor: colors.navyRaised,
  },
  buttonFocused: {
    borderColor: colors.focus,
  },
  buttonPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: colors.paper,
    fontFamily: typography.bodySemiBold,
    fontSize: 13,
    lineHeight: 20,
  },
});
