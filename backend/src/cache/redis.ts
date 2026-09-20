import { Redis } from 'ioredis';
import type { CompleteAnalysisReport } from '../scorer/types.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

let redisClient: Redis | null = null;
let isConnected = false;

/**
 * Initializes and returns a singleton Redis client.
 * Configured with non-blocking error handling so that if Redis is down,
 * the API continues to function by falling back to PostgreSQL or live scraping.
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop retrying if Redis is not available
        }
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on('connect', () => {
      isConnected = true;
    });

    redisClient.on('error', (_err) => {
      // Non-fatal: Redis unavailable — API falls back to PostgreSQL or live scrape
      isConnected = false;
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    // Attempt initial connection asynchronously
    redisClient.connect().catch(() => {
      isConnected = false;
    });

    return redisClient;
  } catch {
    isConnected = false;
    return null;
  }
}

/**
 * Checks Redis cache for an existing analysis report.
 * Returns null if not cached or if Redis is unreachable.
 */
export async function getCachedAnalysis(videoId: string): Promise<CompleteAnalysisReport | null> {
  const client = getRedisClient();
  if (!client || !isConnected) return null;

  try {
    const key = `videotrust:report:${videoId}`;
    const raw = await client.get(key);
    if (!raw) return null;

    const report = JSON.parse(raw) as CompleteAnalysisReport;
    report.telemetry.isCached = true;
    return report;
  } catch {
    return null;
  }
}

/**
 * Stores an analysis report in Redis with a TTL (default 24 hours).
 */
export async function setCachedAnalysis(
  videoId: string,
  report: CompleteAnalysisReport,
  ttlSeconds = DEFAULT_CACHE_TTL_SECONDS
): Promise<void> {
  const client = getRedisClient();
  if (!client || !isConnected) return;

  try {
    const key = `videotrust:report:${videoId}`;
    await client.set(key, JSON.stringify(report), 'EX', ttlSeconds);
  } catch {
    // Non-blocking: failure to write cache should not abort the request
  }
}

/**
 * Invalidates the cached report for a video (e.g. when forceRefresh is requested).
 */
export async function invalidateAnalysis(videoId: string): Promise<void> {
  const client = getRedisClient();
  if (!client || !isConnected) return;

  try {
    const key = `videotrust:report:${videoId}`;
    await client.del(key);
  } catch {
    // Non-blocking
  }
}
