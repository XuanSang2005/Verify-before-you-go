import {
  SUPPORT_ACCESS_MODES,
  SUPPORT_CONTACT_KINDS,
  SUPPORT_COUNTRIES,
  SUPPORT_DATA_STATUSES,
  SUPPORT_REVIEW_STATUSES,
  SupportDirectoryQuerySchema,
} from '@vbyg/contracts';
import type { FastifyInstance } from 'fastify';

import type { SupportRepository } from './support.repository.js';
import { listSupportContacts, SUPPORT_DIRECTORY_NOTICE } from './support.service.js';

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

const supportContactSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id', 'country', 'countryLabel', 'kind', 'title', 'description', 'displayValue',
    'actionUri', 'actionLabel', 'accessMode', 'accessLabel', 'dataStatus', 'dataStatusLabel',
    'sourceOwner', 'sourceUrl', 'languages', 'hours', 'lastReviewedAt', 'nextReviewAt',
    'reviewStatus', 'sortOrder',
  ],
  properties: {
    id: { type: 'string', pattern: '^support-[a-z0-9]+(?:-[a-z0-9]+)*$' },
    country: { type: 'string', enum: [...SUPPORT_COUNTRIES] },
    countryLabel: { type: 'string' },
    kind: { type: 'string', enum: [...SUPPORT_CONTACT_KINDS] },
    title: { type: 'string' },
    description: { type: 'string' },
    displayValue: { type: 'string' },
    actionUri: { type: 'string', pattern: '^(?:tel:\\+?[0-9]{3,15}|https://[^\\s]+)$' },
    actionLabel: { type: 'string' },
    accessMode: { type: 'string', enum: [...SUPPORT_ACCESS_MODES] },
    accessLabel: { type: 'string' },
    dataStatus: { type: 'string', enum: [...SUPPORT_DATA_STATUSES] },
    dataStatusLabel: { type: 'string' },
    sourceOwner: { type: 'string' },
    sourceUrl: { type: 'string', pattern: '^https://[^\\s]+$' },
    languages: { type: 'array', minItems: 1, items: { type: 'string' } },
    hours: { type: 'string' },
    lastReviewedAt: { type: 'string', format: 'date-time' },
    nextReviewAt: { type: 'string', format: 'date-time' },
    reviewStatus: { type: 'string', enum: [...SUPPORT_REVIEW_STATUSES] },
    sortOrder: { type: 'integer', minimum: 0 },
  },
} as const;

export async function registerSupportRoutes(
  app: FastifyInstance,
  repository: SupportRepository,
): Promise<void> {
  app.get(
    '/api/v1/support-contacts',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { country: { type: 'string', enum: [...SUPPORT_COUNTRIES] } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['schemaVersion', 'contacts', 'fetchedAt', 'directoryNotice'],
            properties: {
              schemaVersion: { const: 1 },
              contacts: { type: 'array', items: supportContactSchema },
              fetchedAt: { type: 'string', format: 'date-time' },
              directoryNotice: { const: SUPPORT_DIRECTORY_NOTICE },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = SupportDirectoryQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The support-directory filter is invalid.',
            requestId: request.id,
          },
        });
      }
      return reply.status(200).send(await listSupportContacts(repository, parsed.data));
    },
  );
}
