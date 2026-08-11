import { AnalyseOfferRequestSchema } from '@vbyg/contracts';
import type { FastifyInstance } from 'fastify';

import { analyseOffer } from './analysis.service.js';

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

const passageEvidenceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'source', 'text', 'start', 'end'],
  properties: {
    kind: { const: 'passage' },
    source: { enum: ['postingText', 'recruitmentLink'] },
    text: { type: 'string' },
    start: { type: 'integer', minimum: 0 },
    end: { type: 'integer', minimum: 1 },
  },
} as const;

const absenceEvidenceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'description'],
  properties: {
    kind: { const: 'absence' },
    description: { type: 'string' },
  },
} as const;

const analysisResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'analysisId',
    'ruleVersion',
    'observedSignalCount',
    'checkedRuleCount',
    'findings',
    'markedPassages',
    'unknownInformation',
    'safetyStatement',
  ],
  properties: {
    analysisId: { type: 'string' },
    ruleVersion: { type: 'string' },
    observedSignalCount: { type: 'integer', minimum: 0 },
    checkedRuleCount: { const: 9 },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'observedPattern', 'evidence', 'explanation', 'unknownInformation', 'verificationSteps'],
        properties: {
          id: { type: 'string' },
          observedPattern: { type: 'string' },
          evidence: { anyOf: [passageEvidenceSchema, absenceEvidenceSchema] },
          explanation: { type: 'string' },
          unknownInformation: { type: 'array', items: { type: 'string' } },
          verificationSteps: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    markedPassages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['findingId', 'text', 'start', 'end'],
        properties: {
          findingId: { type: 'string' },
          text: { type: 'string' },
          start: { type: 'integer', minimum: 0 },
          end: { type: 'integer', minimum: 1 },
        },
      },
    },
    unknownInformation: { type: 'array', items: { type: 'string' } },
    safetyStatement: { type: 'string' },
    screenshotNote: { type: 'string' },
  },
} as const;

export async function registerAnalysisRoute(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/v1/checks/analyse',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            postingText: { type: 'string', maxLength: 12_000 },
            recruitmentLink: { type: 'string', maxLength: 2_048 },
            screenshotProvided: { type: 'boolean' },
          },
        },
        response: { 200: analysisResponseSchema, 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const parsed = AnalyseOfferRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The submitted recruitment information is incomplete or invalid.',
            requestId: request.id,
          },
        });
      }
      return reply.status(200).send(analyseOffer(parsed.data));
    },
  );
}
