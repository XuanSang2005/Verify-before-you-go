import type { ReportDraft, ReportIdentifierType } from './report-model';

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const handlePattern = /(^|[^\p{L}\p{N}_@])@([A-Z0-9_](?:[A-Z0-9_.-]{1,}[A-Z0-9_])?)\b/giu;
const phonePattern = /(?:\+?\d[\d\s().-]{6,}\d)/gu;
const identityNumberPattern = /\b(passport|identity\s*(?:card|document)|national\s*id)\s*(?:number|no\.?|#)?\s*[:#-]?\s*(?=[A-Z0-9 .-]*\d)[A-Z0-9]{1,12}(?:(?:[ -]+|\.(?=[A-Z0-9]))[A-Z0-9]{1,12}){0,3}\b/giu;
const homeAddressPattern = /\b(home\s+address|residential\s+address)\s*(?::|-)?\s*[^\n.!?]+/giu;
const webUrlPattern = /https?:\/\/[^\s]+/giu;
const schemelessDomainPattern = /(?<!@)\b(?:www\.)?(?:[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?\.)+[A-Z]{2,}(?:[/?#][^\s]*)?/giu;
const labelledPaymentReferencePattern = /\b(?:payment|transaction)\s+(?:reference|ref)\s*(?::|#|-)?\s*[A-Z0-9][A-Z0-9 ._-]{2,}[A-Z0-9]\b/giu;
const shortStandaloneIdentifierPattern = /^@?[A-Z0-9][A-Z0-9._-]{2,7}$/u;

export interface ReportRedactionPreview {
  privateEvidence: string;
  possiblePublicVersion: string;
  hiddenSummary: string;
}

export function createReportRedactionPreview(draft: ReportDraft): ReportRedactionPreview {
  const privateEvidence = draft.identifier.trim() || 'No identifier added';
  const identifierPreview = redactReportIdentifier(draft.identifierType, draft.identifier);
  const descriptionPreview = redactSensitiveReportText(draft.description.trim());
  const possiblePublicVersion = [identifierPreview, descriptionPreview]
    .filter(Boolean)
    .join('. ')
    || 'No public text prepared';

  return {
    privateEvidence,
    possiblePublicVersion,
    hiddenSummary: getHiddenSummary(draft),
  };
}

export function redactReportIdentifier(type: ReportIdentifierType, rawIdentifier: string): string {
  const identifier = rawIdentifier.trim();
  if (!identifier) return '';
  if (type === 'handle') return `Messaging handle ending ${maskedEnding(identifier.replace(/^@/u, ''))}`;
  if (type === 'phone') return `Phone ending ${maskedEnding(identifier.replace(/\D/gu, ''))}`;
  if (type === 'payment-account') return `Payment reference ending ${maskedEnding(identifier.replace(/\s/gu, ''))}`;
  if (type === 'url') return redactUrl(identifier);
  return redactSensitiveReportText(identifier);
}

export function redactSensitiveReportText(value: string): string {
  return value
    .replace(identityNumberPattern, '[identity document number hidden]')
    .replace(homeAddressPattern, '[home address hidden]')
    .replace(emailPattern, '[email hidden]')
    .replace(handlePattern, (_match, prefix: string, handle: string) => `${prefix}Messaging handle ending ${maskedEnding(handle)}`)
    .replace(phonePattern, (phone) => `Phone ending ${maskedEnding(phone.replace(/\D/gu, ''))}`)
    .replace(webUrlPattern, (url) => redactUrl(url))
    .replace(schemelessDomainPattern, (url) => redactUrl(url));
}

export function containsDirectIdentifier(value: string): boolean {
  const candidate = value
    .replace(/\[(?:email|home address|identity document number) hidden\]/giu, '')
    .replace(/(?:Messaging handle|Phone|Payment reference) ending\s+•{4,}[\p{L}\p{N}]{0,4}/giu, '')
    .replace(/Link on\s+(?:[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?\.)+[A-Z]{2,}/giu, '');
  const matchesPhone = [...candidate.matchAll(phonePattern)].some(([match]) => match.replace(/\D/gu, '').length >= 7);
  return hasPattern(emailPattern, candidate)
    || hasPattern(handlePattern, candidate)
    || hasPattern(identityNumberPattern, candidate)
    || hasPattern(homeAddressPattern, candidate)
    || hasPattern(webUrlPattern, candidate)
    || hasPattern(schemelessDomainPattern, candidate)
    || hasPattern(labelledPaymentReferencePattern, candidate)
    || matchesPhone
    || shortStandaloneIdentifierPattern.test(candidate.trim());
}

function redactUrl(value: string): string {
  try {
    const normalized = /^https?:\/\//iu.test(value) ? value : `https://${value}`;
    const url = new URL(normalized);
    return `Link on ${url.hostname}`;
  } catch {
    return 'Recruitment link details hidden';
  }
}

function maskedEnding(value: string): string {
  const normalized = value.replace(/[^\p{L}\p{N}]/gu, '');
  if (normalized.length < 7) return '••••';
  const suffixLength = normalized.length >= 8 ? 4 : 2;
  return `••••${normalized.slice(-suffixLength)}`;
}

function getHiddenSummary(draft: ReportDraft): string {
  const details: string[] = [];
  if (draft.identifierType === 'handle') details.push('full handle');
  if (draft.identifierType === 'phone') details.push('full phone number');
  if (draft.identifierType === 'payment-account') details.push('full payment reference');
  if (draft.identifierType === 'url') details.push('link path and query');
  if (hasPattern(emailPattern, draft.description)) details.push('email');
  if (hasPattern(identityNumberPattern, draft.description)) details.push('identity-document number');
  if (hasPattern(homeAddressPattern, draft.description)) details.push('home address');
  if (hasPattern(webUrlPattern, draft.description) || hasPattern(schemelessDomainPattern, draft.description)) details.push('link path and query');
  return details.length ? `${[...new Set(details)].join(' + ')} hidden` : 'Direct identifiers checked';
}

function hasPattern(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}
