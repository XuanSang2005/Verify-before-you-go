import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AlertsLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'fade',
        contentStyle: { backgroundColor: colors.canvas },
        headerShown: false,
      }}
    />
  );
}
