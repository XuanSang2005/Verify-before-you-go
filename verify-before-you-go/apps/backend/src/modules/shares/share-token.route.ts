import {
  ANALYSIS_FINDING_IDS,
  SHARE_TOKEN_MAX_LENGTH,
  SHARE_TOKEN_SCHEMA_VERSION,
  ShareSummaryRequestSchema,
  ShareTokenVerificationRequestSchema,
} from '@vbyg/contracts';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import {
  ExpiredShareTokenError,
  InvalidShareTokenError,
  issueShareToken,
  verifyShareToken,
} from './share-token.service.js';

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

const summaryRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'findingIds', 'demo'],
  properties: {
    schemaVersion: { const: SHARE_TOKEN_SCHEMA_VERSION },
    findingIds: {
      type: 'array',
      maxItems: ANALYSIS_FINDING_IDS.length,
      uniqueItems: true,
      items: { type: 'string', enum: ANALYSIS_FINDING_IDS },
    },
    demo: { type: 'boolean' },
  },
} as const;

const tokenRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['token'],
  properties: {
    token: {
      type: 'string',
      minLength: 80,
      maxLength: SHARE_TOKEN_MAX_LENGTH,
      pattern: '^v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{43}$',
    },
  },
} as const;

export async function registerShareTokenRoutes(
  app: FastifyInstance,
  reportSecuritySecret: string,
): Promise<void> {
  app.post(
    '/api/v1/share-tokens',
    {
      onRequest: noStore,
      schema: {
        body: summaryRequestSchema,
        response: {
          201: {
            type: 'object',
            additionalProperties: false,
            required: ['token', 'expiresAt'],
            properties: {
              token: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
            },
          },
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const summary = ShareSummaryRequestSchema.parse(request.body);
        return reply.status(201).send(issueShareToken(summary, reportSecuritySecret));
      } catch (error) {
        if (error instanceof ZodError || error instanceof InvalidShareTokenError) {
          request.log.warn('Privacy-safe share token request was invalid');
          return reply.status(400).send({
            error: {
              code: 'SHARE_TOKEN_REQUEST_INVALID',
              message: 'The privacy-safe share summary is invalid.',
              requestId: request.id,
            },
          });
        }
        request.log.error(
          { code: 'SHARE_TOKEN_CREATION_FAILED' },
          'Privacy-safe share token creation failed',
        );
        return reply.status(500).send({
          error: {
            code: 'SHARE_TOKEN_CREATION_FAILED',
            message: 'The recipient link is temporarily unavailable.',
            requestId: request.id,
          },
        });
      }
    },
  );

  app.post(
    '/api/v1/share-tokens/verify',
    {
      onRequest: noStore,
      schema: {
        body: tokenRequestSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['schemaVersion', 'findingIds', 'demo', 'issuedAt', 'expiresAt', 'checkedRuleCount'],
            properties: {
              schemaVersion: { const: SHARE_TOKEN_SCHEMA_VERSION },
              findingIds: {
                type: 'array',
                maxItems: ANALYSIS_FINDING_IDS.length,
                uniqueItems: true,
                items: { type: 'string', enum: ANALYSIS_FINDING_IDS },
              },
              demo: { type: 'boolean' },
              issuedAt: { type: 'string', format: 'date-time' },
              expiresAt: { type: 'string', format: 'date-time' },
              checkedRuleCount: { const: ANALYSIS_FINDING_IDS.length },
            },
          },
          400: errorResponseSchema,
          410: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { token } = ShareTokenVerificationRequestSchema.parse(request.body);
        return reply.status(200).send(verifyShareToken(token, reportSecuritySecret));
      } catch (error) {
        if (error instanceof ExpiredShareTokenError) {
          return reply.status(410).send({
            error: {
              code: 'SHARE_TOKEN_EXPIRED',
              message: 'This privacy-safe recipient link has expired.',
              requestId: request.id,
            },
          });
        }
        if (error instanceof InvalidShareTokenError) {
          return reply.status(400).send({
            error: {
              code: 'SHARE_TOKEN_INVALID',
              message: 'This privacy-safe recipient link is invalid.',
              requestId: request.id,
            },
          });
        }
        request.log.error(
          { code: 'SHARE_TOKEN_VERIFICATION_FAILED' },
          'Privacy-safe share token verification failed',
        );
        return reply.status(500).send({
          error: {
            code: 'SHARE_TOKEN_VERIFICATION_FAILED',
            message: 'The recipient link could not be verified.',
            requestId: request.id,
          },
        });
      }
    },
  );
}

async function noStore(_request: unknown, reply: { header: (name: string, value: string) => unknown }): Promise<void> {
  reply.header('Cache-Control', 'no-store');
  reply.header('Pragma', 'no-cache');
}
