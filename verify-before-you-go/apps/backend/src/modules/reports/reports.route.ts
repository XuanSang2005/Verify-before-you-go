import {
  REPORT_BEHAVIOUR_IDS,
  REPORT_IDENTIFIER_TYPES,
  REPORT_SUBJECT_TYPES,
} from '@vbyg/contracts';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import type { ReportsRepository } from './reports.repository.js';
import { RecoveryDeliveryExpiryCleaner } from './reports.recovery-cleanup.js';
import {
  ReportIdempotencyConflictError,
  submitRecruitmentReport,
} from './reports.service.js';

const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message', 'requestId'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
      },
    },
  },
} as const;

const reportRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['subjectType', 'identifierType', 'identifier', 'behaviourIds', 'description', 'permissions'],
  properties: {
    subjectType: { type: 'string', enum: REPORT_SUBJECT_TYPES },
    identifierType: { type: 'string', enum: REPORT_IDENTIFIER_TYPES },
    identifier: { type: 'string', minLength: 1, maxLength: 500 },
    behaviourIds: {
      type: 'array',
      minItems: 1,
      maxItems: REPORT_BEHAVIOUR_IDS.length,
      uniqueItems: true,
      items: { type: 'string', enum: REPORT_BEHAVIOUR_IDS },
    },
    description: { type: 'string', maxLength: 4_000 },
    redactedPreview: { type: 'string', minLength: 1, maxLength: 4_000 },
    permissions: {
      type: 'object',
      additionalProperties: false,
      required: [
        'useForPrivateMatching',
        'allowRedactedPublicAlert',
        'shareWithNamedPartner',
        'namedPartner',
      ],
      properties: {
        useForPrivateMatching: { type: 'boolean' },
        allowRedactedPublicAlert: { type: 'boolean' },
        shareWithNamedPartner: { type: 'boolean' },
        namedPartner: { type: 'string', maxLength: 200 },
      },
    },
  },
} as const;

const reportSubmissionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['report', 'recoveryKey', 'recoveryKeyStatus'],
  properties: {
    report: {
      type: 'object',
      additionalProperties: false,
      required: ['reportId', 'submittedAt', 'status', 'statusLabel', 'privateIntakeNotice'],
      properties: {
        reportId: { type: 'string', pattern: '^R-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$' },
        submittedAt: { type: 'string', format: 'date-time' },
        status: { const: 'received' },
        statusLabel: { const: 'Received — not yet reviewed.' },
        privateIntakeNotice: {
          const: 'This private receipt does not mean the report has been reviewed, verified or published.',
        },
      },
    },
    recoveryKey: {
      anyOf: [
        {
          type: 'string',
          pattern: '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}(?:-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}){5}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{2}$',
        },
        { type: 'null' },
      ],
    },
    recoveryKeyStatus: { type: 'string', enum: ['delivered', 'unavailable'] },
  },
} as const;

export async function registerReportsRoutes(
  app: FastifyInstance,
  repository: ReportsRepository,
  reportSecuritySecret: string,
): Promise<void> {
  const rateLimit = createReportRateLimit();
  const expiryCleaner = new RecoveryDeliveryExpiryCleaner(repository, {
    onError: () => app.log.error(
      { code: 'REPORT_RECOVERY_DELIVERY_CLEANUP_FAILED' },
      'Expired recovery delivery cleanup failed',
    ),
  });
  app.addHook('onReady', async () => expiryCleaner.start());
  app.addHook('onClose', async () => expiryCleaner.stop());
  app.post(
    '/api/v1/reports',
    {
      onRequest: async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        reply.header('Pragma', 'no-cache');
        if (rateLimit.consume(request.ip)) return;
        request.log.warn('Private report submission rate limit reached');
        await reply.status(429).send({
          error: {
            code: 'REPORT_RATE_LIMITED',
            message: 'Please wait before trying to submit another private report.',
            requestId: request.id,
          },
        });
      },
      schema: {
        headers: {
          type: 'object',
          required: ['idempotency-key'],
          properties: {
            'idempotency-key': {
              type: 'string',
              pattern: '^[A-Za-z0-9_-]{20,128}$',
            },
          },
        },
        body: reportRequestSchema,
        response: {
          201: reportSubmissionResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const idempotencyKey = request.headers['idempotency-key'];
      try {
        const result = await submitRecruitmentReport(
          repository,
          request.body,
          idempotencyKey,
          reportSecuritySecret,
        );
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof ZodError) {
          request.log.warn('Private report validation failed');
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'The private report details are incomplete or invalid.',
              requestId: request.id,
            },
          });
        }
        if (error instanceof ReportIdempotencyConflictError) {
          request.log.warn('Private report idempotency conflict');
          return reply.status(409).send({
            error: {
              code: 'REPORT_IDEMPOTENCY_CONFLICT',
              message: error.message,
              requestId: request.id,
            },
          });
        }
        request.log.error({ code: 'REPORT_SUBMISSION_FAILED' }, 'Private report submission failed');
        return reply.status(500).send({
          error: {
            code: 'REPORT_SUBMISSION_FAILED',
            message: 'The private report could not be submitted. Your local draft has not been removed.',
            requestId: request.id,
          },
        });
      }
    },
  );
}

export function createReportRateLimit(maximum = 10, windowMs = 60_000, maximumBuckets = 2_048) {
  const buckets = new Map<string, { count: number; startedAt: number }>();
  return {
    consume(key: string, now = Date.now()): boolean {
      for (const [bucketKey, bucket] of buckets) {
        if (now - bucket.startedAt >= windowMs) buckets.delete(bucketKey);
      }
      const current = buckets.get(key);
      if (!current || now - current.startedAt >= windowMs) {
        if (buckets.size >= maximumBuckets) {
          const oldestKey = buckets.keys().next().value as string | undefined;
          if (oldestKey) buckets.delete(oldestKey);
        }
        buckets.set(key, { count: 1, startedAt: now });
        return true;
      }
      if (current.count >= maximum) return false;
      current.count += 1;
      return true;
    },
  };
}
