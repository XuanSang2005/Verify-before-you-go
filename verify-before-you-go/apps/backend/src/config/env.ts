import { z } from 'zod';

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  DATABASE_URL: z.url(),
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006'),
  REPORT_SECURITY_SECRET: z.string()
    .regex(/^[A-Za-z0-9_-]{43,}$/u, 'REPORT_SECURITY_SECRET must be base64url encoded.')
    .refine((value) => Buffer.from(value, 'base64url').byteLength >= 32, 'REPORT_SECURITY_SECRET must contain at least 256 bits.'),
  LOCAL_STORAGE_DIR: z.string().min(1).default('.local-storage'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Environment = z.infer<typeof EnvironmentSchema> & { corsOrigins: string[] };

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = EnvironmentSchema.parse(source);
  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  };
}
