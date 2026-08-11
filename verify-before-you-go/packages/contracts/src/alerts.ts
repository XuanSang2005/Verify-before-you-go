import { z } from 'zod';

export const ALERT_LOCATIONS = ['cambodia', 'vietnam', 'regional'] as const;
export const AlertLocationSchema = z.enum(ALERT_LOCATIONS);
export type AlertLocation = z.infer<typeof AlertLocationSchema>;

export const ALERT_CATEGORIES = [
  'identity-document',
  'off-platform-contact',
  'licence-claim',
  'upfront-payment',
] as const;
export const AlertCategorySchema = z.enum(ALERT_CATEGORIES);
export type AlertCategory = z.infer<typeof AlertCategorySchema>;

export const ALERT_MODERATION_STATUSES = [
  'corroborated-pattern',
  'official-source-mismatch',
  'reviewed-pattern',
] as const;
export const AlertModerationStatusSchema = z.enum(ALERT_MODERATION_STATUSES);
export type AlertModerationStatus = z.infer<typeof AlertModerationStatusSchema>;

const maskedAlertIdentifierFormats = [
  '@[A-Za-z0-9._-]{0,2}[•*]{3,12}[A-Za-z0-9._-]{0,4}',
  '\\+\\d{1,3}(?: [•*]{2,6}){1,3}(?: \\d{1,4})?',
  'LIC-[•*]{3,12}-[A-Za-z0-9]{1,4}',
  'ACCT [•*]{3,12} [A-Za-z0-9]{1,4}',
].map((pattern) => `(?:${pattern})`).join('|');

export const MASKED_ALERT_IDENTIFIER_PATTERN =
  `(?=(?:[^•*]*[•*]){3,}[^•*]*$)(?:${maskedAlertIdentifierFormats})`;

const maskedAlertIdentifierRegex = new RegExp(`^(?:${MASKED_ALERT_IDENTIFIER_PATTERN})$`);

export const MaskedAlertIdentifierSchema = z.string().min(3).max(40).regex(
  maskedAlertIdentifierRegex,
  'Identifier must use an approved privacy-safe display format.',
);

export const AlertSummarySchema = z.object({
  id: z.string().regex(/^A-\d{3}$/),
  title: z.string().min(1),
  location: AlertLocationSchema,
  locationLabel: z.string().min(1),
  category: AlertCategorySchema,
  categoryLabel: z.string().min(1),
  moderationStatus: AlertModerationStatusSchema,
  moderationStatusLabel: z.string().min(1),
  summary: z.string().min(1),
  compatibleReportCount: z.number().int().nonnegative(),
  maskedIdentifiers: z.array(MaskedAlertIdentifierSchema).min(1),
  syntheticLabel: z.literal('Synthetic demo data'),
  firstReportedAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime(),
}).strict();

export type AlertSummary = z.infer<typeof AlertSummarySchema>;

export const AlertDetailSchema = AlertSummarySchema.extend({
  observedEvidence: z.array(z.string().min(1)).min(1),
  unknownInformation: z.array(z.string().min(1)).min(1),
  verificationSteps: z.array(z.string().min(1)).min(1),
  sourceNotes: z.array(z.string().min(1)).min(1),
  safetyStatement: z.literal('This reviewed record is not a verdict and does not establish fraud.'),
}).strict();

export type AlertDetail = z.infer<typeof AlertDetailSchema>;

export const AlertListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  location: AlertLocationSchema.optional(),
  category: AlertCategorySchema.optional(),
}).strict();

export type AlertListQuery = z.infer<typeof AlertListQuerySchema>;

export const AlertListResponseSchema = z.object({
  alerts: z.array(AlertSummarySchema),
  fetchedAt: z.iso.datetime(),
  syntheticContentNotice: z.literal(
    'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
  ),
}).strict();

export type AlertListResponse = z.infer<typeof AlertListResponseSchema>;

export const AlertDetailResponseSchema = z.object({ alert: AlertDetailSchema }).strict();
export type AlertDetailResponse = z.infer<typeof AlertDetailResponseSchema>;
