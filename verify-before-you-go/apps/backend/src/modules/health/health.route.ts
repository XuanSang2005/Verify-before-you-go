import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@vbyg/contracts';

export type DatabaseCheck = () => Promise<boolean>;

const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'service', 'database', 'timestamp'],
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    service: { type: 'string', const: 'verify-before-you-go-backend' },
    database: { type: 'string', enum: ['connected', 'unavailable'] },
    timestamp: { type: 'string', format: 'date-time' },
  },
} as const;

export async function registerHealthRoute(app: FastifyInstance, databaseCheck: DatabaseCheck): Promise<void> {
  app.get('/api/v1/health', { schema: { response: { 200: healthResponseSchema, 503: healthResponseSchema } } }, async (_request, reply): Promise<HealthResponse> => {
    const databaseConnected = await databaseCheck().catch(() => false);
    const response: HealthResponse = {
      status: databaseConnected ? 'ok' : 'degraded',
      service: 'verify-before-you-go-backend',
      database: databaseConnected ? 'connected' : 'unavailable',
      timestamp: new Date().toISOString(),
    };
    if (!databaseConnected) reply.code(503);
    return response;
  });
}
