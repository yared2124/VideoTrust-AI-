import type { RawComment } from '../ingestion/types.js';
import { normalizeText } from './spam-detector.js';

/**
 * Computes the Jaccard similarity between two sets of word tokens.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 * Returns a value between 0.0 (completely distinct) and 1.0 (identical tokens).
 */
export function calculateJaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = tokensA.size + tokensB.size - intersectionCount;
  return intersectionCount / unionCount;
}

export interface DedupResult {
  uniqueComments: RawComment[];
  duplicateComments: Array<{ comment: RawComment; duplicateOfId: string; similarity: number }>;
}

/**
 * Identifies and collapses bot rings posting identical or near-duplicate comments.
 * 
 * Step 1: Exact normalized string clustering (O(N)).
 * Step 2: Fuzzy Jaccard token clustering (>= 80% word overlap for comments with >= 5 words).
 */
export function deduplicateComments(
  comments: RawComment[],
  similarityThreshold = 0.8
): DedupResult {
  const uniqueComments: RawComment[] = [];
  const duplicateComments: DedupResult['duplicateComments'] = [];

  // Track seen normalized texts and token sets for unique comments
  const seenExact = new Map<string, string>(); // normalizedText -> commentId
  const clusterProfiles: Array<{ id: string; tokens: Set<string>; length: number }> = [];

  for (const comment of comments) {
    const normalized = normalizeText(comment.text);

    // 1. Exact match check on normalized text
    if (seenExact.has(normalized)) {
      const originalId = seenExact.get(normalized)!;
      duplicateComments.push({
        comment,
        duplicateOfId: originalId,
        similarity: 1.0,
      });
      continue;
    }

    // 2. Tokenize words for fuzzy similarity
    const words = normalized.split(/\s+/).filter((w) => w.length > 1);
    const tokenSet = new Set(words);

    // Only apply fuzzy similarity if comment has enough depth (>= 5 words)
    // Short comments like "great video" or "thank you" shouldn't trigger fuzzy dedup false positives
    let isFuzzyDuplicate = false;
    if (words.length >= 5) {
      for (const profile of clusterProfiles) {
        // Optimization: Skip comparison if length difference is too large to meet threshold
        const lengthRatio = Math.min(profile.length, words.length) / Math.max(profile.length, words.length);
        if (lengthRatio < similarityThreshold) continue;

        const similarity = calculateJaccardSimilarity(tokenSet, profile.tokens);
        if (similarity >= similarityThreshold) {
          duplicateComments.push({
            comment,
            duplicateOfId: profile.id,
            similarity: Number(similarity.toFixed(2)),
          });
          isFuzzyDuplicate = true;
          break;
        }
      }
    }

    if (!isFuzzyDuplicate) {
      seenExact.set(normalized, comment.id);
      clusterProfiles.push({
        id: comment.id,
        tokens: tokenSet,
        length: words.length,
      });
      uniqueComments.push(comment);
    }
  }

  return { uniqueComments, duplicateComments };
}
