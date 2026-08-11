import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Verify Before You Go',
  slug: 'verify-before-you-go',
  version: '0.1.0',
  backgroundColor: '#F5F7F9',
  orientation: 'portrait',
  scheme: 'verifybeforeyougo',
  userInterfaceStyle: 'light',
  plugins: [
    'expo-router',
    'expo-splash-screen',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Verify Before You Go to select a recruitment screenshot for local preview.',
      },
    ],
  ],
  experiments: { typedRoutes: true },
  web: { output: 'static', bundler: 'metro' },
};

export default config;
