import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

interface FormFieldProps {
  label: string;
  helper: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ label, helper, error, children }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.helper}>{helper}</Text>
      {children}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.navy,
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  helper: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 11,
    lineHeight: 17,
  },
  error: {
    color: '#A82A2A',
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    lineHeight: 17,
  },
});
