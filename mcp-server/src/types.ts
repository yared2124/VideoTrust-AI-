export interface VideoMetadata {
  videoId: string;
  title: string;
  channel: string;
  views: number;
  likes: number;
  publishedAt: string;
  durationSeconds: number;
}

export interface Verdict {
  recommendation: "WATCH" | "MAYBE" | "SKIP";
  confidence: number;
  trustScore: number;
  isClickbait: boolean;
  clickbaitDivergence: number;
}

export interface ScoreBreakdown {
  authenticity: number;
  sentiment: number;
  integrity: number;
  engagement: number;
}

export interface Insights {
  summaryShort: string;
  keyTakeaways: string[];
  audienceRedFlags: string[];
  topAudiencePraise: string[];
}

export interface Telemetry {
  commentsSampled: number;
  spamDetected: number;
  transcriptAvailable: boolean;
  analyzedAt: string;
  isCached: boolean;
}

export interface AnalysisReport {
  videoId: string;
  metadata: VideoMetadata;
  verdict: Verdict;
  scoreBreakdown: ScoreBreakdown;
  insights: Insights;
  telemetry: Telemetry;
}

/**
 * Extracts 11-character YouTube video ID from various URL formats.
 */
export function extractVideoId(urlOrId: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    return urlOrId;
  }
  const match = urlOrId.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}
