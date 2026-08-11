import type {
  AlertDetailResponse,
  AlertListResponse,
  AlertSummary,
} from '@vbyg/contracts';

export const alertSummaryFixture: AlertSummary = {
  id: 'A-018',
  title: 'Telegram recruitment pattern',
  location: 'cambodia',
  locationLabel: 'Sihanoukville, Cambodia',
  category: 'off-platform-contact',
  categoryLabel: 'Off-platform contact',
  moderationStatus: 'corroborated-pattern',
  moderationStatusLabel: 'Corroborated pattern',
  summary: 'Four compatible reports mention a passport request before written terms.',
  compatibleReportCount: 4,
  maskedIdentifiers: ['@••••••2026'],
  syntheticLabel: 'Synthetic demo data',
  firstReportedAt: '2026-07-21T02:00:00.000Z',
  reviewedAt: '2026-07-30T02:00:00.000Z',
};

export const alertListFixture: AlertListResponse = {
  alerts: [alertSummaryFixture],
  fetchedAt: '2026-08-10T02:00:00.000Z',
  syntheticContentNotice: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
};

export const alertDetailFixture: AlertDetailResponse = {
  alert: {
    ...alertSummaryFixture,
    observedEvidence: [
      'Four compatible synthetic reports were recorded.',
      'A passport copy was requested before a signed contract.',
    ],
    unknownInformation: ['Who controls the masked handle.'],
    verificationSteps: [
      'Ask for the full legal company name.',
      'Contact the company through an independently found channel.',
      'Delay sharing identity documents until the process is independently verified.',
    ],
    sourceNotes: ['This is synthetic prototype data with masked identifiers.'],
    safetyStatement: 'This reviewed record is not a verdict and does not establish fraud.',
  },
};
