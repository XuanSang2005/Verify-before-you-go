import { z } from 'zod';

import {
  ANALYSIS_FINDING_IDS,
  AnalysisFindingIdSchema,
} from './analysis.js';

export const SHARE_TOKEN_SCHEMA_VERSION = 1 as const;
export const SHARE_TOKEN_MAX_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
export const SHARE_TOKEN_MAX_LENGTH = 2_048;

const UniqueFindingIdsSchema = z.array(AnalysisFindingIdSchema)
  .max(ANALYSIS_FINDING_IDS.length)
  .refine((ids) => new Set(ids).size === ids.length, 'Share finding IDs must be unique.');

export const ShareSummaryRequestSchema = z.strictObject({
  schemaVersion: z.literal(SHARE_TOKEN_SCHEMA_VERSION),
  findingIds: UniqueFindingIdsSchema,
  demo: z.boolean(),
});

export const ShareTokenClaimsSchema = z.strictObject({
  schemaVersion: z.literal(SHARE_TOKEN_SCHEMA_VERSION),
  findingIds: UniqueFindingIdsSchema,
  demo: z.boolean(),
  issuedAt: z.iso.datetime({ offset: false }),
  expiresAt: z.iso.datetime({ offset: false }),
}).superRefine((claims, context) => {
  const issuedAt = Date.parse(claims.issuedAt);
  const expiresAt = Date.parse(claims.expiresAt);
  const lifetime = expiresAt - issuedAt;
  if (lifetime <= 0 || lifetime > SHARE_TOKEN_MAX_LIFETIME_MS) {
    context.addIssue({
      code: 'custom',
      message: 'Share token lifetime must be positive and no longer than seven days.',
      path: ['expiresAt'],
    });
  }
});

export const ShareTokenSchema = z.string()
  .min(80)
  .max(SHARE_TOKEN_MAX_LENGTH)
  .regex(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u);

export const ShareTokenCreationResponseSchema = z.strictObject({
  token: ShareTokenSchema,
  expiresAt: z.iso.datetime({ offset: false }),
});

export const ShareTokenVerificationRequestSchema = z.strictObject({
  token: ShareTokenSchema,
});

export const ShareTokenVerificationResponseSchema = ShareTokenClaimsSchema.extend({
  checkedRuleCount: z.literal(ANALYSIS_FINDING_IDS.length),
});

export type ShareSummaryRequest = z.infer<typeof ShareSummaryRequestSchema>;
export type ShareTokenClaims = z.infer<typeof ShareTokenClaimsSchema>;
export type ShareTokenCreationResponse = z.infer<typeof ShareTokenCreationResponseSchema>;
export type ShareTokenVerificationRequest = z.infer<typeof ShareTokenVerificationRequestSchema>;
export type ShareTokenVerificationResponse = z.infer<typeof ShareTokenVerificationResponseSchema>;
