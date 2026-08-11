import {
  ANALYSIS_FINDING_IDS,
  type AnalyseOfferResponse,
  type AnalysisFindingId,
} from '@vbyg/contracts';

export const SHARE_SCHEMA_VERSION = 1 as const;
export const SHARE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1_000;

const MAX_CHECKED_RULES = ANALYSIS_FINDING_IDS.length;
const findingIdSet = new Set<string>(ANALYSIS_FINDING_IDS);

type SafeFindingCopy = {
  observed: string;
  recipient: string;
};

export const safeFindingCopy: Record<AnalysisFindingId, SafeFindingCopy> = {
  'urgency-pressure': {
    observed: 'Urgency or time pressure in the posting',
    recipient: 'The posting uses urgency or time pressure.',
  },
  'identity-document-request': {
    observed: 'Identity document requested before verification',
    recipient: 'An identity document is requested before independent verification.',
  },
  'upfront-payment-request': {
    observed: 'Payment requested before the offer is verified',
    recipient: 'A payment is requested before the offer is independently verified.',
  },
  'off-platform-contact': {
    observed: 'Contact limited to an off-platform channel',
    recipient: 'Contact is limited to an off-platform channel.',
  },
  'missing-employer-identity': {
    observed: 'Legal employer identity is missing',
    recipient: 'The legal employer identity is not provided.',
  },
  'unverifiable-licence-claim': {
    observed: 'A licence or registration claim is unverified',
    recipient: 'A licence or registration claim still needs an independent check.',
  },
  'shortened-link': {
    observed: 'A shortened link hides the destination',
    recipient: 'A shortened link hides the destination address.',
  },
  'unsupported-salary-claim': {
    observed: 'A salary claim lacks supporting terms',
    recipient: 'A salary claim is not supported by complete written terms.',
  },
  'discourages-independent-contact': {
    observed: 'Independent contact is discouraged',
    recipient: 'The posting discourages independent contact or verification.',
  },
};

export const demoFindingIds: AnalysisFindingId[] = [
  'identity-document-request',
  'missing-employer-identity',
  'off-platform-contact',
  'upfront-payment-request',
  'urgency-pressure',
  'discourages-independent-contact',
];

export type SafeShareSummary = {
  schemaVersion: typeof SHARE_SCHEMA_VERSION;
  findingIds: AnalysisFindingId[];
  checkedRuleCount: typeof MAX_CHECKED_RULES;
  expiresAt: string;
  demo: boolean;
};

export type RecipientShareParams = {
  v?: string | string[];
  signals?: string | string[];
  expires?: string | string[];
  demo?: string | string[];
};

export type RecipientShareParseResult =
  | { status: 'ready'; summary: SafeShareSummary }
  | { status: 'expired'; summary: SafeShareSummary }
  | { status: 'invalid' };

export function createSafeShareSummary(
  analysis: AnalyseOfferResponse | undefined,
  now = Date.now(),
): SafeShareSummary {
  const findingIds = analysis
    ? uniqueAllowedFindingIds(analysis.findings.map((finding) => finding.id))
    : [...demoFindingIds];

  return {
    schemaVersion: SHARE_SCHEMA_VERSION,
    findingIds,
    checkedRuleCount: MAX_CHECKED_RULES,
    expiresAt: new Date(now + SHARE_EXPIRY_MS).toISOString(),
    demo: !analysis,
  };
}

export function createRecipientShareParams(summary: SafeShareSummary): Record<string, string> {
  return {
    v: String(SHARE_SCHEMA_VERSION),
    signals: summary.findingIds.length ? summary.findingIds.join(',') : 'none',
    expires: String(Date.parse(summary.expiresAt)),
    demo: summary.demo ? '1' : '0',
  };
}

export function parseRecipientShareParams(
  params: RecipientShareParams,
  now = Date.now(),
): RecipientShareParseResult {
  const version = singleValue(params.v);
  const signals = singleValue(params.signals);
  const expires = singleValue(params.expires);
  const demo = singleValue(params.demo);

  if (version !== String(SHARE_SCHEMA_VERSION) || !signals || !expires || !/^\d{13}$/.test(expires)) {
    return { status: 'invalid' };
  }
  if (demo !== '0' && demo !== '1') return { status: 'invalid' };

  const rawFindingIds = signals === 'none' ? [] : signals.split(',');
  const findingIds = uniqueAllowedFindingIds(rawFindingIds);
  if (
    findingIds.length !== rawFindingIds.length
    || findingIds.length > MAX_CHECKED_RULES
    || (findingIds.length ? findingIds.join(',') : 'none') !== signals
  ) {
    return { status: 'invalid' };
  }

  const expiresAtMs = Number(expires);
  if (!Number.isSafeInteger(expiresAtMs)) return { status: 'invalid' };

  const summary: SafeShareSummary = {
    schemaVersion: SHARE_SCHEMA_VERSION,
    findingIds,
    checkedRuleCount: MAX_CHECKED_RULES,
    expiresAt: new Date(expiresAtMs).toISOString(),
    demo: demo === '1',
  };

  return now > expiresAtMs
    ? { status: 'expired', summary }
    : { status: 'ready', summary };
}

export function getPreviewObservations(summary: SafeShareSummary): string[] {
  if (summary.demo) {
    return [
      'Passport requested before contract',
      'Company name and address missing',
      'Contact limited to Telegram',
    ];
  }
  if (summary.findingIds.length === 0) {
    return ['No prototype signals were observed in the submitted text.'];
  }
  return summary.findingIds.slice(0, 3).map((id) => safeFindingCopy[id].observed);
}

export function getRecipientChecks(summary: SafeShareSummary): string[] {
  if (summary.demo) {
    return [
      'The legal company is not named.',
      'A passport is requested before a contract.',
      'Flight and housing would be controlled by the recruiter.',
    ];
  }
  if (summary.findingIds.length === 0) {
    return [
      'The legal employer identity still needs an independent check.',
      'The written role, salary and location terms still need confirmation.',
      'Sensitive documents should stay private until the recipient is verified.',
    ];
  }
  return summary.findingIds.slice(0, 3).map((id) => safeFindingCopy[id].recipient);
}

export function buildPrivateShareText(summary: SafeShareSummary): string {
  const observations = getPreviewObservations(summary).map((item) => `• ${item}`).join('\n');
  return [
    'Verify Before You Go — private evidence summary',
    `${summary.findingIds.length} of ${summary.checkedRuleCount} signal types found.`,
    '',
    'Observed:',
    observations,
    '',
    'Still unverified: legal employer, written contract and workplace address.',
    'This summary is not a verdict. Full identifiers and the original screenshot are hidden.',
  ].join('\n');
}

export function formatShareExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' }).format(new Date(expiresAt));
}

function uniqueAllowedFindingIds(values: readonly string[]): AnalysisFindingId[] {
  const result: AnalysisFindingId[] = [];
  for (const value of values) {
    if (!findingIdSet.has(value) || result.includes(value as AnalysisFindingId)) continue;
    result.push(value as AnalysisFindingId);
  }
  return result;
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
