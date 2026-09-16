import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
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
