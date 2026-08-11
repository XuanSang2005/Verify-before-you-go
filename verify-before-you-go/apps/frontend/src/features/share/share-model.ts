import {
  ANALYSIS_FINDING_IDS,
  SHARE_TOKEN_MAX_LENGTH,
  SHARE_TOKEN_SCHEMA_VERSION,
  ShareTokenSchema,
  type AnalyseOfferResponse,
  type AnalysisFindingId,
  type ShareTokenVerificationResponse,
} from '@vbyg/contracts';

export const SHARE_SCHEMA_VERSION = SHARE_TOKEN_SCHEMA_VERSION;
export const MAX_RECIPIENT_URL_LENGTH = 2_300;

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
  demo: boolean;
};

export type VerifiedSafeShareSummary = SafeShareSummary & {
  issuedAt: string;
  expiresAt: string;
};

export type RecipientShareParams = Record<string, string | string[] | undefined>;

export type RecipientShareParseResult =
  | { status: 'ready'; token: string }
  | { status: 'invalid' };

export function createSafeShareSummary(
  analysis: AnalyseOfferResponse | undefined,
): SafeShareSummary {
  const findingIds = analysis
    ? uniqueAllowedFindingIds(analysis.findings.map((finding) => finding.id))
    : [...demoFindingIds];

  return {
    schemaVersion: SHARE_SCHEMA_VERSION,
    findingIds,
    checkedRuleCount: MAX_CHECKED_RULES,
    demo: !analysis,
  };
}

export function createRecipientShareParams(token: string): Record<string, string> {
  return { token: ShareTokenSchema.parse(token) };
}

export function parseRecipientShareParams(
  params: RecipientShareParams,
): RecipientShareParseResult {
  const keys = Object.keys(params).filter((key) => params[key] !== undefined);
  if (keys.length !== 1 || keys[0] !== 'token') return { status: 'invalid' };
  const token = singleValue(params.token);
  if (!token || token.length > SHARE_TOKEN_MAX_LENGTH) return { status: 'invalid' };
  const estimatedUrlLength = '/share/recipient?token='.length + encodeURIComponent(token).length;
  if (estimatedUrlLength > MAX_RECIPIENT_URL_LENGTH) return { status: 'invalid' };
  const parsed = ShareTokenSchema.safeParse(token);
  return parsed.success ? { status: 'ready', token: parsed.data } : { status: 'invalid' };
}

export function toVerifiedSafeShareSummary(
  response: ShareTokenVerificationResponse,
): VerifiedSafeShareSummary {
  return {
    schemaVersion: response.schemaVersion,
    findingIds: [...response.findingIds],
    checkedRuleCount: response.checkedRuleCount,
    issuedAt: response.issuedAt,
    expiresAt: response.expiresAt,
    demo: response.demo,
  };
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
