import { ANALYSIS_FINDING_IDS } from '@vbyg/contracts';

import { FindingDetailScreen } from '@/features/analysis/FindingDetailScreen';

export function generateStaticParams() {
  return ANALYSIS_FINDING_IDS.map((id) => ({ id }));
}

export default function FindingDetailRoute() {
  return <FindingDetailScreen />;
}
