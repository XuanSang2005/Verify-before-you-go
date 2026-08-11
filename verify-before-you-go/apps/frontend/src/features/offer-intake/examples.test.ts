import assert from 'node:assert/strict';
import test from 'node:test';

import { checkedRuleCount, examplePostings } from './examples';

test('synthetic Recent cards derive their counts from fixture findings', () => {
  const warningExample = examplePostings.find((example) => example.id === 'customer-support-sihanoukville');
  const noSignalExample = examplePostings.find((example) => example.id === 'warehouse-packing-poznan');

  assert.equal(checkedRuleCount, 9);
  assert.equal(warningExample?.observedFindingIds.length, 7);
  assert.equal(noSignalExample?.observedFindingIds.length, 0);
});

test('warning fixture finding ids remain unique and valid', () => {
  const warningExample = examplePostings.find((example) => example.id === 'customer-support-sihanoukville');
  const ids = warningExample?.observedFindingIds ?? [];

  assert.equal(new Set(ids).size, ids.length);
});
