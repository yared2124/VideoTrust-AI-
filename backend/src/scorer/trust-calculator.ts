import type { RawVideoMetadata } from '../ingestion/types.js';
import type { FilterTelemetry, CuratedComment } from '../filter/types.js';
import type { ScoreBreakdown, Verdict, Recommendation } from './types.js';

export interface CalculatorInputs {
  metadata: RawVideoMetadata;
  telemetry: FilterTelemetry;
  curatedComments: CuratedComment[];
  clickbaitDivergence: number; // 0.00 to 1.00
  hasTranscript: boolean;
}

/**
 * Calculates the Authenticity sub-score (0–100).
 * Penalized heavily by bot-ring duplicates, spam regex matches, and emoji floods.
 */
export function calculateAuthenticityScore(telemetry: FilterTelemetry): number {
  if (telemetry.totalInputComments === 0) {
    return 70; // Neutral default if comments are completely disabled
  }

  const spamRatio = telemetry.spamDetectedCount / telemetry.totalInputComments;
  const botDupRatio = telemetry.botDuplicatesCount / telemetry.totalInputComments;

  // Deduction based on contamination ratio
  const penalty = (spamRatio * 55) + (botDupRatio * 45);
  const rawScore = 100 - penalty;

  return Math.min(100, Math.max(10, Math.round(rawScore)));
}

/**
 * Calculates the Sentiment sub-score (0–100).
 * Balances positive community reactions against technical error warnings.
 */
export function calculateSentimentScore(curatedComments: CuratedComment[]): number {
  if (curatedComments.length === 0) {
    return 65; // Neutral baseline
  }

  let warningCount = 0;
  let positiveEngagementScore = 0;

  for (const c of curatedComments) {
    if (c.matchedKeywords.length > 0) {
      warningCount++;
    }
    if (c.likeCount > 5) {
      positiveEngagementScore += Math.min(c.likeCount, 100);
    }
  }

  const warningRatio = warningCount / curatedComments.length;
  // If > 25% of curated comments contain critical warning keywords, sentiment drops sharply
  let score = 75 - (warningRatio * 60);

  // Bonus for strong positive community upvotes
  if (positiveEngagementScore > 200) {
    score += 15;
  } else if (positiveEngagementScore > 50) {
    score += 10;
  }

  return Math.min(100, Math.max(15, Math.round(score)));
}

/**
 * Calculates the Integrity sub-score (0–100).
 * Represents alignment between title claims and actual video content.
 */
export function calculateIntegrityScore(clickbaitDivergence: number): number {
  // Direct inverse of clickbait divergence
  const integrity = Math.round((1 - clickbaitDivergence) * 100);
  return Math.min(100, Math.max(5, integrity));
}

/**
 * Calculates the Engagement sub-score (0–100).
 * Evaluates like-to-view ratio against YouTube baseline distributions.
 */
export function calculateEngagementScore(metadata: RawVideoMetadata): number {
  if (metadata.views === 0) return 60;

  const ratio = metadata.likeRatio;
  let score = 60;

  if (ratio >= 0.06) {
    score = 95; // Top tier engagement (>6% like-to-view)
  } else if (ratio >= 0.04) {
    score = 85;
  } else if (ratio >= 0.025) {
    score = 75;
  } else if (ratio >= 0.01) {
    score = 60;
  } else {
    score = 40; // Extremely low like-to-view (<1%)
  }

  return score;
}

/**
 * Deterministic Trust Score Calculator.
 * Formula: Trust = 0.30 * Authenticity + 0.25 * Sentiment + 0.25 * Integrity + 0.20 * Engagement
 */
export function calculateTrustAndVerdict(inputs: CalculatorInputs): {
  scoreBreakdown: ScoreBreakdown;
  verdict: Verdict;
} {
  const authenticity = calculateAuthenticityScore(inputs.telemetry);
  const sentiment = calculateSentimentScore(inputs.curatedComments);
  const integrity = calculateIntegrityScore(inputs.clickbaitDivergence);
  const engagement = calculateEngagementScore(inputs.metadata);

  // Pure weighted formula
  const compositeTrust = Math.round(
    0.30 * authenticity +
    0.25 * sentiment +
    0.25 * integrity +
    0.20 * engagement
  );

  const isClickbait = inputs.clickbaitDivergence > 0.65;

  // Determine Recommendation
  let recommendation: Recommendation;
  if (compositeTrust >= 70 && !isClickbait) {
    recommendation = 'WATCH';
  } else if (compositeTrust >= 45) {
    recommendation = 'MAYBE';
  } else {
    recommendation = 'SKIP';
  }

  // Calculate confidence based on data completeness
  let confidence = 0.70;
  if (inputs.hasTranscript) confidence += 0.15;
  if (inputs.telemetry.totalInputComments >= 50) confidence += 0.10;
  confidence = Math.min(0.98, Number(confidence.toFixed(2)));

  return {
    scoreBreakdown: {
      authenticity,
      sentiment,
      integrity,
      engagement,
    },
    verdict: {
      recommendation,
      confidence,
      trustScore: compositeTrust,
      isClickbait,
      clickbaitDivergence: Number(inputs.clickbaitDivergence.toFixed(2)),
    },
  };
}
