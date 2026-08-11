export const MIL_QUIZ_CONTENT_VERSION = 'mil-quiz-2026-08-v1' as const;

export type QuizTopicId =
  | 'passport-urgency'
  | 'independent-licence-check'
  | 'viral-accusations'
  | 'watchlist-absence'
  | 'redacted-observations';

export type QuizOption = {
  id: string;
  label: string;
};

export type QuizQuestion = {
  id: QuizTopicId;
  topic: string;
  prompt: string;
  supportingText: string;
  options: readonly QuizOption[];
  correctOptionId: string;
  correctTitle: string;
  correctFeedback: string;
  tryTitle: string;
  tryFeedback: string;
  skill: string;
  transferPrompt: string;
};

export const MIL_QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'passport-urgency',
    topic: 'Identity and pressure',
    prompt: 'A recruiter says your place will disappear in 30 minutes unless you send a passport photo. What should you do first?',
    supportingText: 'Choose the action that protects your identity while you verify the request.',
    options: [
      { id: 'passport-send', label: 'Send it now, then ask for the written contract.' },
      { id: 'passport-watermark', label: 'Add a watermark and send it before the deadline.' },
      { id: 'passport-pause', label: 'Pause. Find the employer’s official contact independently and verify the role and document process before sharing ID.' },
    ],
    correctOptionId: 'passport-pause',
    correctTitle: 'Good identity-protection choice.',
    correctFeedback: 'Urgency does not explain who needs the document, why they need it or how it will be protected. Verify those details independently first.',
    tryTitle: 'Pause before sharing identity documents.',
    tryFeedback: 'Sending the image immediately—or adding a watermark—does not independently verify the recruiter or make the urgent request appropriate.',
    skill: 'Access',
    transferPrompt: 'Ask: “Can I confirm this process through a channel I found myself?”',
  },
  {
    id: 'independent-licence-check',
    topic: 'Source verification',
    prompt: 'A recruiter sends a professional-looking company certificate and says it proves the job is genuine. What should you do next?',
    supportingText: 'Choose the action that gives you evidence independent of the recruiter.',
    options: [
      { id: 'licence-trust', label: 'Trust it because it contains a logo, stamp and registration number.' },
      { id: 'licence-registry', label: 'Open the issuing authority’s official registry separately and compare the legal name, number and address.' },
      { id: 'licence-screenshots', label: 'Ask the recruiter for more screenshots of the same certificate.' },
    ],
    correctOptionId: 'licence-registry',
    correctTitle: 'Good verification choice.',
    correctFeedback: 'The registry is independent of the sender. Match every field and contact the company through a separately published channel.',
    tryTitle: 'Look for an independent source.',
    tryFeedback: 'More polished material from the same sender does not independently verify the claim.',
    skill: 'Verify',
    transferPrompt: 'Ask: “Who produced this evidence, and where can I check it without using their link?”',
  },
  {
    id: 'viral-accusations',
    topic: 'Claims and evidence',
    prompt: 'A viral post accuses a recruiter of serious wrongdoing but provides no source documents. How should you use it?',
    supportingText: 'Separate a useful lead from a conclusion that still needs evidence.',
    options: [
      { id: 'viral-proof', label: 'Treat the number of shares as proof that the accusation is true.' },
      { id: 'viral-ignore', label: 'Ignore it completely because social posts are never useful.' },
      { id: 'viral-lead', label: 'Treat it as a lead, record the specific claim and look for corroborating evidence from independent sources.' },
    ],
    correctOptionId: 'viral-lead',
    correctTitle: 'Good evidence distinction.',
    correctFeedback: 'A widely shared accusation can point to something worth checking, but reach and repetition do not establish the claim as fact.',
    tryTitle: 'A lead is not the same as proof.',
    tryFeedback: 'Neither popularity nor the platform alone resolves the claim. Identify what is alleged, then seek independent corroboration.',
    skill: 'Evaluate',
    transferPrompt: 'Ask: “What specific claim can I verify, and what evidence would confirm or challenge it?”',
  },
  {
    id: 'watchlist-absence',
    topic: 'Limits of databases',
    prompt: 'A company name does not appear on a recruitment watchlist. What does that result tell you?',
    supportingText: 'Interpret an absence without turning it into a safety verdict.',
    options: [
      { id: 'watchlist-safe', label: 'The offer is safe because no warning was found.' },
      { id: 'watchlist-limited', label: 'Only that this name was not found in that list; employer, role, terms and contact channel still need independent checks.' },
      { id: 'watchlist-official', label: 'The company has been approved by the organisation that maintains the list.' },
    ],
    correctOptionId: 'watchlist-limited',
    correctTitle: 'Good interpretation of a limited result.',
    correctFeedback: 'Watchlists are incomplete, time-bound and dependent on their matching rules. No match is not evidence that an offer is safe.',
    tryTitle: 'Absence is not approval.',
    tryFeedback: 'A database can only report what it contains and matches. Continue with independent checks of the actual offer.',
    skill: 'Reflect',
    transferPrompt: 'Ask: “What can this source establish, and what remains outside its coverage?”',
  },
  {
    id: 'redacted-observations',
    topic: 'Responsible sharing',
    prompt: 'You want to warn others about a suspicious recruitment message. What is the most responsible way to share it?',
    supportingText: 'Share useful observations without exposing private data or making an unverified accusation.',
    options: [
      { id: 'share-accuse', label: 'Name the person and state that they committed fraud so the warning gets attention.' },
      { id: 'share-raw', label: 'Post the full message, phone number and passport image so everyone can investigate.' },
      { id: 'share-redacted', label: 'Redact personal data, describe the observed request precisely and label anything that remains unverified.' },
    ],
    correctOptionId: 'share-redacted',
    correctTitle: 'Good responsible-sharing choice.',
    correctFeedback: 'Specific, redacted observations help others check the pattern without spreading sensitive data or presenting an allegation as proven.',
    tryTitle: 'Share observations, not a verdict.',
    tryFeedback: 'Accusations and unredacted personal data can cause harm. State what you observed, remove identifiers and mark uncertainty clearly.',
    skill: 'Act',
    transferPrompt: 'Ask: “Can someone learn from this observation without seeing private data or an unsupported accusation?”',
  },
] as const;

export const MIL_QUIZ_TOPIC_IDS = MIL_QUIZ_QUESTIONS.map((question) => question.id);

export function getQuizQuestion(questionId: string): QuizQuestion | undefined {
  return MIL_QUIZ_QUESTIONS.find((question) => question.id === questionId);
}

export function isQuizOptionId(question: QuizQuestion, optionId: string): boolean {
  return question.options.some((option) => option.id === optionId);
}
