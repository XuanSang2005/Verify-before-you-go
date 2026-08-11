import assert from 'node:assert/strict';
import test from 'node:test';

import { getChecklistBackRoute } from './checklist-navigation';

test('returns to Result only while transient analysis exists', () => {
  assert.equal(getChecklistBackRoute(true), '/check/result');
  assert.equal(getChecklistBackRoute(false), '/check');
});
