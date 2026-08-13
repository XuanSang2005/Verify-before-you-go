import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { OfferDraftProvider } from '@/features/offer-intake/OfferDraftContext';
import { StartupOnboardingGate } from '@/features/onboarding/StartupOnboardingGate';
import { ReportDraftProvider } from '@/features/reports/ReportDraftContext';
import { ReportSubmissionProvider } from '@/features/reports/ReportSubmissionContext';
import { RewardProvider } from '@/features/rewards/RewardContext';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    Archivo: require('../assets/fonts/Archivo-Variable.ttf'),
    'BeVietnamPro-Regular': require('../assets/fonts/BeVietnamPro-Regular.ttf'),
    'BeVietnamPro-Medium': require('../assets/fonts/BeVietnamPro-Medium.ttf'),
    'BeVietnamPro-SemiBold': require('../assets/fonts/BeVietnamPro-SemiBold.ttf'),
    'IBMPlexMono-Regular': require('../assets/fonts/IBMPlexMono-Regular.ttf'),
    'IBMPlexMono-Medium': require('../assets/fonts/IBMPlexMono-Medium.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  return (
    <SafeAreaProvider style={styles.root}>
      <StartupOnboardingGate>
        <OfferDraftProvider>
          <ReportDraftProvider>
            <RewardProvider>
              <ReportSubmissionProvider>
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    animation: 'fade',
                    contentStyle: { backgroundColor: colors.canvas },
                    headerShown: false,
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                </Stack>
              </ReportSubmissionProvider>
            </RewardProvider>
          </ReportDraftProvider>
        </OfferDraftProvider>
      </StartupOnboardingGate>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
});
