import assert from 'node:assert/strict';
import test from 'node:test';

import {
  floatingTabBarContract,
  getFloatingTabBarHorizontalPadding,
  getNativeFloatingTabBarBottom,
} from './floating-tab-bar-contract';

test('keeps the icon-only floating navigation treatment consistent', () => {
  assert.equal(floatingTabBarContract.backgroundColor, 'rgba(0,34,74,0.90)');
  assert.equal(floatingTabBarContract.activeBackground, 'transparent');
  assert.equal(floatingTabBarContract.activeIconColor, '#FFFFFF');
  assert.equal(floatingTabBarContract.inactiveIconColor, '#A8D3F2');
  assert.equal(floatingTabBarContract.iconSize, 24);
  assert.equal(floatingTabBarContract.touchTarget, 48);
  assert.deepEqual(
    {
      color: floatingTabBarContract.indicatorColor,
      width: floatingTabBarContract.indicatorWidth,
      height: floatingTabBarContract.indicatorHeight,
      radius: floatingTabBarContract.indicatorRadius,
    },
    { color: '#4DA3E4', width: 18, height: 3, radius: 2 },
  );
});

test('anchors the bar above each platform safe area without changing its maximum width', () => {
  assert.equal(floatingTabBarContract.nativeSafeAreaGap, 12);
  assert.equal(
    floatingTabBarContract.webBottom,
    'calc(env(safe-area-inset-bottom, 0px) + 12px)',
  );
  assert.equal(floatingTabBarContract.maximumWidth, 351);
  assert.equal(getNativeFloatingTabBarBottom(0), 12);
  assert.equal(getNativeFloatingTabBarBottom(34), 46);
  assert.equal(getFloatingTabBarHorizontalPadding(320), 20);
  assert.equal(getFloatingTabBarHorizontalPadding(390), 40);
  assert.equal(getFloatingTabBarHorizontalPadding(844), 40);
});

test('uses a short transition that can be disabled for Reduce Motion', () => {
  assert.ok(floatingTabBarContract.animationDurationMs >= 160);
  assert.ok(floatingTabBarContract.animationDurationMs <= 220);
});

test('the underline is the only active-tab treatment', () => {
  assert.equal(floatingTabBarContract.activeBackground, 'transparent');
  assert.equal(floatingTabBarContract.indicatorColor, '#4DA3E4');
});
