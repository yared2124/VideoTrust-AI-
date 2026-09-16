import type { RawComment } from '../ingestion/types.js';
import type { CommentBucket, CuratedComment } from './types.js';

const SIGNAL_KEYWORDS = [
  'deprecated',
  'outdated',
  'broken',
  'error',
  'issue',
  'bug',
  'fail',
  'does not work',
  "doesn't work",
  'scam',
  'fake',
  'misleading',
  'clickbait',
  'solution',
  'fixed',
  'update',
  'resolved',
  'workaround',
  'saved my',
];

/**
 * Scans a comment for technical signal keywords.
 */
export function findMatchingKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return SIGNAL_KEYWORDS.filter((keyword) => lower.includes(keyword));
}

/**
 * Calculates an informational signal score for a comment.
 * Higher scores represent comments with high community validation,
 * technical depth, or critical warning keywords.
 */
export function calculateSignalScore(comment: RawComment, matchedKeywords: string[]): number {
  let score = 0;

  // 1. Upvote power (logarithmic scale)
  if (comment.likeCount > 0) {
    score += Math.log10(comment.likeCount + 1) * 15;
  }

  // 2. Length power (technical depth up to 500 chars)
  const lengthBonus = Math.min(comment.text.length, 500) / 20;
  score += lengthBonus;

  // 3. Keyword multiplier: Critical signals give immediate high priority
  if (matchedKeywords.length > 0) {
    score += matchedKeywords.length * 25;
  }

  // 4. Pinned by creator
  if (comment.isPinned) {
    score += 30;
  }

  return Math.round(score);
}

export interface SamplerOptions {
  targetSampleCount?: number;
  topRatio?: number;
  recentRatio?: number;
  longFormRatio?: number;
  longFormMinChars?: number;
}

/**
 * Implements the Tri-Bucket Sampler:
 * - 40% Community Consensus (Top upvoted)
 * - 40% Recent Signals (Detects recent breaks / library version deprecations)
 * - 20% Deep Technical Critique (Long-form comments > 150 chars)
 * - Prioritizes comments with critical warning/solution keywords across all buckets.
 */
export function sampleTriBucket(
  comments: RawComment[],
  options: SamplerOptions = {}
): CuratedComment[] {
  const targetCount = options.targetSampleCount ?? 120;
  if (comments.length <= targetCount) {
    // If fewer than target, tag all and return
    return comments.map((c) => {
      const keywords = findMatchingKeywords(c.text);
      return {
        ...c,
        bucket: keywords.length > 0 ? 'keyword_boosted' : 'top',
        signalScore: calculateSignalScore(c, keywords),
        matchedKeywords: keywords,
      };
    });
  }

  const topTarget = Math.floor(targetCount * (options.topRatio ?? 0.4));
  const recentTarget = Math.floor(targetCount * (options.recentRatio ?? 0.4));
  const longFormTarget = targetCount - topTarget - recentTarget;
  const longFormMinChars = options.longFormMinChars ?? 150;

  const selectedIds = new Set<string>();
  const curated: CuratedComment[] = [];

  const addComment = (comment: RawComment, bucket: CommentBucket) => {
    if (selectedIds.has(comment.id)) return false;
    selectedIds.add(comment.id);
    const keywords = findMatchingKeywords(comment.text);
    curated.push({
      ...comment,
      bucket: keywords.length > 0 && bucket !== 'keyword_boosted' ? 'keyword_boosted' : bucket,
      signalScore: calculateSignalScore(comment, keywords),
      matchedKeywords: keywords,
    });
    return true;
  };

  // Pre-sort candidates
  // 1. Keyword-boosted comments get first-class reservation (up to 20 slots)
  const keywordCandidates = comments
    .filter((c) => findMatchingKeywords(c.text).length > 0)
    .sort((a, b) => b.likeCount - a.likeCount);

  for (const c of keywordCandidates.slice(0, 20)) {
    addComment(c, 'keyword_boosted');
  }

  // 2. Bucket 1: Top upvoted comments (sorted descending by likes)
  const topCandidates = [...comments].sort((a, b) => b.likeCount - a.likeCount);
  let topAdded = 0;
  for (const c of topCandidates) {
    if (topAdded >= topTarget || curated.length >= targetCount) break;
    if (addComment(c, 'top')) {
      topAdded++;
    }
  }

  // 3. Bucket 2: Recent comments (assuming natural order or reverse chron order)
  const recentCandidates = [...comments]; // Natural order from InnerTube's recent pagination
  let recentAdded = 0;
  for (const c of recentCandidates) {
    if (recentAdded >= recentTarget || curated.length >= targetCount) break;
    if (addComment(c, 'recent')) {
      recentAdded++;
    }
  }

  // 4. Bucket 3: Long-form technical comments (> 150 chars)
  const longFormCandidates = comments
    .filter((c) => c.text.length >= longFormMinChars)
    .sort((a, b) => b.text.length - a.text.length);

  let longFormAdded = 0;
  for (const c of longFormCandidates) {
    if (longFormAdded >= longFormTarget || curated.length >= targetCount) break;
    if (addComment(c, 'long_form')) {
      longFormAdded++;
    }
  }

  // 5. Overflow fill if any bucket was under-filled
  if (curated.length < targetCount) {
    for (const c of topCandidates) {
      if (curated.length >= targetCount) break;
      addComment(c, 'top');
    }
  }

  return curated;
}
