import assert from 'node:assert/strict';
import test from 'node:test';

import {
  copyDemoVoucherCode,
  getRewardVoucher,
  rewardEligibilityValues,
} from './reward-model';

test('reward eligibility is limited to two privacy-safe in-memory enum values', () => {
  assert.deepEqual(rewardEligibilityValues, ['quiz-perfect', 'private-report-submitted']);
  assert.deepEqual(getRewardVoucher('quiz-perfect'), {
    benefit: 'Demo partner reward',
    code: 'VBYG-DEMO-5OF5',
    source: 'quiz-perfect',
  });
  assert.deepEqual(getRewardVoucher('private-report-submitted'), {
    benefit: 'Demo partner reward',
    code: 'VBYG-DEMO-REPORT',
    source: 'private-report-submitted',
  });
});

test('clipboard true and void succeed while false, rejection and unavailable fail closed', async () => {
  await assert.doesNotReject(copyDemoVoucherCode('VBYG-DEMO-5OF5', async () => true));
  await assert.doesNotReject(copyDemoVoucherCode('VBYG-DEMO-5OF5', async () => undefined));
  await assert.rejects(copyDemoVoucherCode('VBYG-DEMO-5OF5', async () => false), /Clipboard write failed/u);
  await assert.rejects(copyDemoVoucherCode('VBYG-DEMO-5OF5', async () => { throw new Error('denied'); }), /denied/u);
  await assert.rejects(copyDemoVoucherCode('VBYG-DEMO-5OF5', undefined), /Clipboard is unavailable/u);
});
