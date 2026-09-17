import type { RawVideoMetadata, TranscriptResult } from '../ingestion/types.js';
import type { FilterTelemetry, CuratedComment } from '../filter/types.js';

export type Recommendation = 'WATCH' | 'MAYBE' | 'SKIP';

export interface ScoreBreakdown {
  authenticity: number; // 0–100: penalized by bot rings, scam links, emoji floods
  sentiment: number;    // 0–100: ratio of positive community feedback vs warnings
  integrity: number;    // 0–100: inverse of clickbait divergence
  engagement: number;   // 0–100: like-to-view and discussion depth
}

export interface Verdict {
  recommendation: Recommendation;
  confidence: number;       // 0.00–1.00
  trustScore: number;       // 0–100 overall composite score
  isClickbait: boolean;     // true if clickbait divergence > 0.65
  clickbaitDivergence: number; // 0.00–1.00 distance
}

export interface VideoInsights {
  summaryShort: string;       // ~50-word quick overview
  keyTakeaways: string[];     // 3–5 bullet points
  audienceRedFlags: string[]; // specific community warnings with ⚠️
  topAudiencePraise: string[];// genuine praise points
}

export interface CompleteAnalysisReport {
  videoId: string;
  metadata: RawVideoMetadata;
  verdict: Verdict;
  scoreBreakdown: ScoreBreakdown;
  insights: VideoInsights;
  telemetry: {
    commentsSampled: number;
    commentsAnalyzed: number;
    spamDetected: number;
    transcriptAvailable: boolean;
    analyzedAt: string;
    isCached: boolean;
  };
}
