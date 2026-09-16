import { z } from "zod";
import { extractVideoId, AnalysisReport } from "../types.js";

// In-memory cache for demo/offline resilience
export const reportCache = new Map<string, AnalysisReport>();

/**
 * Mock/Engine analysis generator (simulates or integrates with backend engine)
 */
export async function performAnalysis(videoId: string): Promise<AnalysisReport> {
  const existing = reportCache.get(videoId);
  if (existing) {
    return { ...existing, telemetry: { ...existing.telemetry, isCached: true } };
  }

  // Simulated high-fidelity analysis matching our spec
  const report: AnalysisReport = {
    videoId,
    metadata: {
      videoId,
      title: `Sample Video Deep Dive (${videoId})`,
      channel: "Engineering Mastery",
      views: 145000,
      likes: 8200,
      publishedAt: new Date().toISOString(),
      durationSeconds: 780,
    },
    verdict: {
      recommendation: "WATCH",
      confidence: 0.92,
      trustScore: 86,
      isClickbait: false,
      clickbaitDivergence: 0.14,
    },
    scoreBreakdown: {
      authenticity: 88,
      sentiment: 85,
      integrity: 90,
      engagement: 82,
    },
    insights: {
      summaryShort: "High-quality, production-focused tutorial with clear packet journey explanations and real code examples.",
      keyTakeaways: [
        "Covers non-blocking TCP socket mechanics",
        "Explains epoll event loop primitives",
        "Discusses OS context switching latency",
        "Includes Go and TypeScript code benchmarks",
        "Warns against naive thread-per-connection scaling"
      ],
      "audienceRedFlags": [],
      "topAudiencePraise": [
        "Clear packet journey diagram at 4:15",
        "Saved hours debugging socket buffer saturation"
      ]
    },
    telemetry: {
      commentsSampled: 650,
      spamDetected: 34,
      transcriptAvailable: true,
      analyzedAt: new Date().toISOString(),
      isCached: false,
    }
  };

  reportCache.set(videoId, report);
  return report;
}

export const analyzeVideoSchema = z.object({
  url: z.string().describe("The YouTube video URL or 11-character video ID"),
  force_refresh: z.boolean().optional().default(false).describe("Bypass cache to re-analyze comments live"),
});

export const getVideoReportSchema = z.object({
  video_id: z.string().length(11).describe("The 11-character YouTube video ID"),
});

export const checkClickbaitSchema = z.object({
  url: z.string().describe("The YouTube video URL to inspect for title-to-content clickbait divergence"),
});

export const compareVideosSchema = z.object({
  urls: z.array(z.string()).min(2).max(5).describe("List of 2 to 5 YouTube URLs to compare and rank"),
});
