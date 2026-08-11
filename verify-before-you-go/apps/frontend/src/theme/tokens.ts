import { Platform } from 'react-native';

import { wideBreakpoint } from './layout-values';

export const colors = {
  navy: '#00224A',
  navyRaised: '#00305C',
  blue: '#005CA8',
  brightBlue: '#0077D4',
  sky: '#4DA3E4',
  paleBlue: '#A8D3F2',
  ice: '#EDF5FD',
  paper: '#FFFFFF',
  canvas: '#F5F7F9',
  ink: '#221E1F',
  body: '#3D3839',
  muted: '#5E5859',
  quiet: '#767071',
  line: '#D8DDE2',
  amber: '#FFC24D',
  amberSoft: '#FFF1D6',
  purple: '#7B3FE4',
  focus: '#0077D4',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
  section: 48,
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  heading: 'Archivo',
  body: 'BeVietnamPro-Regular',
  bodyMedium: 'BeVietnamPro-Medium',
  bodySemiBold: 'BeVietnamPro-SemiBold',
  mono: 'IBMPlexMono-Regular',
  monoMedium: 'IBMPlexMono-Medium',
} as const;

export const shadows = {
  card: Platform.select({
    web: { boxShadow: '0 16px 38px -28px rgba(0, 34, 74, 0.5)' },
    default: {
      shadowColor: colors.navy,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 3,
    },
  }),
  floating: Platform.select({
    web: { boxShadow: '0 18px 44px -26px rgba(0, 34, 74, 0.7)' },
    default: {
      shadowColor: colors.navy,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 6,
    },
  }),
} as const;

export const layout = {
  contentMaxWidth: 1180,
  readingMaxWidth: 760,
  mobileGutter: 20,
  desktopGutter: 36,
  minTouchTarget: 44,
  wideBreakpoint,
} as const;
