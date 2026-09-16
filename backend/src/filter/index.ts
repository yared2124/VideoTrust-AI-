import type { RawComment } from '../ingestion/types.js';
import { classifySpam } from './spam-detector.js';
import { deduplicateComments } from './fuzzy-dedup.js';
import { sampleTriBucket, type SamplerOptions } from './tri-bucket.js';
import type {
  FilterResult,
  FilterTelemetry,
  SpamClassification,
  SpamCategory,
  CommentBucket,
} from './types.js';

export * from './types.js';
export { classifySpam, calculateEmojiDensity, normalizeText } from './spam-detector.js';
export { deduplicateComments, calculateJaccardSimilarity } from './fuzzy-dedup.js';
export { sampleTriBucket } from './tri-bucket.js';

export interface FilterOptions extends SamplerOptions {
  similarityThreshold?: number;
}

/**
 * Executes the complete comment reduction and anti-bot filtering pipeline:
 * 1. Heuristic spam & scam pattern detection (Regex, Emoji flood, Length).
 * 2. Exact & fuzzy deduplication to eliminate bot rings.
 * 3. Tri-bucket balanced sampling (Top 40%, Recent 40%, Long-Form 20%, Keyword Boost).
 */
export function filterAndSampleComments(
  rawComments: RawComment[],
  options: FilterOptions = {}
): FilterResult {
  const spamBreakdown: Record<SpamCategory, number> = {
    scam_regex: 0,
    emoji_flood: 0,
    bot_duplicate: 0,
    too_short: 0,
    promotional_link: 0,
  };

  const spamComments: Array<{ comment: RawComment; classification: SpamClassification }> = [];
  const nonSpamComments: RawComment[] = [];

  // Stage 1: Filter individual scam/spam comments
  for (const comment of rawComments) {
    const classification = classifySpam(comment);
    if (classification.isSpam) {
      if (classification.category) {
        spamBreakdown[classification.category]++;
      }
      spamComments.push({ comment, classification });
    } else {
      nonSpamComments.push(comment);
    }
  }

  // Stage 2: Deduplicate bot rings (exact + fuzzy)
  const { uniqueComments, duplicateComments } = deduplicateComments(
    nonSpamComments,
    options.similarityThreshold ?? 0.8
  );

  for (const dup of duplicateComments) {
    spamBreakdown.bot_duplicate++;
    spamComments.push({
      comment: dup.comment,
      classification: {
        isSpam: true,
        category: 'bot_duplicate',
        reason: `Duplicate bot comment (${Math.round(dup.similarity * 100)}% similarity to comment ${dup.duplicateOfId})`,
      },
    });
  }

  // Stage 3: Tri-bucket sampling
  const curatedComments = sampleTriBucket(uniqueComments, options);

  // Calculate bucket distribution
  const bucketDistribution: Record<CommentBucket, number> = {
    top: 0,
    recent: 0,
    long_form: 0,
    keyword_boosted: 0,
  };

  for (const c of curatedComments) {
    bucketDistribution[c.bucket]++;
  }

  const telemetry: FilterTelemetry = {
    totalInputComments: rawComments.length,
    spamDetectedCount: spamComments.length,
    botDuplicatesCount: duplicateComments.length,
    curatedSampleCount: curatedComments.length,
    bucketDistribution,
    spamBreakdown,
  };

  return {
    curatedComments,
    spamComments,
    telemetry,
  };
}
