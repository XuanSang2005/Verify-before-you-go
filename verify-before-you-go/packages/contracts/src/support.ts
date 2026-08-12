import { z } from 'zod';

export const SUPPORT_COUNTRIES = ['cambodia', 'vietnam'] as const;
export const SupportCountrySchema = z.enum(SUPPORT_COUNTRIES);
export type SupportCountry = z.infer<typeof SupportCountrySchema>;

export const SUPPORT_CONTACT_KINDS = ['emergency', 'embassy', 'consular', 'organization'] as const;
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

export const SUPPORT_LANGUAGE_STATUSES = ['confirmed', 'unconfirmed'] as const;
export const SupportLanguageStatusSchema = z.enum(SUPPORT_LANGUAGE_STATUSES);
export type SupportLanguageStatus = z.infer<typeof SupportLanguageStatusSchema>;

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
  languages: z.array(z.string().min(1).max(40)).max(6),
  languageStatus: SupportLanguageStatusSchema,
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
  if (contact.languageStatus === 'confirmed' && contact.languages.length === 0) {
    context.addIssue({
      code: 'custom',
      message: 'Confirmed language metadata requires at least one language name.',
      path: ['languages'],
    });
  }
  if (contact.languageStatus === 'unconfirmed' && contact.languages.length > 0) {
    context.addIssue({
      code: 'custom',
      message: 'Unconfirmed language metadata must not imply language availability.',
      path: ['languages'],
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

export const SUPPORT_BUNDLE_AVAILABILITY_NOTICE =
  'Bundled contacts were reviewed on the date shown. Verify availability again when you have a connection.' as const;

export const SupportDirectoryBundleSchema = z.object({
  bundleSchemaVersion: z.literal(1),
  bundledAt: z.iso.datetime(),
  availabilityNotice: z.literal(SUPPORT_BUNDLE_AVAILABILITY_NOTICE),
  response: SupportDirectoryResponseSchema,
}).strict();

export type SupportDirectoryBundle = z.infer<typeof SupportDirectoryBundleSchema>;
