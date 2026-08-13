export const rewardEligibilityValues = [
  'quiz-perfect',
  'private-report-submitted',
] as const;

export type RewardEligibility = typeof rewardEligibilityValues[number];

export type RewardVoucher = {
  benefit: 'Demo partner reward';
  code: 'VBYG-DEMO-5OF5' | 'VBYG-DEMO-REPORT';
  source: RewardEligibility;
};

export type ClipboardWriter = (value: string) => Promise<boolean | void>;

export function getRewardVoucher(eligibility: RewardEligibility): RewardVoucher {
  return {
    benefit: 'Demo partner reward',
    code: eligibility === 'quiz-perfect' ? 'VBYG-DEMO-5OF5' : 'VBYG-DEMO-REPORT',
    source: eligibility,
  };
}

export async function copyDemoVoucherCode(
  code: RewardVoucher['code'],
  write: ClipboardWriter | undefined,
): Promise<void> {
  if (!write) throw new Error('Clipboard is unavailable.');
  const result = await write(code);
  if (result === false) throw new Error('Clipboard write failed.');
}
