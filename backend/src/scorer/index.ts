import type { IngestionResult } from '../ingestion/types.js';
import type { FilterResult } from '../filter/types.js';
import { calculateClickbaitDivergence } from './clickbait.js';
import { calculateTrustAndVerdict } from './trust-calculator.js';
import { synthesizeInsights } from '../ai/gemini.js';
import type { CompleteAnalysisReport } from './types.js';

export * from './types.js';
export { calculateClickbaitDivergence } from './clickbait.js';
export { calculateTrustAndVerdict } from './trust-calculator.js';

export interface ScoreOptions {
  apiKey?: string;
  isCached?: boolean;
}

/**
 * Orchestrates the full Phase 2 scoring & intelligence engine:
 * 1. Semantic Clickbait Divergence (Embeddings or Heuristic)
 * 2. Pure Deterministic Trust Scoring (Authenticity, Sentiment, Integrity, Engagement)
 * 3. Gemini Flash Synthesis (Short summary, key takeaways, audience red flags, praise)
 */
export async function scoreAndAnalyzeVideo(
  ingestion: IngestionResult,
  filter: FilterResult,
  options: ScoreOptions = {}
): Promise<CompleteAnalysisReport> {
  const { metadata, transcript, comments } = ingestion;
  const { curatedComments, telemetry, spamComments } = filter;

  // Run clickbait divergence calculation and Gemini synthesis concurrently
  const [clickbaitDivergence, insights] = await Promise.all([
    calculateClickbaitDivergence(
      metadata.title,
      metadata.description,
      transcript.fullText,
      options.apiKey
    ),
    synthesizeInsights({
      metadata,
      transcriptText: transcript.fullText,
      curatedComments,
      apiKey: options.apiKey,
    }),
  ]);

  // Deterministic calculation of sub-scores and overall Trust Score
  const { scoreBreakdown, verdict } = calculateTrustAndVerdict({
    metadata,
    telemetry,
    curatedComments,
    clickbaitDivergence,
    hasTranscript: transcript.available,
  });

  return {
    videoId: ingestion.videoId,
    metadata,
    verdict,
    scoreBreakdown,
    insights,
    telemetry: {
      commentsSampled: telemetry.totalInputComments,
      commentsAnalyzed: telemetry.curatedSampleCount,
      spamDetected: telemetry.spamDetectedCount,
      transcriptAvailable: transcript.available,
      analyzedAt: new Date().toISOString(),
      isCached: options.isCached ?? false,
    },
  };
}
