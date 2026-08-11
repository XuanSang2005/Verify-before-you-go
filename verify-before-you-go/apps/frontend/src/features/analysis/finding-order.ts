import type { AnalysisFinding } from '@vbyg/contracts';

export function orderFindingsForPresentation(findings: AnalysisFinding[]): AnalysisFinding[] {
  return findings
    .map((finding, originalIndex) => ({ finding, originalIndex }))
    .sort((left, right) => {
      const positionDifference = evidencePosition(left.finding) - evidencePosition(right.finding);
      return positionDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ finding }) => finding);
}

function evidencePosition(finding: AnalysisFinding): number {
  if (finding.evidence.kind === 'absence') return 2_000_000;
  return finding.evidence.source === 'postingText'
    ? finding.evidence.start
    : 1_000_000 + finding.evidence.start;
}
