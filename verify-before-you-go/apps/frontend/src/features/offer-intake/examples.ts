import { ANALYSIS_FINDING_IDS, type AnalysisFindingId } from '@vbyg/contracts';

type ExamplePosting = {
  id: string;
  title: string;
  metadata: string;
  text: string;
  link: string;
  observedFindingIds: readonly AnalysisFindingId[];
};

export const checkedRuleCount = ANALYSIS_FINDING_IDS.length;

export const examplePostings = [
  {
    id: 'customer-support-sihanoukville',
    title: 'Customer support · Sihanoukville',
    metadata: 'Synthetic demo · Text and link',
    text: `URGENT HIRING — CUSTOMER SUPPORT (ENGLISH / CHINESE)

Location: Sihanoukville, Cambodia
Salary: USD 2,000–3,000 per month plus a monthly bonus

Immediate start. Contact the recruiter through Telegram today. Shortlisted applicants should send a passport scan and reserve transport with a USD 150 processing payment. Do not contact the company office because the recruiter will handle every step.`,
    link: 'https://jobs.example.org/synthetic/customer-support-0412',
    observedFindingIds: [
      'urgency-pressure',
      'identity-document-request',
      'upfront-payment-request',
      'off-platform-contact',
      'missing-employer-identity',
      'unsupported-salary-claim',
      'discourages-independent-contact',
    ],
  },
  {
    id: 'warehouse-packing-poznan',
    title: 'Warehouse packing · Poznań',
    metadata: 'Synthetic demo · Complete posting',
    text: `WAREHOUSE PACKING ASSISTANT

Location: Poznań, Poland
Employer: Example Logistics Sp. z o.o.
Contract: Six-month fixed term, 40 hours per week
Salary: PLN 5,200 gross per month

Applications close 30 September. Apply through the employer careers page. Candidates can compare the legal company name and registration number in the official business registry. No application or placement fee is charged.`,
    link: 'https://careers.example.org/synthetic/warehouse-packing',
    observedFindingIds: [],
  },
] as const satisfies readonly ExamplePosting[];
