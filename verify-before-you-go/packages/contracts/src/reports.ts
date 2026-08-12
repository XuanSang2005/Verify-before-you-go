import { z } from 'zod';

export const REPORT_SUBJECT_TYPES = [
  'job-post',
  'recruiter',
  'company',
  'agency',
] as const;

export const REPORT_IDENTIFIER_TYPES = [
  'url',
  'phone',
  'handle',
  'payment-account',
  'claimed-entity',
] as const;

export const REPORT_BEHAVIOUR_IDS = [
  'identity-document-request',
  'payment-request',
  'pressure',
  'company-not-found',
  'contract-visa-mismatch',
  'travel-accommodation-control',
  'impersonation',
] as const;

export const ReportSubjectTypeSchema = z.enum(REPORT_SUBJECT_TYPES);
export const ReportIdentifierTypeSchema = z.enum(REPORT_IDENTIFIER_TYPES);
export const ReportBehaviourIdSchema = z.enum(REPORT_BEHAVIOUR_IDS);

export const ReportSharingPermissionsSchema = z.strictObject({
  useForPrivateMatching: z.boolean(),
  allowRedactedPublicAlert: z.boolean(),
  shareWithNamedPartner: z.boolean(),
  namedPartner: z.string().trim().max(200),
}).superRefine((permissions, context) => {
  if (permissions.shareWithNamedPartner && !permissions.namedPartner) {
    context.addIssue({
      code: 'custom',
      message: 'A named support partner is required when partner sharing is enabled.',
      path: ['namedPartner'],
    });
  }
  if (!permissions.shareWithNamedPartner && permissions.namedPartner) {
    context.addIssue({
      code: 'custom',
      message: 'The named support partner must be empty when partner sharing is disabled.',
      path: ['namedPartner'],
    });
  }
});

export const ReportSubmissionRequestSchema = z.strictObject({
  subjectType: ReportSubjectTypeSchema,
  identifierType: ReportIdentifierTypeSchema,
  identifier: z.string().trim().min(1).max(500),
  behaviourIds: z.array(ReportBehaviourIdSchema).min(1).max(REPORT_BEHAVIOUR_IDS.length)
    .refine((ids) => new Set(ids).size === ids.length, 'Observed behaviour IDs must be unique.'),
  description: z.string().trim().max(4_000),
  redactedPreview: z.string().trim().min(1).max(4_000).optional(),
  permissions: ReportSharingPermissionsSchema,
});

export const ReportStatusSchema = z.enum([
  'received',
  'under-review',
  'more-evidence-needed',
  'reviewed',
  'closed',
  'included-in-alert',
  'withdrawn',
]);

export const ReportRecoverableStatusSchema = z.enum([
  'received',
  'under-review',
  'more-evidence-needed',
]);

export const ReportIdSchema = z.string().regex(/^R-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$/u);
export const ReportRecoveryKeySchema = z.string().regex(
  /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}(?:-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}){5}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{2}$/u,
);
export const ReportIdempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/u);

export const ReportStatusLookupRequestSchema = z.strictObject({
  reportId: ReportIdSchema,
  recoveryKey: ReportRecoveryKeySchema,
});

export const ReportStatusLookupResponseSchema = z.strictObject({
  reportId: ReportIdSchema,
  submittedAt: z.iso.datetime(),
  status: ReportRecoverableStatusSchema,
  updatedAt: z.iso.datetime(),
  nextStep: z.string().trim().min(1).max(500),
});

export const ReportReceiptSchema = z.strictObject({
  reportId: ReportIdSchema,
  submittedAt: z.iso.datetime(),
  status: z.literal('received'),
  statusLabel: z.literal('Received — not yet reviewed.'),
  privateIntakeNotice: z.literal(
    'This private receipt does not mean the report has been reviewed, verified or published.',
  ),
});

export const ReportSubmissionResponseSchema = z.strictObject({
  report: ReportReceiptSchema,
  recoveryKey: ReportRecoveryKeySchema.nullable(),
  recoveryKeyStatus: z.enum(['delivered', 'unavailable']),
}).superRefine((receipt, context) => {
  if (receipt.recoveryKeyStatus === 'delivered' && !receipt.recoveryKey) {
    context.addIssue({
      code: 'custom',
      message: 'A delivered recovery key must be present.',
      path: ['recoveryKey'],
    });
  }
  if (receipt.recoveryKeyStatus === 'unavailable' && receipt.recoveryKey !== null) {
    context.addIssue({
      code: 'custom',
      message: 'An unavailable recovery key must not be returned.',
      path: ['recoveryKey'],
    });
  }
});

export type ReportSubjectType = z.infer<typeof ReportSubjectTypeSchema>;
export type ReportIdentifierType = z.infer<typeof ReportIdentifierTypeSchema>;
export type ReportBehaviourId = z.infer<typeof ReportBehaviourIdSchema>;
export type ReportSharingPermissions = z.infer<typeof ReportSharingPermissionsSchema>;
export type ReportSubmissionRequest = z.infer<typeof ReportSubmissionRequestSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type ReportRecoverableStatus = z.infer<typeof ReportRecoverableStatusSchema>;
export type ReportStatusLookupRequest = z.infer<typeof ReportStatusLookupRequestSchema>;
export type ReportStatusLookupResponse = z.infer<typeof ReportStatusLookupResponseSchema>;
export type ReportReceipt = z.infer<typeof ReportReceiptSchema>;
export type ReportSubmissionResponse = z.infer<typeof ReportSubmissionResponseSchema>;
