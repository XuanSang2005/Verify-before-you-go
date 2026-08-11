import { Platform, type ScrollViewProps, type ViewStyle } from 'react-native';

import { verticalScrollBehavior } from './vertical-scroll-contract';

const webVerticalScrollStyle = Platform.select({
  web: {
    maxWidth: '100%',
    overflowX: 'hidden',
    overscrollBehavior: 'none',
    touchAction: 'pan-y',
  },
  default: {},
}) as ViewStyle;

export const verticalScrollViewProps = {
  ...verticalScrollBehavior,
  style: webVerticalScrollStyle,
} satisfies ScrollViewProps;
