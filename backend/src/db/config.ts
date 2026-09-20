import { z } from "zod";

const envSchema = z.object({
  // PostgreSQL connection string — matches docker-compose videotrust-db service
  DATABASE_URL: z.string().default("postgresql://videotrust_user:secure_password_123@localhost:5432/videotrust"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CACHE_TTL_DAYS: z.coerce.number().default(30),
});

export const dbConfig = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  CACHE_TTL_DAYS: process.env.CACHE_TTL_DAYS,
});

/**
 * Milliseconds before a cached analysis report is considered stale.
 */
export const CACHE_TTL_MS = dbConfig.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
