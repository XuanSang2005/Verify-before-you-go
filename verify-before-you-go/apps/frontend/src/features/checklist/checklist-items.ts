export const CHECKLIST_ITEM_IDS = [
  'legal-employer-identity',
  'independent-employer-contact',
  'licence-and-registration',
  'written-role-terms',
  'protect-identity-documents',
] as const;

export type ChecklistItemId = (typeof CHECKLIST_ITEM_IDS)[number];

export interface VerificationChecklistItem {
  id: ChecklistItemId;
  title: string;
  whyItMatters: string;
  independentCheck: string;
}

export const verificationChecklistItems: readonly VerificationChecklistItem[] = [
  {
    id: 'legal-employer-identity',
    title: 'Confirm the employer’s legal identity',
    whyItMatters: 'A name or logo does not prove which legal organisation is offering the role.',
    independentCheck: 'Use an official registry you found yourself; match the legal name, number, address and status.',
  },
  {
    id: 'independent-employer-contact',
    title: 'Contact the employer independently',
    whyItMatters: 'The posting’s contact channel cannot independently confirm who controls it.',
    independentCheck: 'Find the official website or phone number separately and ask whether the role and recruiter are authorised.',
  },
  {
    id: 'licence-and-registration',
    title: 'Verify licences and certificates',
    whyItMatters: 'A document can be altered, expired or unrelated to the organisation.',
    independentCheck: 'Ask the issuing authority to confirm the number, holder, scope and current validity.',
  },
  {
    id: 'written-role-terms',
    title: 'Confirm the written role terms',
    whyItMatters: 'Salary, location, duties or fees may change after you commit time or money.',
    independentCheck: 'Get duties, pay, hours, location, contract type and every claimed fee in writing.',
  },
  {
    id: 'protect-identity-documents',
    title: 'Protect identity documents',
    whyItMatters: 'Identity files expose sensitive information before the organisation and purpose are confirmed.',
    independentCheck: 'Delay sharing; ask what is required, how it is stored and when it is deleted.',
  },
] as const;
