import assert from 'node:assert/strict';
import test from 'node:test';

import { copySupportValue } from './support-actions';

test('copy reports success only for void or true clipboard results', async () => {
  assert.equal(await copySupportValue('117', async () => true), 'copied');
  assert.equal(await copySupportValue('117', async () => undefined), 'copied');
  assert.equal(await copySupportValue('117', async () => false), 'failed');
  assert.equal(await copySupportValue('117', async () => { throw new Error('denied'); }), 'failed');
});
