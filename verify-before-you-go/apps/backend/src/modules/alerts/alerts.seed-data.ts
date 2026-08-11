import type {
  AlertCategory,
  AlertLocation,
  AlertModerationStatus,
} from '@vbyg/contracts';

export type SeedCommunityAlert = {
  id: string;
  title: string;
  location: AlertLocation;
  locationLabel: string;
  category: AlertCategory;
  categoryLabel: string;
  moderationStatus: AlertModerationStatus;
  moderationStatusLabel: string;
  summary: string;
  compatibleReportCount: number;
  maskedIdentifiers: string[];
  observedEvidence: string[];
  unknownInformation: string[];
  verificationSteps: string[];
  sourceNotes: string[];
  firstReportedAt: Date;
  reviewedAt: Date;
};

export const seedCommunityAlerts: readonly SeedCommunityAlert[] = [
  {
    id: 'A-018',
    title: 'Telegram recruitment pattern',
    location: 'cambodia',
    locationLabel: 'Sihanoukville, Cambodia',
    category: 'off-platform-contact',
    categoryLabel: 'Off-platform contact',
    moderationStatus: 'corroborated-pattern',
    moderationStatusLabel: 'Corroborated pattern',
    summary: 'Four compatible reports mention a passport request before written terms and no named legal company.',
    compatibleReportCount: 4,
    maskedIdentifiers: ['@••••••2026'],
    observedEvidence: [
      'Four compatible synthetic reports were recorded between 21 and 29 July.',
      'A passport copy was requested before a signed contract was provided.',
      'Contact was limited to a personal Telegram handle.',
      'The submitted material did not name a legal company.',
    ],
    unknownInformation: [
      'Who controls the masked handle.',
      'Whether every offer came from the same organisation.',
      'Whether any employer authorised the messages.',
    ],
    verificationSteps: [
      'Ask for the full legal company name and registration details.',
      'Contact the company through a channel found independently from the posting.',
      'Delay sharing a passport copy until the purpose, recipient and storage process are independently verified.',
    ],
    sourceNotes: [
      'This is synthetic prototype data created for local testing.',
      'Identifiers are masked and do not refer to a live person or account.',
    ],
    firstReportedAt: new Date('2026-07-21T02:00:00.000Z'),
    reviewedAt: new Date('2026-07-30T02:00:00.000Z'),
  },
  {
    id: 'A-024',
    title: 'Agency licence belongs to another entity',
    location: 'cambodia',
    locationLabel: 'Phnom Penh, Cambodia',
    category: 'licence-claim',
    categoryLabel: 'Licence claim',
    moderationStatus: 'official-source-mismatch',
    moderationStatusLabel: 'Official-source mismatch',
    summary: 'The licence number in two compatible records resolves to a different synthetic recruitment entity.',
    compatibleReportCount: 2,
    maskedIdentifiers: ['LIC-•••-184'],
    observedEvidence: [
      'Two compatible synthetic records used the same licence number.',
      'The synthetic registry fixture associates that number with a different legal name.',
    ],
    unknownInformation: [
      'Whether the mismatch was an error or unauthorised reuse.',
      'Whether the claimed employer has another valid recruitment partner.',
    ],
    verificationSteps: [
      'Open the issuing authority’s registry through an independently found official address.',
      'Compare the legal name, licence number, address and validity dates field by field.',
      'Ask the claimed employer to confirm its recruitment partner through an independently published channel.',
    ],
    sourceNotes: [
      'The registry and licence data are synthetic fixtures, not a live authority record.',
      'The mismatch is an observed test pattern and not an allegation.',
    ],
    firstReportedAt: new Date('2026-07-23T02:00:00.000Z'),
    reviewedAt: new Date('2026-07-28T02:00:00.000Z'),
  },
  {
    id: 'A-031',
    title: 'Passport requested before written role terms',
    location: 'vietnam',
    locationLabel: 'Ho Chi Minh City, Vietnam',
    category: 'identity-document',
    categoryLabel: 'Identity document',
    moderationStatus: 'reviewed-pattern',
    moderationStatusLabel: 'Reviewed pattern',
    summary: 'Three compatible records describe identity-document requests before salary, location and contract terms were confirmed.',
    compatibleReportCount: 3,
    maskedIdentifiers: ['+84 ••• •• 731'],
    observedEvidence: [
      'The synthetic messages asked for a passport image before providing complete written terms.',
      'The role location and salary basis differed across compatible records.',
    ],
    unknownInformation: [
      'Who would receive or store the documents.',
      'Whether a verified employer requested the documents.',
    ],
    verificationSteps: [
      'Confirm the legal employer and role through an independently found contact.',
      'Ask why the document is needed, who receives it and how it will be protected.',
      'Share only the minimum information required after the process is independently verified.',
    ],
    sourceNotes: [
      'Phone digits and all message content are synthetic and privacy-masked.',
      'No live recruiter or employer is represented.',
    ],
    firstReportedAt: new Date('2026-07-25T02:00:00.000Z'),
    reviewedAt: new Date('2026-08-01T02:00:00.000Z'),
  },
  {
    id: 'A-036',
    title: 'Processing fee sent to a personal account',
    location: 'vietnam',
    locationLabel: 'Hanoi, Vietnam',
    category: 'upfront-payment',
    categoryLabel: 'Upfront payment',
    moderationStatus: 'corroborated-pattern',
    moderationStatusLabel: 'Corroborated pattern',
    summary: 'Two compatible records request a processing fee without a written breakdown or independently verified recipient.',
    compatibleReportCount: 2,
    maskedIdentifiers: ['ACCT •••• 5519'],
    observedEvidence: [
      'Both synthetic records requested payment before a signed contract.',
      'Neither record provided a written fee purpose, recipient identity or refund terms.',
    ],
    unknownInformation: [
      'Whether any authorised agency charges a legitimate fee for the claimed process.',
      'Who controls the masked payment account.',
    ],
    verificationSteps: [
      'Request the fee purpose, recipient, amount and refund terms in writing.',
      'Verify the agency and payment channel through sources independent of the sender.',
      'Pause payment when the written terms and requested recipient do not match.',
    ],
    sourceNotes: [
      'The payment account and records are synthetic prototype fixtures.',
      'The record does not establish the legitimacy or intent of any live payment request.',
    ],
    firstReportedAt: new Date('2026-07-27T02:00:00.000Z'),
    reviewedAt: new Date('2026-08-02T02:00:00.000Z'),
  },
  {
    id: 'A-041',
    title: 'Cross-border contact channel changes',
    location: 'regional',
    locationLabel: 'Cambodia–Vietnam corridor',
    category: 'off-platform-contact',
    categoryLabel: 'Off-platform contact',
    moderationStatus: 'reviewed-pattern',
    moderationStatusLabel: 'Reviewed pattern',
    summary: 'Compatible records move applicants between several personal accounts while the claimed employer remains unconfirmed.',
    compatibleReportCount: 3,
    maskedIdentifiers: ['@••••••work', '+855 •• ••• 408'],
    observedEvidence: [
      'The synthetic conversation moved between two personal messaging accounts.',
      'No independently published employer contact appeared in the submitted material.',
    ],
    unknownInformation: [
      'Whether the accounts are controlled by the same person or organisation.',
      'Whether the claimed role exists.',
    ],
    verificationSteps: [
      'Find the claimed employer without using links or contacts from the message.',
      'Ask the employer to confirm the role and recruiter through its published channel.',
      'Keep the account changes as observations rather than treating them as proof.',
    ],
    sourceNotes: [
      'All accounts, phone numbers and reports are synthetic and masked.',
      'This regional fixture is educational, not a live warning list.',
    ],
    firstReportedAt: new Date('2026-07-29T02:00:00.000Z'),
    reviewedAt: new Date('2026-08-03T02:00:00.000Z'),
  },
] as const;
