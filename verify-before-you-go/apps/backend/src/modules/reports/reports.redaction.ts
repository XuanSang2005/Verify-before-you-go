import type { ReportIdentifierType } from '@vbyg/contracts';

const ZERO_WIDTH_AND_FORMAT = /\p{Cf}/gu;
const emailPattern = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}(?![\p{L}\p{N}.-])/giu;
const handlePattern = /(^|[^\p{L}\p{N}_@])@[\p{L}\p{N}_](?:[\p{L}\p{N}_.-]*[\p{L}\p{N}_])?/giu;
const phonePattern = /(?<!\p{L})\+?\p{Nd}(?:[\p{Nd}\s().-]{5,})\p{Nd}(?!\p{L})/gu;
const labelledIdentityPattern = /\b(?:passport|identity\s*(?:card|document)|national\s*id)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[\p{L}\p{N}](?:[\p{L}\p{N} .-]{3,})[\p{L}\p{N}]/giu;
const genericIdentityPattern = /(?<![\p{L}\p{N}])(?=[\p{L}\p{N}]{6,24}(?![\p{L}\p{N}]))(?=[\p{L}\p{N}]*\p{L})(?=[\p{L}\p{N}]*\p{Nd})[\p{L}\p{N}]{6,24}(?![\p{L}\p{N}])/gu;
const homeAddressPattern = /\b(?:home|residential|private)\s+address\s*(?::|-)?\s*[^\n.!?]+/giu;
const webUrlPattern = /\bhttps?:\/\/[^\s<>'"\])}]+/giu;
const schemelessDomainPattern = /(?<![@\p{L}\p{N}])(?:www\.)?(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}]{2,}(?:[/?#][^\s<>'"\])}]*)?/giu;
const labelledPaymentReferencePattern = /\b(?:payment|transaction)\s+(?:reference|ref)\s*(?::|#|-)?\s*[\p{L}\p{N}][\p{L}\p{N} ._-]{2,}[\p{L}\p{N}]\b/giu;

const SAFE_WITHHELD_TEXT = '[private details withheld]';

export function normalizeSensitiveReportText(value: string): string {
  return value.normalize('NFKC').replace(ZERO_WIDTH_AND_FORMAT, '');
}

export function redactReportIdentifierOnServer(type: ReportIdentifierType, rawIdentifier: string): string {
  const identifier = normalizeSensitiveReportText(rawIdentifier).trim();
  if (!identifier) return '[identifier withheld]';
  if (type === 'handle') return '[messaging handle hidden]';
  if (type === 'phone') return '[phone number hidden]';
  if (type === 'payment-account') return '[payment reference hidden]';
  if (type === 'url') return '[recruitment link hidden]';
  return '[claimed entity hidden]';
}

export function redactSensitiveReportTextOnServer(value: string): string {
  const normalized = normalizeSensitiveReportText(value);
  const redacted = normalized
    .replace(labelledIdentityPattern, '[identity document number hidden]')
    .replace(homeAddressPattern, '[private address hidden]')
    .replace(emailPattern, '[email hidden]')
    .replace(handlePattern, (_match) => preserveLeadingDelimiter(_match, '[messaging handle hidden]'))
    .replace(phonePattern, '[phone number hidden]')
    .replace(labelledPaymentReferencePattern, '[payment reference hidden]')
    .replace(webUrlPattern, '[recruitment link hidden]')
    .replace(schemelessDomainPattern, '[recruitment link hidden]')
    .replace(genericIdentityPattern, '[identity number hidden]');
  return containsPotentialDirectIdentifierOnServer(redacted) ? SAFE_WITHHELD_TEXT : redacted;
}

export function containsPotentialDirectIdentifierOnServer(value: string): boolean {
  const normalized = normalizeSensitiveReportText(value);
  return [
    emailPattern,
    handlePattern,
    phonePattern,
    labelledIdentityPattern,
    genericIdentityPattern,
    homeAddressPattern,
    webUrlPattern,
    schemelessDomainPattern,
    labelledPaymentReferencePattern,
  ].some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(normalized);
  });
}

function preserveLeadingDelimiter(match: string, replacement: string): string {
  const first = match[0];
  return first === '@' ? replacement : `${first}${replacement}`;
}
