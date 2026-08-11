import {
  NewsListQuerySchema,
  type NewsCategory,
} from '@vbyg/contracts';
import type { FastifyInstance } from 'fastify';

import type { NewsRepository } from './news.repository.js';
import {
  getNewsStory,
  listNewsStories,
  NewsStoryNotFoundError,
} from './news.service.js';

const categoryValues: NewsCategory[] = [
  'hiring-update',
  'scam-watch',
  'guide',
  'mil-explainer',
];

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

const newsSummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'slug', 'category', 'title', 'dek', 'sourceStatus', 'sourceStatusLabel',
    'syntheticLabel', 'readingMinutes', 'isFeatured', 'publishedAt', 'reviewedAt',
  ],
  properties: {
    slug: { type: 'string' },
    category: { type: 'string', enum: categoryValues },
    title: { type: 'string' },
    dek: { type: 'string' },
    sourceStatus: { type: 'string', enum: ['synthetic-prototype', 'synthetic-source-list'] },
    sourceStatusLabel: { type: 'string' },
    syntheticLabel: { const: 'Synthetic prototype' },
    readingMinutes: { type: 'integer', minimum: 1 },
    isFeatured: { type: 'boolean' },
    publishedAt: { type: 'string', format: 'date-time' },
    reviewedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const newsDetailSchema = {
  ...newsSummarySchema,
  required: [
    ...newsSummarySchema.required,
    'eyebrow', 'bodySections', 'verificationSteps', 'sourceNotes',
  ],
  properties: {
    ...newsSummarySchema.properties,
    eyebrow: { type: 'string' },
    bodySections: { type: 'array', minItems: 1, items: { type: 'string' } },
    verificationSteps: { type: 'array', minItems: 1, items: { type: 'string' } },
    sourceNotes: { type: 'array', minItems: 1, items: { type: 'string' } },
  },
} as const;

export async function registerNewsRoutes(
  app: FastifyInstance,
  repository: NewsRepository,
): Promise<void> {
  app.get(
    '/api/v1/news',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { category: { type: 'string', enum: categoryValues } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['stories', 'fetchedAt', 'syntheticContentNotice'],
            properties: {
              stories: { type: 'array', items: newsSummarySchema },
              fetchedAt: { type: 'string', format: 'date-time' },
              syntheticContentNotice: {
                const: 'These stories are synthetic prototype content, not live reporting or official advice.',
              },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = NewsListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The newsroom filter is invalid.',
            requestId: request.id,
          },
        });
      }
      return reply.status(200).send(await listNewsStories(repository, parsed.data));
    },
  );

  app.get(
    '/api/v1/news/:slug',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['slug'],
          properties: { slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['story'],
            properties: { story: newsDetailSchema },
          },
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      try {
        return reply.status(200).send(await getNewsStory(repository, slug));
      } catch (error) {
        if (error instanceof NewsStoryNotFoundError) {
          return reply.status(404).send({
            error: {
              code: 'NEWS_STORY_NOT_FOUND',
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
