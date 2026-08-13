import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function RewardsLayout() {
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
