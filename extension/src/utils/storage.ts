import type { CompleteAnalysisReport } from '../types/index.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  report: CompleteAnalysisReport;
  timestamp: number;
}

/**
 * Retrieve cached video analysis from chrome.storage.local if within TTL.
 */
export async function getCachedReport(videoId: string): Promise<CompleteAnalysisReport | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return null;
  }

  const key = `vt_report_${videoId}`;
  try {
    const result = await chrome.storage.local.get([key]);
    const entry = result[key] as CacheEntry | undefined;

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      // Stale cache
      await chrome.storage.local.remove(key);
      return null;
    }

    return entry.report;
  } catch (err) {
    console.warn('[VideoTrust AI] Failed to read from chrome.storage.local:', err);
    return null;
  }
}

/**
 * Persist a video analysis report into chrome.storage.local with current timestamp.
 */
export async function setCachedReport(videoId: string, report: CompleteAnalysisReport): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  const key = `vt_report_${videoId}`;
  const entry: CacheEntry = {
    report,
    timestamp: Date.now(),
  };

  try {
    await chrome.storage.local.set({ [key]: entry });
  } catch (err) {
    console.warn('[VideoTrust AI] Failed to write to chrome.storage.local:', err);
  }
}

/**
 * Clean up old expired entries from storage to prevent bloat.
 */
export async function cleanExpiredCache(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  try {
    const allItems = await chrome.storage.local.get(null);
    const now = Date.now();
    const staleKeys: string[] = [];

    for (const [key, value] of Object.entries(allItems)) {
      if (key.startsWith('vt_report_')) {
        const entry = value as CacheEntry;
        if (now - entry.timestamp > CACHE_TTL_MS) {
          staleKeys.push(key);
        }
      }
    }

    if (staleKeys.length > 0) {
      await chrome.storage.local.remove(staleKeys);
    }
  } catch (err) {
    console.warn('[VideoTrust AI] Failed to prune storage cache:', err);
  }
}
