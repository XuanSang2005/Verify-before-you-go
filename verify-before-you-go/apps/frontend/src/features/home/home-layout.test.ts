import assert from 'node:assert/strict';
import test from 'node:test';

import { getHomeLayout } from './home-layout';

test('uses the mobile Homepage layout at the 360px and 390px references', () => {
  for (const width of [360, 390]) {
    const result = getHomeLayout(width);
    assert.equal(result.wide, false);
    assert.equal(result.actionWidth, 'equal-flex');
    assert.equal(result.featureWidth, '100%');
    assert.equal(result.utilityWidth, '100%');
  }
});

test('keeps the compact single-column hierarchy at tablet, laptop and desktop widths', () => {
  const tablet = getHomeLayout(768);
  assert.equal(tablet.wide, false);
  assert.equal(tablet.utilityWidth, '100%');

  for (const width of [1024, 1440]) {
    const result = getHomeLayout(width);
    assert.equal(result.wide, false);
    assert.equal(result.actionWidth, 'equal-flex');
    assert.equal(result.featureWidth, '100%');
  }
});
