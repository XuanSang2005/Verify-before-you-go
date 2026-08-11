import { z } from 'zod';

export const ANALYSIS_RULE_VERSION = 'vbyg-analysis-2026.08.1' as const;

export const ANALYSIS_FINDING_IDS = [
  'urgency-pressure',
  'identity-document-request',
  'upfront-payment-request',
  'off-platform-contact',
  'missing-employer-identity',
  'unverifiable-licence-claim',
  'shortened-link',
  'unsupported-salary-claim',
  'discourages-independent-contact',
] as const;

export const AnalysisFindingIdSchema = z.enum(ANALYSIS_FINDING_IDS);

export type AnalysisFindingId = z.infer<typeof AnalysisFindingIdSchema>;

export const AnalyseOfferRequestSchema = z
  .object({
    postingText: z.string().max(12_000).optional(),
    recruitmentLink: z.string().max(2_048).optional(),
    screenshotProvided: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    const postingText = value.postingText?.trim();
    const recruitmentLink = value.recruitmentLink?.trim();
    if (!postingText && !recruitmentLink && !value.screenshotProvided) {
      context.addIssue({
        code: 'custom',
        message: 'Provide posting text, a recruitment link or a screenshot indicator.',
      });
    }
    if (recruitmentLink) {
      try {
        const protocol = new URL(recruitmentLink).protocol;
        if (protocol !== 'http:' && protocol !== 'https:') {
          context.addIssue({ code: 'custom', path: ['recruitmentLink'], message: 'Use an http:// or https:// link.' });
        }
      } catch {
        context.addIssue({ code: 'custom', path: ['recruitmentLink'], message: 'Enter a complete recruitment link.' });
      }
    }
  });

export type AnalyseOfferRequest = z.infer<typeof AnalyseOfferRequestSchema>;

export const FindingEvidenceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('passage'),
    source: z.enum(['postingText', 'recruitmentLink']),
    text: z.string().min(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('absence'),
    description: z.string().min(1),
  }),
]);

export type FindingEvidence = z.infer<typeof FindingEvidenceSchema>;

export const AnalysisFindingSchema = z.object({
  id: AnalysisFindingIdSchema,
  observedPattern: z.string().min(1),
  evidence: FindingEvidenceSchema,
  explanation: z.string().min(1),
  unknownInformation: z.array(z.string().min(1)).min(1),
  verificationSteps: z.array(z.string().min(1)).min(1),
});

export type AnalysisFinding = z.infer<typeof AnalysisFindingSchema>;

export const MarkedPassageSchema = z.object({
  findingId: AnalysisFindingIdSchema,
  text: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});

export type MarkedPassage = z.infer<typeof MarkedPassageSchema>;

export const AnalyseOfferResponseSchema = z.object({
  analysisId: z.string().regex(/^analysis-[a-f0-9]{16}$/),
  ruleVersion: z.literal(ANALYSIS_RULE_VERSION),
  observedSignalCount: z.number().int().nonnegative(),
  checkedRuleCount: z.literal(9),
  findings: z.array(AnalysisFindingSchema),
  markedPassages: z.array(MarkedPassageSchema),
  unknownInformation: z.array(z.string().min(1)),
  safetyStatement: z.literal(
    'These are observed signals, not a verdict. Verify the employer, recruiter and offer through independent official sources before acting.',
  ),
  screenshotNote: z.string().min(1).optional(),
});

export type AnalyseOfferResponse = z.infer<typeof AnalyseOfferResponseSchema>;
