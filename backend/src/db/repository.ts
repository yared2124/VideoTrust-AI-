import { prisma } from "./client.js";
import { CACHE_TTL_MS } from "./config.js";

export interface SaveReportParams {
  videoId: string;
  metadata: {
    title: string;
    channel: string;
    channelId?: string;
    views: number;
    likes: number;
    likeRatio: number;
    durationSeconds: number;
    thumbnailUrl?: string;
    publishedAt?: string;
  };
  verdict: {
    recommendation: "WATCH" | "MAYBE" | "SKIP";
    confidence: number;
    trustScore: number;
    isClickbait: boolean;
    clickbaitDivergence: number;
  };
  scoreBreakdown: {
    authenticity: number;
    sentiment: number;
    integrity: number;
    engagement: number;
  };
  insights: {
    summaryShort: string;
    keyTakeaways: string[];
    audienceRedFlags: string[];
    topAudiencePraise: string[];
  };
  telemetry: {
    commentsSampled: number;
    spamDetected: number;
    transcriptAvailable: boolean;
  };
  commentSamples?: Array<{
    author: string;
    commentText: string;
    likes: number;
    isPinned: boolean;
    isSpam: boolean;
    spamReason?: string;
    bucketType: string;
  }>;
}

export class VideoTrustRepository {
  /**
   * Fast-path Cache Lookup: Returns cached report if newer than CACHE_TTL_MS
   */
  public async getCachedReport(videoId: string) {
    const video = await prisma.video.findUnique({
      where: { videoId },
      include: {
        reports: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!video || video.reports.length === 0) {
      return null;
    }

    const latestReport = video.reports[0];
    const ageMs = Date.now() - latestReport.createdAt.getTime();

    // Stale check
    if (ageMs > CACHE_TTL_MS) {
      return null;
    }

    return {
      videoId: video.videoId,
      metadata: {
        title: video.title,
        channel: video.channel,
        channelId: video.channelId,
        views: video.views,
        likes: video.likes,
        likeRatio: video.likeRatio,
        durationSeconds: video.durationSeconds,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt?.toISOString(),
      },
      verdict: {
        recommendation: latestReport.recommendation as "WATCH" | "MAYBE" | "SKIP",
        confidence: latestReport.confidence,
        trustScore: latestReport.trustScore,
        isClickbait: latestReport.isClickbait,
        clickbaitDivergence: latestReport.clickbaitDivergence,
      },
      scoreBreakdown: {
        authenticity: latestReport.authenticityScore,
        sentiment: latestReport.sentimentScore,
        integrity: latestReport.integrityScore,
        engagement: latestReport.engagementScore,
      },
      insights: {
        summaryShort: latestReport.summaryShort,
        keyTakeaways: JSON.parse(latestReport.keyTakeaways),
        audienceRedFlags: JSON.parse(latestReport.audienceRedFlags),
        topAudiencePraise: JSON.parse(latestReport.topAudiencePraise),
      },
      telemetry: {
        commentsSampled: latestReport.commentsSampled,
        spamDetected: latestReport.spamDetected,
        transcriptAvailable: latestReport.transcriptAvailable,
        analyzedAt: latestReport.createdAt.toISOString(),
        isCached: true,
      },
    };
  }

  /**
   * Persist a completed video analysis and optional sample comments
   */
  public async saveReport(data: SaveReportParams) {
    return prisma.$transaction(async (tx) => {
      // 1. Upsert video record
      const video = await tx.video.upsert({
        where: { videoId: data.videoId },
        update: {
          title: data.metadata.title,
          channel: data.metadata.channel,
          channelId: data.metadata.channelId,
          views: data.metadata.views,
          likes: data.metadata.likes,
          likeRatio: data.metadata.likeRatio,
          durationSeconds: data.metadata.durationSeconds,
          thumbnailUrl: data.metadata.thumbnailUrl,
          publishedAt: data.metadata.publishedAt ? new Date(data.metadata.publishedAt) : null,
        },
        create: {
          videoId: data.videoId,
          title: data.metadata.title,
          channel: data.metadata.channel,
          channelId: data.metadata.channelId,
          views: data.metadata.views,
          likes: data.metadata.likes,
          likeRatio: data.metadata.likeRatio,
          durationSeconds: data.metadata.durationSeconds,
          thumbnailUrl: data.metadata.thumbnailUrl,
          publishedAt: data.metadata.publishedAt ? new Date(data.metadata.publishedAt) : null,
        },
      });

      // 2. Insert new AnalysisReport snapshot
      const report = await tx.analysisReport.create({
        data: {
          videoId: video.videoId,
          recommendation: data.verdict.recommendation,
          confidence: data.verdict.confidence,
          trustScore: data.verdict.trustScore,
          isClickbait: data.verdict.isClickbait,
          clickbaitDivergence: data.verdict.clickbaitDivergence,
          authenticityScore: data.scoreBreakdown.authenticity,
          sentimentScore: data.scoreBreakdown.sentiment,
          integrityScore: data.scoreBreakdown.integrity,
          engagementScore: data.scoreBreakdown.engagement,
          summaryShort: data.insights.summaryShort,
          keyTakeaways: JSON.stringify(data.insights.keyTakeaways),
          audienceRedFlags: JSON.stringify(data.insights.audienceRedFlags),
          topAudiencePraise: JSON.stringify(data.insights.topAudiencePraise),
          commentsSampled: data.telemetry.commentsSampled,
          spamDetected: data.telemetry.spamDetected,
          transcriptAvailable: data.telemetry.transcriptAvailable,
        },
      });

      // 3. Save sample comments if provided
      if (data.commentSamples && data.commentSamples.length > 0) {
        await tx.commentSample.createMany({
          data: data.commentSamples.map((c) => ({
            videoId: video.videoId,
            author: c.author,
            commentText: c.commentText,
            likes: c.likes,
            isPinned: c.isPinned,
            isSpam: c.isSpam,
            spamReason: c.spamReason,
            bucketType: c.bucketType,
          })),
        });
      }

      return report;
    });
  }

  /**
   * Record crowd feedback on accuracy
   */
  public async recordFeedback(params: {
    videoId: string;
    userId?: string;
    isHelpful: boolean;
    agreedWithVerdict: boolean;
    userNotes?: string;
  }) {
    return prisma.userFeedback.create({
      data: {
        videoId: params.videoId,
        userId: params.userId,
        isHelpful: params.isHelpful,
        agreedWithVerdict: params.agreedWithVerdict,
        userNotes: params.userNotes,
      },
    });
  }

  /**
   * Telemetry stats for health & admin monitoring
   */
  public async getDatabaseStats() {
    const [totalVideos, totalReports, totalFeedback] = await Promise.all([
      prisma.video.count(),
      prisma.analysisReport.count(),
      prisma.userFeedback.count(),
    ]);

    const aggregates = await prisma.analysisReport.aggregate({
      _avg: {
        trustScore: true,
        confidence: true,
      },
    });

    return {
      totalVideos,
      totalReports,
      totalFeedback,
      averageTrustScore: Math.round(aggregates._avg.trustScore ?? 0),
      averageConfidence: Number((aggregates._avg.confidence ?? 0).toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }
}

export const repository = new VideoTrustRepository();
