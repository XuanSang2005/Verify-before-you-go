import assert from 'node:assert/strict';
import test from 'node:test';

import { CHECKLIST_ITEM_IDS } from './checklist-items';
import {
  CHECKLIST_SCHEMA_VERSION,
  createEmptyChecklistProgress,
  getChecklistReviewedCount,
  getChecklistUnverifiedCount,
  getChecklistVerifiedCount,
  isChecklistComplete,
  mergeChecklistSessionEdits,
  parseChecklistProgress,
  resetChecklistProgress,
  setChecklistItemState,
  toggleChecklistItemState,
} from './checklist-model';

const start = '2026-08-09T10:00:00.000Z';

test('uses schema v2 with untouched, verified and unverified states', () => {
  let progress = createEmptyChecklistProgress(start);
  assert.equal(CHECKLIST_SCHEMA_VERSION, 2);
  assert.ok(progress.items.every((item) => item.state === 'untouched'));

  progress = setChecklistItemState(progress, CHECKLIST_ITEM_IDS[0], 'verified', '2026-08-09T10:01:00.000Z');
  progress = setChecklistItemState(progress, CHECKLIST_ITEM_IDS[1], 'unverified', '2026-08-09T10:02:00.000Z');

  assert.equal(getChecklistReviewedCount(progress), 2);
  assert.equal(getChecklistVerifiedCount(progress), 1);
  assert.equal(getChecklistUnverifiedCount(progress), 1);
});

test('selecting an active state again returns that item to untouched', () => {
  const initial = createEmptyChecklistProgress(start);
  const verified = toggleChecklistItemState(initial, CHECKLIST_ITEM_IDS[0], 'verified', '2026-08-09T10:01:00.000Z');
  const untouched = toggleChecklistItemState(verified, CHECKLIST_ITEM_IDS[0], 'verified', '2026-08-09T10:02:00.000Z');

  assert.equal(verified.items[0]?.state, 'verified');
  assert.equal(untouched.items[0]?.state, 'untouched');
});

test('progress advances from 0/5 to 5/5 with mixed reviewed states', () => {
  let progress = createEmptyChecklistProgress(start);
  assert.equal(getChecklistReviewedCount(progress), 0);

  CHECKLIST_ITEM_IDS.forEach((id, index) => {
    progress = setChecklistItemState(
      progress,
      id,
      index % 2 === 0 ? 'verified' : 'unverified',
      `2026-08-09T10:0${index + 1}:00.000Z`,
    );
    assert.equal(getChecklistReviewedCount(progress), index + 1);
  });

  assert.equal(isChecklistComplete(progress), true);
  assert.equal(getChecklistVerifiedCount(progress), 3);
  assert.equal(getChecklistUnverifiedCount(progress), 2);
  assert.equal(progress.completedAt, '2026-08-09T10:05:00.000Z');

  progress = setChecklistItemState(progress, CHECKLIST_ITEM_IDS[2], 'untouched', '2026-08-09T10:06:00.000Z');
  assert.equal(isChecklistComplete(progress), false);
  assert.equal(progress.completedAt, undefined);
});

test('migrates schema v1 completed booleans to schema v2 states', () => {
  const result = parseChecklistProgress(JSON.stringify({
    schemaVersion: 1,
    items: CHECKLIST_ITEM_IDS.map((id, index) => ({
      id,
      completed: index === 0 || index === 3,
      updatedAt: `2026-08-09T10:0${index}:00.000Z`,
    })),
    createdAt: start,
    updatedAt: '2026-08-09T10:05:00.000Z',
  }));

  assert.equal(result.status, 'migrated');
  assert.equal(result.progress.schemaVersion, 2);
  assert.deepEqual(result.progress.items.map((item) => item.state), [
    'verified', 'untouched', 'untouched', 'verified', 'untouched',
  ]);
});

test('merges only session-edited items into successfully read storage data', () => {
  const stored = setChecklistItemState(
    createEmptyChecklistProgress(start),
    CHECKLIST_ITEM_IDS[1],
    'verified',
    '2026-08-09T10:01:00.000Z',
  );
  const session = setChecklistItemState(
    createEmptyChecklistProgress(start),
    CHECKLIST_ITEM_IDS[0],
    'unverified',
    '2026-08-09T10:02:00.000Z',
  );
  const merged = mergeChecklistSessionEdits(stored, session, new Set([CHECKLIST_ITEM_IDS[0]]));

  assert.equal(merged.items[0]?.state, 'unverified');
  assert.equal(merged.items[1]?.state, 'verified');
  assert.equal(getChecklistReviewedCount(merged), 2);
});

test('reset returns all five items to untouched while preserving creation time', () => {
  const reviewed = setChecklistItemState(
    createEmptyChecklistProgress(start),
    CHECKLIST_ITEM_IDS[4],
    'unverified',
    '2026-08-09T10:01:00.000Z',
  );
  const reset = resetChecklistProgress(reviewed, '2026-08-09T10:02:00.000Z');

  assert.equal(getChecklistReviewedCount(reset), 0);
  assert.ok(reset.items.every((item) => item.state === 'untouched'));
  assert.equal(reset.createdAt, start);
  assert.equal(reset.updatedAt, '2026-08-09T10:02:00.000Z');
});
