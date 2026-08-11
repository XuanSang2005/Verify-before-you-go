import type { NewsCategory, NewsSourceStatus } from '@vbyg/contracts';

export type SeedNewsStory = {
  id: string;
  slug: string;
  category: NewsCategory;
  title: string;
  dek: string;
  eyebrow: string;
  bodySections: string[];
  verificationSteps: string[];
  sourceNotes: string[];
  sourceStatus: NewsSourceStatus;
  sourceStatusLabel: string;
  readingMinutes: number;
  isFeatured: boolean;
  publishedAt: Date;
  reviewedAt: Date;
};

export const seedNewsStories: readonly SeedNewsStory[] = [
  {
    id: 'news-featured-verification-guide',
    slug: 'verify-recruiter-before-fee-or-document',
    category: 'guide',
    title: 'Verify a recruiter before any fee or document transfer.',
    dek: 'Start with the legal entity, an independently published contact and a written fee breakdown.',
    eyebrow: 'Editorial guide · Demo',
    bodySections: [
      'A polished message, logo or certificate can help a recruiter look credible, but presentation is not independent evidence. Begin with the employer’s full legal identity and the agency name shown on the written terms.',
      'Find an official registry or employer website without using the recruiter’s link. Compare the legal name, registration number, address and published contact details field by field.',
      'Before paying or sharing identity documents, ask for the role, salary, location, visa route and every fee in writing. A missing answer remains unknown; it is not proof of safety or fraud.',
    ],
    verificationSteps: [
      'Find the legal employer or agency through an independently located official source.',
      'Contact the organisation through a channel published on that independent source.',
      'Compare written role terms and every claimed fee before transferring money or documents.',
    ],
    sourceNotes: [
      'This is synthetic prototype editorial content.',
      'The workflow is educational and does not refer to a live employer, recruiter or official investigation.',
    ],
    sourceStatus: 'synthetic-source-list',
    sourceStatusLabel: 'Demo source list reviewed',
    readingMinutes: 4,
    isFeatured: true,
    publishedAt: new Date('2026-08-03T02:00:00.000Z'),
    reviewedAt: new Date('2026-08-08T02:00:00.000Z'),
  },
  {
    id: 'news-company-impersonation',
    slug: 'company-impersonation-check-the-channel',
    category: 'scam-watch',
    title: 'Company impersonation: check the channel, not the logo.',
    dek: 'Compare the sender with a contact published independently by the claimed employer.',
    eyebrow: 'Scam Watch · Demo pattern',
    bodySections: [
      'A copied logo, staff photograph or email signature can make a message resemble a known company. Those visual details do not establish who controls the account sending the offer.',
      'Treat the message as a lead. Independently locate the claimed employer and ask whether the role, recruiter and contact channel are recognised.',
    ],
    verificationSteps: [
      'Do not use the phone number or link inside the message for the first check.',
      'Compare the sender’s domain and account with independently published contact details.',
      'Ask the employer to confirm the vacancy and recruiter in writing.',
    ],
    sourceNotes: [
      'The company and message pattern in this story are synthetic.',
      'No identified person or organisation is accused.',
    ],
    sourceStatus: 'synthetic-prototype',
    sourceStatusLabel: 'Synthetic pattern only',
    readingMinutes: 3,
    isFeatured: false,
    publishedAt: new Date('2026-08-02T02:00:00.000Z'),
    reviewedAt: new Date('2026-08-07T02:00:00.000Z'),
  },
  {
    id: 'news-seasonal-work-fields',
    slug: 'seasonal-work-six-fields-to-verify',
    category: 'hiring-update',
    title: 'Seasonal-work notice: six fields to verify before applying.',
    dek: 'Employer, role, pay, fees, visa route and official application channel.',
    eyebrow: 'Hiring update · Synthetic demo',
    bodySections: [
      'Seasonal opportunities can change quickly, but speed should not replace written terms. Record the legal employer, job title, work location, pay basis, all fees and the proposed visa route.',
      'Use an official labour or employer channel found independently to confirm how applications are accepted. If the posting omits a field, mark it for verification instead of filling the gap with an assumption.',
    ],
    verificationSteps: [
      'Compare all six fields with a source independent of the recruiter.',
      'Confirm whether any agency licence is current with its issuing authority.',
      'Keep a copy of the written terms you independently confirmed.',
    ],
    sourceNotes: [
      'This is a synthetic hiring notice for prototype testing.',
      'It is not a live vacancy or migration programme announcement.',
    ],
    sourceStatus: 'synthetic-source-list',
    sourceStatusLabel: 'Demo source list reviewed',
    readingMinutes: 3,
    isFeatured: false,
    publishedAt: new Date('2026-08-01T02:00:00.000Z'),
    reviewedAt: new Date('2026-08-07T02:00:00.000Z'),
  },
  {
    id: 'news-no-match',
    slug: 'no-database-match-does-not-mean-safe',
    category: 'mil-explainer',
    title: 'Why “no database match” never means an offer is safe.',
    dek: 'Absence from a watchlist is not independent evidence of legitimacy.',
    eyebrow: 'MIL explainer · Demo',
    bodySections: [
      'Databases are limited by what has been reported, reviewed and published. A new name, account or phone number may have no entry even when important facts remain unverified.',
      'Use a search result as one piece of evidence. Confirm the legal employer, licence, role terms and contact channel through independent sources before making a decision.',
    ],
    verificationSteps: [
      'Write down what the database did and did not check.',
      'Use an official registry and an independently published employer contact.',
      'Keep unknown information visible instead of treating no match as approval.',
    ],
    sourceNotes: [
      'The database example is synthetic and contains no live watchlist data.',
      'No-match language is educational, not a verdict.',
    ],
    sourceStatus: 'synthetic-prototype',
    sourceStatusLabel: 'Synthetic pattern only',
    readingMinutes: 3,
    isFeatured: false,
    publishedAt: new Date('2026-07-31T02:00:00.000Z'),
    reviewedAt: new Date('2026-08-06T02:00:00.000Z'),
  },
  {
    id: 'news-fee-breakdown',
    slug: 'read-a-fee-breakdown-before-paying',
    category: 'guide',
    title: 'Read a complete fee breakdown before paying.',
    dek: 'Name the recipient, purpose, amount, refund terms and official payment channel.',
    eyebrow: 'Practical guide · Demo',
    bodySections: [
      'A salary figure is not a fee explanation. Ask who receives each payment, what service it covers and whether the written contract describes the same amount.',
      'Confirm the payment channel independently. Do not send money merely because a deadline or reservation claim creates pressure.',
    ],
    verificationSteps: [
      'Request every fee and refund term in writing.',
      'Verify the recipient and payment channel independently.',
      'Pause if the written terms and payment request do not match.',
    ],
    sourceNotes: [
      'All payment examples are synthetic prototype content.',
      'This guide is not financial or legal advice.',
    ],
    sourceStatus: 'synthetic-source-list',
    sourceStatusLabel: 'Demo source list reviewed',
    readingMinutes: 3,
    isFeatured: false,
    publishedAt: new Date('2026-07-29T02:00:00.000Z'),
    reviewedAt: new Date('2026-08-05T02:00:00.000Z'),
  },
  {
    id: 'news-written-terms',
    slug: 'written-terms-before-travel',
    category: 'hiring-update',
    title: 'Written terms should arrive before travel begins.',
    dek: 'Confirm the role, location, hours, pay and document process before departure.',
    eyebrow: 'Hiring update · Synthetic demo',
    bodySections: [
      'Travel arrangements should not substitute for a written offer. Compare the role, location, work hours, pay and deductions across the posting, contract and official employer confirmation.',
      'Identity documents are sensitive. Delay sharing copies until the employer, process and recipient have been independently verified.',
    ],
    verificationSteps: [
      'Obtain written terms before agreeing to travel.',
      'Confirm the workplace and role through an independent employer channel.',
      'Ask why each identity document is needed and how it will be protected.',
    ],
    sourceNotes: [
      'This is a synthetic prototype hiring update.',
      'It does not describe a live recruitment programme.',
    ],
    sourceStatus: 'synthetic-prototype',
    sourceStatusLabel: 'Synthetic pattern only',
    readingMinutes: 3,
    isFeatured: false,
    publishedAt: new Date('2026-07-27T02:00:00.000Z'),
    reviewedAt: new Date('2026-08-04T02:00:00.000Z'),
  },
] as const;
