import { z } from 'zod';

export const SUPPORT_COUNTRIES = ['cambodia', 'vietnam'] as const;
export const SupportCountrySchema = z.enum(SUPPORT_COUNTRIES);
export type SupportCountry = z.infer<typeof SupportCountrySchema>;

export const SUPPORT_CONTACT_KINDS = ['emergency', 'embassy', 'organization'] as const;
export const SupportContactKindSchema = z.enum(SUPPORT_CONTACT_KINDS);
export type SupportContactKind = z.infer<typeof SupportContactKindSchema>;

export const SUPPORT_ACCESS_MODES = ['cellular', 'internet'] as const;
export const SupportAccessModeSchema = z.enum(SUPPORT_ACCESS_MODES);
export type SupportAccessMode = z.infer<typeof SupportAccessModeSchema>;

export const SUPPORT_DATA_STATUSES = ['reviewed-reference', 'synthetic-summary'] as const;
export const SupportDataStatusSchema = z.enum(SUPPORT_DATA_STATUSES);
export type SupportDataStatus = z.infer<typeof SupportDataStatusSchema>;

export const SUPPORT_REVIEW_STATUSES = ['current', 'review-due'] as const;
export const SupportReviewStatusSchema = z.enum(SUPPORT_REVIEW_STATUSES);
export type SupportReviewStatus = z.infer<typeof SupportReviewStatusSchema>;

export const SupportContactSchema = z.object({
  id: z.string().regex(/^support-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  country: SupportCountrySchema,
  countryLabel: z.string().min(1).max(40),
  kind: SupportContactKindSchema,
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(240),
  displayValue: z.string().min(1).max(120),
  actionUri: z.string().min(1).max(500),
  actionLabel: z.string().min(1).max(80),
  accessMode: SupportAccessModeSchema,
  accessLabel: z.string().min(1).max(80),
  dataStatus: SupportDataStatusSchema,
  dataStatusLabel: z.string().min(1).max(80),
  sourceOwner: z.string().min(1).max(120),
  sourceUrl: z.url().startsWith('https://').max(500),
  languages: z.array(z.string().min(1).max(40)).min(1).max(6),
  hours: z.string().min(1).max(120),
  lastReviewedAt: z.iso.datetime(),
  nextReviewAt: z.iso.datetime(),
  reviewStatus: SupportReviewStatusSchema,
  sortOrder: z.number().int().nonnegative(),
}).strict().superRefine((contact, context) => {
  const isTelephoneAction = /^tel:\+?[0-9]{3,15}$/.test(contact.actionUri);
  const isSecureWebAction = /^https:\/\/[^\s]+$/.test(contact.actionUri);
  if (contact.accessMode === 'cellular' && !isTelephoneAction) {
    context.addIssue({
      code: 'custom',
      message: 'Cellular support entries require an allowlisted telephone action.',
      path: ['actionUri'],
    });
  }
  if (contact.accessMode === 'internet' && !isSecureWebAction) {
    context.addIssue({
      code: 'custom',
      message: 'Internet support entries require a secure web action.',
      path: ['actionUri'],
    });
  }
});

export type SupportContact = z.infer<typeof SupportContactSchema>;

export const SupportDirectoryQuerySchema = z.object({
  country: SupportCountrySchema.optional(),
}).strict();

export type SupportDirectoryQuery = z.infer<typeof SupportDirectoryQuerySchema>;

export const SupportDirectoryResponseSchema = z.object({
  schemaVersion: z.literal(1),
  contacts: z.array(SupportContactSchema),
  fetchedAt: z.iso.datetime(),
  directoryNotice: z.literal(
    'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.',
  ),
}).strict();

export type SupportDirectoryResponse = z.infer<typeof SupportDirectoryResponseSchema>;
