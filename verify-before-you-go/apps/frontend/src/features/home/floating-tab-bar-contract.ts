export const floatingTabBarContract = {
  backgroundColor: 'rgba(0,34,74,0.90)',
  activeBackground: 'transparent',
  activeIconColor: '#FFFFFF',
  inactiveIconColor: '#A8D3F2',
  indicatorColor: '#4DA3E4',
  indicatorWidth: 18,
  indicatorHeight: 3,
  indicatorRadius: 2,
  iconSize: 24,
  touchTarget: 48,
  animationDurationMs: 180,
  maximumWidth: 351,
  nativeSafeAreaGap: 12,
  webBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
} as const;

export function getFloatingTabBarHorizontalPadding(viewportWidth: number) {
  return viewportWidth < 360 ? 20 : 40;
}

export function getNativeFloatingTabBarBottom(bottomInset: number) {
  return bottomInset + floatingTabBarContract.nativeSafeAreaGap;
}
