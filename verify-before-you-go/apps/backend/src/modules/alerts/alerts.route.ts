import {
  ALERT_CATEGORIES,
  ALERT_LOCATIONS,
  ALERT_MODERATION_STATUSES,
  AlertListQuerySchema,
  MASKED_ALERT_IDENTIFIER_PATTERN,
} from '@vbyg/contracts';
import type { FastifyInstance } from 'fastify';

import type { AlertsRepository } from './alerts.repository.js';
import {
  CommunityAlertNotFoundError,
  getCommunityAlert,
  listCommunityAlerts,
} from './alerts.service.js';

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

const alertSummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id', 'title', 'location', 'locationLabel', 'category', 'categoryLabel',
    'moderationStatus', 'moderationStatusLabel', 'summary', 'compatibleReportCount',
    'maskedIdentifiers', 'syntheticLabel', 'firstReportedAt', 'reviewedAt',
  ],
  properties: {
    id: { type: 'string', pattern: '^A-[0-9]{3}$' },
    title: { type: 'string' },
    location: { type: 'string', enum: ALERT_LOCATIONS },
    locationLabel: { type: 'string' },
    category: { type: 'string', enum: ALERT_CATEGORIES },
    categoryLabel: { type: 'string' },
    moderationStatus: { type: 'string', enum: ALERT_MODERATION_STATUSES },
    moderationStatusLabel: { type: 'string' },
    summary: { type: 'string' },
    compatibleReportCount: { type: 'integer', minimum: 0 },
    maskedIdentifiers: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        minLength: 3,
        maxLength: 40,
        pattern: `^(?:${MASKED_ALERT_IDENTIFIER_PATTERN})$`,
      },
    },
    syntheticLabel: { const: 'Synthetic demo data' },
    firstReportedAt: { type: 'string', format: 'date-time' },
    reviewedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const alertDetailSchema = {
  ...alertSummarySchema,
  required: [
    ...alertSummarySchema.required,
    'observedEvidence', 'unknownInformation', 'verificationSteps', 'sourceNotes', 'safetyStatement',
  ],
  properties: {
    ...alertSummarySchema.properties,
    observedEvidence: { type: 'array', minItems: 1, items: { type: 'string' } },
    unknownInformation: { type: 'array', minItems: 1, items: { type: 'string' } },
    verificationSteps: { type: 'array', minItems: 1, items: { type: 'string' } },
    sourceNotes: { type: 'array', minItems: 1, items: { type: 'string' } },
    safetyStatement: { const: 'This reviewed record is not a verdict and does not establish fraud.' },
  },
} as const;

export async function registerAlertsRoutes(
  app: FastifyInstance,
  repository: AlertsRepository,
): Promise<void> {
  app.get(
    '/api/v1/alerts',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            search: { type: 'string', minLength: 1, maxLength: 120 },
            location: { type: 'string', enum: ALERT_LOCATIONS },
            category: { type: 'string', enum: ALERT_CATEGORIES },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['alerts', 'fetchedAt', 'syntheticContentNotice'],
            properties: {
              alerts: { type: 'array', items: alertSummarySchema },
              fetchedAt: { type: 'string', format: 'date-time' },
              syntheticContentNotice: {
                const: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
              },
            },
          },
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = AlertListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The community alert filters are invalid.',
            requestId: request.id,
          },
        });
      }
      return reply.status(200).send(await listCommunityAlerts(repository, parsed.data));
    },
  );

  app.get(
    '/api/v1/alerts/:id',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string', pattern: '^A-[0-9]{3}$' } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['alert'],
            properties: { alert: alertDetailSchema },
          },
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return reply.status(200).send(await getCommunityAlert(repository, id));
      } catch (error) {
        if (error instanceof CommunityAlertNotFoundError) {
          return reply.status(404).send({
            error: {
              code: 'COMMUNITY_ALERT_NOT_FOUND',
              message: error.message,
              requestId: request.id,
            },
          });
        }
        throw error;
      }
    },
  );
}
