import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

export function TrustStatement() {
  return (
    <View accessibilityLabel="Evidence, not verdict. This app shows observed signals and independent checks. It does not decide whether an offer is safe." style={styles.card}>
      <View style={styles.iconFrame}>
        <Ionicons color={colors.amber} name="compass-outline" size={23} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Evidence, not verdict.</Text>
        <Text style={styles.body}>
          This app shows observed signals and independent checks. It does not decide whether an offer is safe.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.amber,
    borderRadius: radii.sm,
    backgroundColor: colors.navy,
  },
  iconFrame: {
    width: 42,
    height: 42,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,194,77,0.1)',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.paper,
    fontFamily: typography.heading,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  body: {
    marginTop: 4,
    color: '#D6E9FA',
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 19,
  },
});
