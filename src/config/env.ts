import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH0_DOMAIN: z.string().min(1),
  AUTH0_AUDIENCE: z.string().min(1),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  DOCS_ENABLED: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  READINESS_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),
});

const result = schema.safeParse(process.env);
if (!result.success) {
  throw new Error(`Invalid environment configuration: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
}

export const env = Object.freeze({
  ...result.data,
  DOCS_ENABLED: result.data.DOCS_ENABLED ?? result.data.NODE_ENV !== 'production',
});
