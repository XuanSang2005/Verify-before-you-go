import assert from 'node:assert/strict';
import test from 'node:test';

import { runConfirmedChecklistReset } from './checklist-reset';

test('reset confirmation cancels without changing progress', async () => {
  let resets = 0;
  const result = await runConfirmedChecklistReset(async () => false, () => { resets += 1; });

  assert.equal(result, false);
  assert.equal(resets, 0);
});

test('reset confirmation runs the reset after approval', async () => {
  let resets = 0;
  const result = await runConfirmedChecklistReset(async () => true, () => { resets += 1; });

  assert.equal(result, true);
  assert.equal(resets, 1);
});
