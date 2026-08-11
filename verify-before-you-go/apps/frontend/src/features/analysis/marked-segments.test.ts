import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMarkedTextSegments, MIN_MARKED_PASSAGE_TARGET } from './marked-segments';

test('marked passage controls meet the minimum touch target', () => {
  assert.ok(MIN_MARKED_PASSAGE_TARGET >= 44);
});

test('splits posting text into exact marked and unmarked passages', () => {
  const text = 'Apply today. Send a passport photo.';
  const segments = buildMarkedTextSegments(text, [
    { findingId: 'urgency-pressure', text: 'today', start: 6, end: 11 },
    { findingId: 'identity-document-request', text: 'passport photo', start: 20, end: 34 },
  ]);
  assert.equal(segments.map((segment) => segment.text).join(''), text);
  assert.deepEqual(
    segments.filter((segment) => segment.findingId).map((segment) => segment.findingId),
    ['urgency-pressure', 'identity-document-request'],
  );
});

test('ignores stale offsets but preserves every finding in an overlapping evidence region', () => {
  const segments = buildMarkedTextSegments('Apply today.', [
    { findingId: 'urgency-pressure', text: 'wrong', start: 6, end: 11 },
    { findingId: 'off-platform-contact', text: 'today', start: 6, end: 11 },
    { findingId: 'urgency-pressure', text: 'day', start: 8, end: 11 },
  ]);
  assert.equal(segments.map((segment) => segment.text).join(''), 'Apply today.');
  assert.equal(segments.filter((segment) => segment.findingId).length, 1);
  assert.deepEqual(
    segments.find((segment) => segment.findingId)?.findingIds,
    ['off-platform-contact', 'urgency-pressure'],
  );
});
