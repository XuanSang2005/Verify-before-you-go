import { createHash } from 'node:crypto';

import {
  ANALYSIS_RULE_VERSION,
  type AnalyseOfferRequest,
  type AnalyseOfferResponse,
  type AnalysisFinding,
  type AnalysisFindingId,
  type FindingEvidence,
} from '@vbyg/contracts';

const CHECKED_RULE_COUNT = 9 as const;
const SAFETY_STATEMENT =
  'These are observed signals, not a verdict. Verify the employer, recruiter and offer through independent official sources before acting.' as const;

type RuleResult = AnalysisFinding | undefined;

interface PassageMatch {
  text: string;
  start: number;
  end: number;
}

export function analyseOffer(input: AnalyseOfferRequest): AnalyseOfferResponse {
  const postingText = input.postingText ?? '';
  const recruitmentLink = input.recruitmentLink ?? '';
  const findings = [
    urgencyRule(postingText),
    identityDocumentRule(postingText),
    upfrontPaymentRule(postingText),
    offPlatformRule(postingText),
    missingEmployerRule(postingText),
    licenceClaimRule(postingText),
    shortenedLinkRule(postingText, recruitmentLink),
    salaryClaimRule(postingText),
    independentContactRule(postingText),
  ].filter((finding): finding is AnalysisFinding => Boolean(finding));

  const markedPassages = findings.flatMap((finding) => {
    if (finding.evidence.kind !== 'passage' || finding.evidence.source !== 'postingText') return [];
    return [{
      findingId: finding.id,
      text: finding.evidence.text,
      start: finding.evidence.start,
      end: finding.evidence.end,
    }];
  });

  return {
    analysisId: buildAnalysisId(input),
    ruleVersion: ANALYSIS_RULE_VERSION,
    observedSignalCount: findings.length,
    checkedRuleCount: CHECKED_RULE_COUNT,
    findings,
    markedPassages,
    unknownInformation: buildUnknownInformation(postingText, input.screenshotProvided),
    safetyStatement: SAFETY_STATEMENT,
    ...(input.screenshotProvided
      ? { screenshotNote: 'The selected screenshot was not uploaded or read. Only accompanying text and the recruitment link were analysed.' }
      : {}),
  };
}

function urgencyRule(text: string): RuleResult {
  const match = findPassage(text, /\b(?:urgent(?:ly)?|immediate(?:ly)?|today|act now|this week|only\s+\d+\s+(?:places?|slots?)\s+left)\b/i);
  if (!match || isNegatedContext(text, match)) return undefined;
  return passageFinding({
    id: 'urgency-pressure',
    observedPattern: 'Time pressure or artificial scarcity',
    match,
    explanation: 'Compressed deadlines can reduce the time available to compare the offer with independent records or ask detailed questions.',
    unknownInformation: ['Whether the deadline reflects a documented recruitment schedule.', 'Whether the role will remain available while checks are completed.'],
    verificationSteps: ['Ask for the closing date and recruitment timeline in writing.', 'Pause before sending documents or money and verify the employer through a separately found channel.'],
  });
}

function identityDocumentRule(text: string): RuleResult {
  const match = findPassage(
    text,
    /\b(?:send|share|upload|provide|submit)\b[^.\n]{0,100}\b(?:passport(?:\s+(?:scan|photo|copy))?|identity card|national id|id document)\b|\b(?:passport(?:\s+(?:scan|photo|copy))?|identity card|national id|id document)\b[^.\n]{0,100}\b(?:must be sent|is required|send it|share it|upload it)\b/i,
  );
  if (!match || isNegatedContext(text, match) || hasNonApplicantActor(text, match)) return undefined;
  return passageFinding({
    id: 'identity-document-request',
    observedPattern: 'Identity document requested before verification',
    match,
    explanation: 'Identity documents contain information that can be reused. A request before a verified employer and written contract are established deserves independent checking.',
    unknownInformation: ['Who would receive and retain the document copy.', 'What deletion, access and data-protection process would apply.'],
    verificationSteps: ['Do not send the document until the legal employer and purpose are confirmed.', 'Ask for a written privacy notice and verify the request through the employer’s independently published contact details.'],
  });
}

function upfrontPaymentRule(text: string): RuleResult {
  const match = findPassage(
    text,
    /\b(?:pay|send|transfer)\b[^.\n]{0,70}(?:[$€£]|usd|eur|pln|vnd|riel)?\s*[\d,.]*[^.\n]{0,35}\b(?:processing|application|placement|recruitment|reservation|transport|service)?\s*(?:fee|deposit|charge|payment)\b|(?:[$€£]|usd|eur|pln|vnd|riel)\s*[\d,.]+[^.\n]{0,50}\b(?:fee|deposit|charge|payment)\b|\b(?:processing|application|placement|recruitment|reservation|transport|service)\s+(?:fee|deposit|charge|payment)\b/i,
  );
  if (!match) return undefined;
  const paymentContext = text.slice(Math.max(0, match.start - 45), Math.min(text.length, match.end + 35));
  if (isNegatedContext(text, match) || /\b(?:no|without)\b[^.\n]{0,45}\b(?:fee|payment|deposit|charge)\b|\b(?:fee|charge)\b[^.\n]{0,20}\bnot charged\b/i.test(paymentContext)) {
    return undefined;
  }
  return passageFinding({
    id: 'upfront-payment-request',
    observedPattern: 'Payment requested during recruitment',
    match,
    explanation: 'A payment request shifts financial exposure to the applicant before the employer, contract and service have been independently confirmed.',
    unknownInformation: ['The legal basis, recipient and refund terms for the payment.', 'Whether the fee is permitted under the relevant recruitment rules.'],
    verificationSteps: ['Do not transfer money while these details remain unverified.', 'Ask for an itemised invoice and check the fee with a labour authority or licensed recruitment registry reached independently.'],
  });
}

function offPlatformRule(text: string): RuleResult {
  const match = findPassage(
    text,
    /\b(?:contact|message|reach|apply|chat|reply|dm)\b[^.\n]{0,70}\b(?:telegram|whatsapp|wechat|signal)\b(?:\s*:?\s*@?[a-z0-9_.+-]+)?/i,
  );
  if (!match || isNegatedContext(text, match)) return undefined;
  return passageFinding({
    id: 'off-platform-contact',
    observedPattern: 'Recruitment moved to a personal messaging channel',
    match,
    explanation: 'A personal handle does not by itself establish that the sender is authorised to hire for the named employer.',
    unknownInformation: ['Whether the account belongs to an authorised recruiter.', 'Whether the employer has a durable record of the conversation.'],
    verificationSteps: ['Ask for an email from the employer’s own domain.', 'Call a number found independently on the employer or official registry website and confirm the recruiter’s name.'],
  });
}

function missingEmployerRule(text: string): RuleResult {
  if (!text || hasNamedEmployer(text)) return undefined;
  return {
    id: 'missing-employer-identity',
    observedPattern: 'No identifiable legal employer found',
    evidence: {
      kind: 'absence',
      description: 'The submitted text does not identify a legal employer using an employer field or recognisable legal company name.',
    },
    explanation: 'Without a legal name, an applicant cannot reliably compare the offer with a business registry, licence record or independently published contact details.',
    unknownInformation: ['The employer’s full legal name, registration number and office address.', 'Which legal entity would sign and enforce the employment contract.'],
    verificationSteps: ['Ask for the full legal employer name and registration number.', 'Search those details in the destination country’s official business registry without using a recruiter-provided link.'],
  };
}

function licenceClaimRule(text: string): RuleResult {
  const match = findPassage(text, /\b(?:fully licensed|licensed recruiter|licensed agency|government approved|certified agency|accredited recruiter)\b/i);
  if (!match || isNegatedContext(text, match)) return undefined;
  const nearby = text.slice(Math.max(0, match.start - 80), Math.min(text.length, match.end + 120));
  if (/\b(?:licen[cs]e|registration|certificate)\s*(?:number|no\.?|#)\s*[:#-]?\s*[a-z0-9-]{4,}\b/i.test(nearby)) return undefined;
  return passageFinding({
    id: 'unverifiable-licence-claim',
    observedPattern: 'Licence or approval claim without a checkable identifier',
    match,
    explanation: 'A licence claim cannot be independently matched when no issuing authority or record number is supplied.',
    unknownInformation: ['Which authority issued the claimed approval.', 'The licence number, status, legal holder and expiry date.'],
    verificationSteps: ['Ask for the issuing authority and complete licence number.', 'Open the authority’s registry independently and compare the legal name, address and current status.'],
  });
}

function shortenedLinkRule(text: string, recruitmentLink: string): RuleResult {
  const shortenerPattern = /https?:\/\/(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|buff\.ly|is\.gd|cutt\.ly)\/[^\s)]+/i;
  const textMatch = findPassage(text, shortenerPattern);
  if (textMatch && !isNegatedContext(text, textMatch)) {
    return passageFinding({
      id: 'shortened-link',
      observedPattern: 'Destination hidden behind a shortened link',
      match: textMatch,
      explanation: 'A shortened address conceals the destination domain until it is opened, making it harder to compare with an official employer site first.',
      unknownInformation: ['The final destination and who controls that domain.', 'Whether the destination matches an independently located employer page.'],
      verificationSteps: ['Do not sign in or upload documents through the shortened link.', 'Find the employer website or vacancy page through an independent search and compare the domains.'],
    });
  }
  const linkMatch = findPassage(recruitmentLink, shortenerPattern);
  if (!linkMatch) return undefined;
  return passageFinding({
    id: 'shortened-link',
    observedPattern: 'Destination hidden behind a shortened link',
    match: linkMatch,
    source: 'recruitmentLink',
    explanation: 'A shortened address conceals the destination domain until it is opened, making it harder to compare with an official employer site first.',
    unknownInformation: ['The final destination and who controls that domain.', 'Whether the destination matches an independently located employer page.'],
    verificationSteps: ['Do not sign in or upload documents through the shortened link.', 'Find the employer website or vacancy page through an independent search and compare the domains.'],
  });
}

function salaryClaimRule(text: string): RuleResult {
  const match = findPassage(
    text,
    /\b(?:salary|wage|pay rate|compensation)\b\s*:[^.\n]{0,120}|\b(?:earn|paid?)\b[^.\n]{0,60}(?:[$€£]|usd|eur|pln|vnd|riel)\s*[\d,.]+[^.\n]{0,35}\bper\s+(?:hour|day|week|month|year)\b/i,
  );
  if (!match || isNegatedContext(text, match) || /\b(?:fee|deposit|charge|processing|placement|application)\b/i.test(match.text)) return undefined;
  const hasSupportingTerms = /\b(?:contract|hours? per week|working hours?|gross|net pay|before tax|after tax|overtime rate)\b/i.test(text);
  if (hasSupportingTerms) return undefined;
  return passageFinding({
    id: 'unsupported-salary-claim',
    observedPattern: 'Salary claim without supporting employment terms',
    match,
    explanation: 'A salary figure is difficult to compare when working hours, deductions, contract type and base-versus-bonus terms are missing.',
    unknownInformation: ['Whether the amount is gross or net and whether bonuses are guaranteed.', 'The working hours, deductions, overtime terms and payment schedule.'],
    verificationSteps: ['Ask for base pay, working hours and every deduction in a written contract.', 'Compare the same role and location on two independent job sources.'],
  });
}

function independentContactRule(text: string): RuleResult {
  const match = findPassage(
    text,
    /\b(?:do not|don't|never|avoid)\s+(?:contact|call|email|visit)[^.\n]{0,90}\b(?:company|employer|embassy|agency|office|authorit(?:y|ies)|official organisation|official organization)\b[^.\n]*/i,
  );
  if (!match) return undefined;
  return passageFinding({
    id: 'discourages-independent-contact',
    observedPattern: 'Pressure not to contact an independent organisation',
    match,
    explanation: 'Discouraging outside contact removes a direct way to test whether the recruiter and offer are recognised by the organisation concerned.',
    unknownInformation: ['Why independent contact is being discouraged.', 'Whether the employer or relevant authority recognises the recruiter and vacancy.'],
    verificationSteps: ['Use contact details found independently, not numbers or links supplied in the message.', 'Ask the organisation to confirm the recruiter, role and requested documents in writing.'],
  });
}

function passageFinding(input: {
  id: AnalysisFindingId;
  observedPattern: string;
  match: PassageMatch;
  explanation: string;
  unknownInformation: string[];
  verificationSteps: string[];
  source?: 'postingText' | 'recruitmentLink';
}): AnalysisFinding {
  const evidence: FindingEvidence = {
    kind: 'passage',
    source: input.source ?? 'postingText',
    text: input.match.text,
    start: input.match.start,
    end: input.match.end,
  };
  return {
    id: input.id,
    observedPattern: input.observedPattern,
    evidence,
    explanation: input.explanation,
    unknownInformation: input.unknownInformation,
    verificationSteps: input.verificationSteps,
  };
}

function findPassage(text: string, pattern: RegExp): PassageMatch | undefined {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return undefined;
  const leadingWhitespace = match[0].length - match[0].trimStart().length;
  const passage = match[0].trim();
  const start = match.index + leadingWhitespace;
  return { text: passage, start, end: start + passage.length };
}

function isNegatedContext(text: string, match: PassageMatch): boolean {
  const sentenceStart = Math.max(
    text.lastIndexOf('.', match.start - 1),
    text.lastIndexOf('!', match.start - 1),
    text.lastIndexOf('?', match.start - 1),
    text.lastIndexOf('\n', match.start - 1),
  );
  const prefix = text.slice(Math.max(sentenceStart + 1, match.start - 120), match.start);
  const contrastiveBreaks = [...prefix.matchAll(/\b(?:but|however|yet|nevertheless)\b/gi)];
  const lastContrastiveBreak = contrastiveBreaks.at(-1);
  const scopedPrefix = lastContrastiveBreak?.index === undefined
    ? prefix
    : prefix.slice(lastContrastiveBreak.index + lastContrastiveBreak[0].length);
  return /\b(?:not|never|no longer|do not|does not|did not|don't|doesn't|didn't|will not|won't|without)\b/i.test(scopedPrefix);
}

function hasNonApplicantActor(text: string, match: PassageMatch): boolean {
  const prefix = text.slice(Math.max(0, match.start - 70), match.start);
  return /\b(?:we|the\s+employer|the\s+company|the\s+recruiter|the\s+agency)\s+(?:(?:must|will|should|can|may|shall|needs?\s+to|is\s+required\s+to)\s+)?$/i.test(prefix);
}

function hasNamedEmployer(text: string): boolean {
  return (
    /\b(?:employer|company|legal entity|organisation|organization)\s*(?:name)?\s*:\s*[a-z0-9]/i.test(text) ||
    /\b[a-z0-9][a-z0-9&.,' -]{1,60}\s(?:ltd\.?|limited|llc|inc\.?|corp\.?|gmbh|s\.a\.?|sp\.\s*z\s*o\.o\.)\b/i.test(text)
  );
}

function buildUnknownInformation(text: string, screenshotProvided: boolean): string[] {
  const unknown = [
    'The employer’s legal registration, current status and independently published contact details have not been confirmed by this analysis.',
    'The recruiter’s identity and authority to hire have not been independently confirmed.',
    'The written contract, visa route, working conditions and deductions remain unverified unless checked with official sources.',
  ];
  if (!hasNamedEmployer(text)) {
    unknown.unshift('A complete legal employer name was not identified in the submitted text.');
  }
  if (screenshotProvided) {
    unknown.push('The screenshot content remains unknown because no OCR or upload was performed.');
  }
  return unknown;
}

function buildAnalysisId(input: AnalyseOfferRequest): string {
  const canonical = JSON.stringify({
    postingText: input.postingText ?? '',
    recruitmentLink: input.recruitmentLink ?? '',
    screenshotProvided: input.screenshotProvided,
    ruleVersion: ANALYSIS_RULE_VERSION,
  });
  return `analysis-${createHash('sha256').update(canonical).digest('hex').slice(0, 16)}`;
}
