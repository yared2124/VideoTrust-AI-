export type Recommendation = 'WATCH' | 'MAYBE' | 'SKIP';

export interface ScoreBreakdown {
  authenticity: number; // 0–100
  sentiment: number;    // 0–100
  integrity: number;    // 0–100
  engagement: number;   // 0–100
}

export interface Verdict {
  recommendation: Recommendation;
  confidence: number;          // 0.00–1.00
  trustScore: number;          // 0–100
  isClickbait: boolean;
  clickbaitDivergence: number; // 0.00–1.00
}

export interface VideoInsights {
  summaryShort: string;
  keyTakeaways: string[];
  audienceRedFlags: string[];
  topAudiencePraise: string[];
}

export interface RawVideoMetadata {
  title: string;
  channelTitle: string;
  channelId: string;
  views: number;
  likes: number;
  likeRatio: number;
  durationSeconds: number;
  thumbnailUrl: string;
  publishedAt: string;
}

export interface AnalysisTelemetry {
  commentsSampled: number;
  commentsAnalyzed: number;
  spamDetected: number;
  transcriptAvailable: boolean;
  analyzedAt: string;
  isCached: boolean;
}

export interface CompleteAnalysisReport {
  videoId: string;
  metadata: RawVideoMetadata;
  verdict: Verdict;
  scoreBreakdown: ScoreBreakdown;
  insights: VideoInsights;
  telemetry: AnalysisTelemetry;
}

// Background Worker Messages
export type ExtensionMessage =
  | { type: 'ANALYZE_VIDEO'; payload: { videoId: string; forceRefresh?: boolean } }
  | { type: 'GET_CACHED_REPORT'; payload: { videoId: string } }
  | {
      type: 'SUBMIT_FEEDBACK';
      payload: {
        videoId: string;
        isHelpful: boolean;
        agreedWithVerdict: boolean;
        userNotes?: string;
      };
    };

export interface ExtensionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache?: boolean;
}
