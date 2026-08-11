import { z } from 'zod';

export const NEWS_CATEGORIES = [
  'hiring-update',
  'scam-watch',
  'guide',
  'mil-explainer',
] as const;

export const NewsCategorySchema = z.enum(NEWS_CATEGORIES);
export type NewsCategory = z.infer<typeof NewsCategorySchema>;

export const NewsSourceStatusSchema = z.enum([
  'synthetic-prototype',
  'synthetic-source-list',
]);
export type NewsSourceStatus = z.infer<typeof NewsSourceStatusSchema>;

export const NewsStorySummarySchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: NewsCategorySchema,
  title: z.string().min(1),
  dek: z.string().min(1),
  sourceStatus: NewsSourceStatusSchema,
  sourceStatusLabel: z.string().min(1),
  syntheticLabel: z.literal('Synthetic prototype'),
  readingMinutes: z.number().int().positive(),
  isFeatured: z.boolean(),
  publishedAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime(),
});

export type NewsStorySummary = z.infer<typeof NewsStorySummarySchema>;

export const NewsStoryDetailSchema = NewsStorySummarySchema.extend({
  eyebrow: z.string().min(1),
  bodySections: z.array(z.string().min(1)).min(1),
  verificationSteps: z.array(z.string().min(1)).min(1),
  sourceNotes: z.array(z.string().min(1)).min(1),
});

export type NewsStoryDetail = z.infer<typeof NewsStoryDetailSchema>;

export const NewsListQuerySchema = z.object({
  category: NewsCategorySchema.optional(),
});

export type NewsListQuery = z.infer<typeof NewsListQuerySchema>;

export const NewsListResponseSchema = z.object({
  stories: z.array(NewsStorySummarySchema),
  fetchedAt: z.iso.datetime(),
  syntheticContentNotice: z.literal(
    'These stories are synthetic prototype content, not live reporting or official advice.',
  ),
});

export type NewsListResponse = z.infer<typeof NewsListResponseSchema>;

export const NewsDetailResponseSchema = z.object({
  story: NewsStoryDetailSchema,
});

export type NewsDetailResponse = z.infer<typeof NewsDetailResponseSchema>;
