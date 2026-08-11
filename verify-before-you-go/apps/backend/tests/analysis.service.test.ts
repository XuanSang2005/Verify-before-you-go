import assert from 'node:assert/strict';
import test from 'node:test';

import { AnalyseOfferResponseSchema } from '@vbyg/contracts';
import type { AnalyseOfferRequest, AnalysisFindingId } from '@vbyg/contracts';

import { analyseOffer } from '../src/modules/analysis/analysis.service.js';

const postingWithSignals = `URGENT HIRING — CUSTOMER SUPPORT (ENGLISH / CHINESE)

Location: Sihanoukville, Cambodia
Salary: USD 2,000–3,000 per month plus a monthly bonus

Immediate start. Contact the recruiter through Telegram today. Shortlisted applicants should send a passport scan and reserve transport with a USD 150 processing payment. Do not contact the company office because the recruiter will handle every step.`;

const completePosting = `WAREHOUSE PACKING ASSISTANT

Location: Poznań, Poland
Employer: Example Logistics Sp. z o.o.
Contract: Six-month fixed term, 40 hours per week
Salary: PLN 5,200 gross per month

Applications close 30 September. Apply through the employer careers page. Candidates can compare the legal company name and registration number in the official business registry. No application or placement fee is charged.`;

test('deterministic analysis returns transparent findings and valid marked offsets', () => {
  const input = {
    postingText: postingWithSignals,
    recruitmentLink: 'https://jobs.example.org/synthetic/customer-support-0412',
    screenshotProvided: false,
  };
  const first = AnalyseOfferResponseSchema.parse(analyseOffer(input));
  const second = analyseOffer(input);
  assert.deepEqual(second, first);
  assert.equal(first.observedSignalCount, 7);
  assert.equal(first.findings.length, 7);
  assert.ok(first.findings.some((finding) => finding.id === 'identity-document-request'));
  assert.ok(first.findings.some((finding) => finding.id === 'discourages-independent-contact'));
  for (const passage of first.markedPassages) {
    assert.equal(postingWithSignals.slice(passage.start, passage.end), passage.text);
  }
});

test('complete synthetic posting does not trigger the nine prototype rules', () => {
  const result = analyseOffer({
    postingText: completePosting,
    recruitmentLink: 'https://careers.example.org/synthetic/warehouse-packing',
    screenshotProvided: false,
  });
  assert.equal(result.observedSignalCount, 0);
  assert.deepEqual(result.findings, []);
});

test('screenshot-only analysis states that no image content was read', () => {
  const result = analyseOffer({ screenshotProvided: true });
  assert.equal(result.observedSignalCount, 0);
  assert.match(result.screenshotNote ?? '', /not uploaded or read/i);
  assert.ok(result.unknownInformation.some((item) => /no OCR/i.test(item)));
});

test('analysis language contains no prohibited conclusion or numerical rating', () => {
  const result = analyseOffer({ postingText: postingWithSignals, screenshotProvided: false });
  const language = [
    result.safetyStatement,
    ...result.unknownInformation,
    ...result.findings.flatMap((finding) => [
      finding.observedPattern,
      finding.explanation,
      ...finding.unknownInformation,
      ...finding.verificationSteps,
    ]),
  ].join(' ');
  assert.doesNotMatch(language, /\b(?:is a scam|is fraudulent|safe offer|unsafe offer|safety percentage|risk score|risk level|verdict:)\b/i);
  assert.match(result.safetyStatement, /not a verdict/i);
});

const positiveRuleFixtures: { id: AnalysisFindingId; input: AnalyseOfferRequest }[] = [
  { id: 'urgency-pressure', input: { postingText: 'Employer: Acme Ltd. URGENT applications required today.', screenshotProvided: false } },
  { id: 'identity-document-request', input: { postingText: 'Employer: Acme Ltd. Send a passport photo to reserve your application.', screenshotProvided: false } },
  { id: 'upfront-payment-request', input: { postingText: 'Employer: Acme Ltd. Pay a USD 50 processing fee.', screenshotProvided: false } },
  { id: 'off-platform-contact', input: { postingText: 'Employer: Acme Ltd. Contact the recruiter on Telegram: @acme_jobs.', screenshotProvided: false } },
  { id: 'missing-employer-identity', input: { postingText: 'Warehouse role in Poznań. Applications close next month.', screenshotProvided: false } },
  { id: 'unverifiable-licence-claim', input: { postingText: 'Employer: Acme Ltd. We are a fully licensed recruitment agency.', screenshotProvided: false } },
  { id: 'shortened-link', input: { recruitmentLink: 'https://bit.ly/acme-role', screenshotProvided: false } },
  { id: 'unsupported-salary-claim', input: { postingText: 'Employer: Acme Ltd. Salary: USD 4,000 per month.', screenshotProvided: false } },
  { id: 'discourages-independent-contact', input: { postingText: 'Employer: Acme Ltd. Do not contact the employer office about this role.', screenshotProvided: false } },
];

const negativeRuleFixtures: { id: AnalysisFindingId; input: AnalyseOfferRequest }[] = [
  { id: 'urgency-pressure', input: { postingText: 'Employer: Acme Ltd. This role is not urgent. Applications close next month.', screenshotProvided: false } },
  { id: 'identity-document-request', input: { postingText: 'Employer: Acme Ltd. We never ask candidates to send a passport.', screenshotProvided: false } },
  { id: 'upfront-payment-request', input: { postingText: 'Employer: Acme Ltd. Pay: USD 20 per hour. Contract: full-time, 40 hours per week.', screenshotProvided: false } },
  { id: 'off-platform-contact', input: { postingText: 'Employer: Acme Ltd. We never ask candidates to contact us on Telegram.', screenshotProvided: false } },
  { id: 'missing-employer-identity', input: { postingText: 'Employer: Acme Ltd. Contract: full-time.', screenshotProvided: false } },
  { id: 'unverifiable-licence-claim', input: { postingText: 'Employer: Acme Ltd. Licensed agency. Licence number: ABCD-1234.', screenshotProvided: false } },
  { id: 'shortened-link', input: { recruitmentLink: 'https://careers.acme.example/role', screenshotProvided: false } },
  { id: 'unsupported-salary-claim', input: { postingText: 'Employer: Acme Ltd. Salary: USD 20 per hour. Contract: full-time, 40 hours per week.', screenshotProvided: false } },
  { id: 'discourages-independent-contact', input: { postingText: 'Employer: Acme Ltd. Contact the employer office independently to verify this role.', screenshotProvided: false } },
];

for (const fixture of positiveRuleFixtures) {
  test(`positive fixture creates ${fixture.id}`, () => {
    const result = analyseOffer(fixture.input);
    assert.ok(result.findings.some((finding) => finding.id === fixture.id));
  });
}

for (const fixture of negativeRuleFixtures) {
  test(`negative or negated fixture does not create ${fixture.id}`, () => {
    const result = analyseOffer(fixture.input);
    assert.equal(result.findings.some((finding) => finding.id === fixture.id), false);
  });
}

test('fee request is not mistaken for an unsupported salary claim', () => {
  const result = analyseOffer({
    postingText: 'Employer: Acme Ltd. Pay a USD 50 processing fee.',
    screenshotProvided: false,
  });
  assert.ok(result.findings.some((finding) => finding.id === 'upfront-payment-request'));
  assert.equal(result.findings.some((finding) => finding.id === 'unsupported-salary-claim'), false);
});

test('one negated sentence suppresses urgency, identity-document and off-platform findings', () => {
  const result = analyseOffer({
    postingText: 'Employer: Acme Ltd. This role is not urgent. We never ask candidates to send a passport or contact us on Telegram.',
    screenshotProvided: false,
  });
  const ids = result.findings.map((finding) => finding.id);
  assert.equal(ids.includes('urgency-pressure'), false);
  assert.equal(ids.includes('identity-document-request'), false);
  assert.equal(ids.includes('off-platform-contact'), false);
});

test('negation scope ends at a contrastive clause', () => {
  const result = analyseOffer({
    postingText: 'Employer: Acme Ltd. We do not charge fees, but contact the recruiter on Telegram today.',
    screenshotProvided: false,
  });
  const ids = result.findings.map((finding) => finding.id);
  assert.ok(ids.includes('off-platform-contact'));
  assert.ok(ids.includes('urgency-pressure'));
  assert.equal(ids.includes('upfront-payment-request'), false);
});

test('identity-document rule attributes the send action to its grammatical actor', () => {
  const employerSends = analyseOffer({
    postingText: 'Employer: Acme Ltd. The employer must send its passport copy to the candidate.',
    screenshotProvided: false,
  });
  const candidateSends = analyseOffer({
    postingText: 'Employer: Acme Ltd. Candidates must send a passport copy to the recruiter.',
    screenshotProvided: false,
  });
  assert.equal(employerSends.findings.some((finding) => finding.id === 'identity-document-request'), false);
  assert.ok(candidateSends.findings.some((finding) => finding.id === 'identity-document-request'));
});

test('negative contract wording stays evidence-based and never becomes a verdict', () => {
  const result = analyseOffer({
    postingText: 'Employer: Acme Ltd. No written contract is available yet. Contact the recruiter on Telegram today.',
    screenshotProvided: false,
  });
  const output = JSON.stringify(result);
  assert.doesNotMatch(output, /\b(?:is a scam|is fraudulent|safe offer|unsafe offer|risk score|risk level|verdict:)\b/i);
  assert.match(result.safetyStatement, /not a verdict/i);
});

test('marked offsets point into the exact raw submitted text', () => {
  const raw = '  URGENT hiring at Acme Ltd.';
  const result = analyseOffer({ postingText: raw, screenshotProvided: false });
  const passage = result.markedPassages.find((item) => item.findingId === 'urgency-pressure');
  assert.ok(passage);
  assert.equal(passage.start, 2);
  assert.equal(raw.slice(passage.start, passage.end), passage.text);
});

test('official single-line sample still returns all seven intended signals', () => {
  const result = analyseOffer({
    postingText: 'URGENT HIRING — CUSTOMER SUPPORT. Location: Sihanoukville. Salary: USD 2,500 per month. Immediate start. Contact us on Telegram today. Send a passport photo and make a USD 150 processing payment. Do not contact the company office.',
    recruitmentLink: 'https://jobs.example.org/posting',
    screenshotProvided: false,
  });
  assert.equal(result.observedSignalCount, 7);
});
