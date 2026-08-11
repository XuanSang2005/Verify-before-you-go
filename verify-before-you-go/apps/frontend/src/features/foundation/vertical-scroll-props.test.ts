import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { verticalScrollBehavior } from '../../components/vertical-scroll-contract';

test('vertical ScrollViews disable bounce and horizontal overscroll', () => {
  assert.equal(verticalScrollBehavior.bounces, false);
  assert.equal(verticalScrollBehavior.alwaysBounceHorizontal, false);
  assert.equal(verticalScrollBehavior.alwaysBounceVertical, false);
  assert.equal(verticalScrollBehavior.directionalLockEnabled, true);
  assert.equal(verticalScrollBehavior.overScrollMode, 'never');
  assert.equal(verticalScrollBehavior.showsHorizontalScrollIndicator, false);
  assert.equal(verticalScrollBehavior.contentInsetAdjustmentBehavior, 'never');
  assert.equal(verticalScrollBehavior.testID, 'vbyg-vertical-scroll');
});

test('web viewport locks zoom while preserving vertical scrolling', () => {
  const htmlSource = readFileSync(new URL('../../../app/+html.tsx', import.meta.url), 'utf8');
  const scrollPropsSource = readFileSync(
    new URL('../../components/vertical-scroll-props.ts', import.meta.url),
    'utf8',
  );

  assert.match(htmlSource, /minimum-scale=1, maximum-scale=1, user-scalable=no/);
  assert.doesNotMatch(htmlSource, /pinch-zoom/);
  assert.match(scrollPropsSource, /touchAction: 'pan-y'/);
  assert.doesNotMatch(scrollPropsSource, /pinch-zoom/);
});

test('PrototypeTabScreen can reset the same cross-platform ScrollView without animation', () => {
  const shellSource = readFileSync(
    new URL('../../components/prototype/PrototypeShell.tsx', import.meta.url),
    'utf8',
  );

  assert.match(shellSource, /scrollResetKey\?: string \| number/);
  assert.match(shellSource, /ref=\{scrollViewRef\}/);
  assert.match(shellSource, /scrollViewRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/);
  assert.match(shellSource, /Object\.is\(previousScrollResetKeyRef\.current, scrollResetKey\)/);
});
