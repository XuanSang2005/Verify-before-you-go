import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.literal('verify-before-you-go-backend'),
  database: z.enum(['connected', 'unavailable']),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
