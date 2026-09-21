import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ingestVideo, extractVideoId } from './ingestion/index.js';
import { filterAndSampleComments } from './filter/index.js';
import { scoreAndAnalyzeVideo } from './scorer/index.js';
import { getCachedAnalysis, setCachedAnalysis, invalidateAnalysis } from './cache/redis.js';
import { repository } from './db/repository.js';

const server = Fastify({
  logger: true,
});

// Register Plugins
await server.register(cors, {
  origin: true, // Allow all origins for dev/extension
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

await server.register(rateLimit, {
  max: 60,
  timeWindow: '1 minute',
});

// Health check endpoint
server.get('/health', async () => {
  return {
    status: 'ok',
    service: 'videotrust-backend',
    timestamp: new Date().toISOString(),
  };
});

// Official SPEC-001 Analysis Endpoint with Cache-Aside Pattern
server.post('/api/v1/analyze', async (request, reply) => {
  const body = request.body as { url?: string; videoId?: string; forceRefresh?: boolean } | undefined;
  const input = body?.url || body?.videoId;

  if (!input) {
    return reply.status(400).send({
      success: false,
      error: 'Either "url" or "videoId" must be provided in request body.',
    });
  }

  const videoId = extractVideoId(input);
  if (!videoId) {
    return reply.status(400).send({
      success: false,
      error: `Could not parse valid YouTube video ID from "${input}".`,
    });
  }

  const startTime = Date.now();
  const forceRefresh = Boolean(body?.forceRefresh);

  try {
    // -------------------------------------------------------------
    // CACHE-ASIDE: Step 1 - Check Redis / Database unless forced
    // -------------------------------------------------------------
    if (!forceRefresh) {
      // 1a. Fast path: Redis (sub-15ms)
      const redisCached = await getCachedAnalysis(videoId);
      if (redisCached) {
        const executionTimeMs = Date.now() - startTime;
        reply.header('X-Cache', 'HIT');
        reply.header('X-Execution-Time-Ms', executionTimeMs.toString());
        return { success: true, data: redisCached };
      }

      // 1b. Secondary cache: PostgreSQL (< 30ms)
      const dbCached = await repository.getCachedReport(videoId).catch(() => null);
      if (dbCached) {
        // Backfill Redis cache asynchronously
        setCachedAnalysis(videoId, dbCached as any).catch(() => {});

        const executionTimeMs = Date.now() - startTime;
        reply.header('X-Cache', 'HIT');
        reply.header('X-Execution-Time-Ms', executionTimeMs.toString());
        return { success: true, data: dbCached };
      }
    } else {
      // If force refresh requested, invalidate existing Redis entry
      await invalidateAnalysis(videoId);
    }

    // -------------------------------------------------------------
    // CACHE MISS / REFRESH: Run Ingestion, Filter, and Scorer Pipeline
    // -------------------------------------------------------------
    // 1. Ingest raw metadata, comments, and transcript via InnerTube
    const rawData = await ingestVideo(videoId, { maxComments: 2000 });

    // 2. Filter bot rings, spam, and extract balanced high-signal comment sample
    const filterResult = filterAndSampleComments(rawData.comments, {
      targetSampleCount: 200,
    });

    // 3. Deterministic Trust Scoring, Clickbait Divergence & Gemini Synthesis
    const report = await scoreAndAnalyzeVideo(rawData, filterResult, {
      isCached: false,
    });

    // -------------------------------------------------------------
    // PERSISTENCE: Write to PostgreSQL & Redis
    // -------------------------------------------------------------
    repository
      .saveReport({
        videoId: report.videoId,
        metadata: {
          title: report.metadata.title,
          channel: report.metadata.channelTitle,
          channelId: report.metadata.channelId,
          views: report.metadata.views,
          likes: report.metadata.likes,
          likeRatio: report.metadata.likeRatio,
          durationSeconds: report.metadata.durationSeconds,
          thumbnailUrl: report.metadata.thumbnailUrl,
          publishedAt: report.metadata.publishedAt,
        },
        verdict: report.verdict,
        scoreBreakdown: report.scoreBreakdown,
        insights: report.insights,
        telemetry: {
          commentsSampled: report.telemetry.commentsSampled,
          spamDetected: report.telemetry.spamDetected,
          transcriptAvailable: report.telemetry.transcriptAvailable,
        },
        commentSamples: filterResult.curatedComments.slice(0, 10).map((c) => ({
          author: c.author,
          commentText: c.text,
          likes: c.likeCount,
          isPinned: c.isPinned,
          isSpam: false,
          bucketType: c.bucket.toUpperCase(),
        })),
      })
      .catch((err) => {
        server.log.warn(`Database persistence warning: ${err.message}`);
      });

    // Store in Redis (24h TTL)
    setCachedAnalysis(videoId, report).catch(() => {});

    const executionTimeMs = Date.now() - startTime;
    reply.header('X-Cache', 'MISS');
    reply.header('X-Execution-Time-Ms', executionTimeMs.toString());

    return {
      success: true,
      data: report,
    };
  } catch (error) {
    server.log.error(error);
    return reply.status(500).send({
      success: false,
      error: (error as Error).message,
    });
  }
});

// Fast Cache Lookup by Video ID
server.get('/api/v1/video/:id', async (request, reply) => {
  const params = request.params as { id: string };
  const videoId = extractVideoId(params.id) || params.id;

  const startTime = Date.now();

  // 1. Check Redis
  const cached = await getCachedAnalysis(videoId);
  if (cached) {
    const executionTimeMs = Date.now() - startTime;
    reply.header('X-Cache', 'HIT');
    reply.header('X-Execution-Time-Ms', executionTimeMs.toString());
    return { success: true, data: cached };
  }

  // 2. Check Database
  const dbReport = await repository.getCachedReport(videoId).catch(() => null);
  if (dbReport) {
    setCachedAnalysis(videoId, dbReport as any).catch(() => {});
    const executionTimeMs = Date.now() - startTime;
    reply.header('X-Cache', 'HIT');
    reply.header('X-Execution-Time-Ms', executionTimeMs.toString());
    return { success: true, data: dbReport };
  }

  return reply.status(404).send({
    success: false,
    error: `No cached analysis found for video ID "${videoId}". Run POST /api/v1/analyze first.`,
  });
});

// Crowd Feedback on Verdict Accuracy
server.post('/api/v1/feedback', async (request, reply) => {
  const body = request.body as {
    videoId?: string;
    userId?: string;
    isHelpful?: boolean;
    agreedWithVerdict?: boolean;
    userNotes?: string;
  } | undefined;

  if (!body?.videoId) {
    return reply.status(400).send({
      success: false,
      error: 'Missing required field "videoId".',
    });
  }

  const videoId = extractVideoId(body.videoId) || body.videoId;

  try {
    const feedback = await repository.recordFeedback({
      videoId,
      userId: body.userId,
      isHelpful: body.isHelpful ?? true,
      agreedWithVerdict: body.agreedWithVerdict ?? true,
      userNotes: body.userNotes,
    });

    return {
      success: true,
      message: 'Feedback recorded successfully',
      feedbackId: feedback.id,
    };
  } catch (error) {
    server.log.error(error);
    return reply.status(500).send({
      success: false,
      error: `Failed to record feedback: ${(error as Error).message}`,
    });
  }
});

// Debug / Testing endpoint for Ingestion Pipeline
server.post('/api/v1/debug/ingest', async (request, reply) => {
  const body = request.body as { url?: string; videoId?: string; maxComments?: number } | undefined;
  const input = body?.url || body?.videoId;

  if (!input) {
    return reply.status(400).send({
      success: false,
      error: 'Either "url" or "videoId" must be provided in request body.',
    });
  }

  const videoId = extractVideoId(input);
  if (!videoId) {
    return reply.status(400).send({
      success: false,
      error: `Could not parse valid YouTube video ID from "${input}".`,
    });
  }

  const startTime = Date.now();
  try {
    const result = await ingestVideo(videoId, { maxComments: body?.maxComments ?? 200 });
    const durationMs = Date.now() - startTime;

    // Run comment spam filter, bot-ring deduplicator, and tri-bucket sampler
    const filterResult = filterAndSampleComments(result.comments, {
      targetSampleCount: 100,
    });

    return {
      success: true,
      durationMs,
      videoId: result.videoId,
      metadata: result.metadata,
      commentsAnalysis: {
        rawCount: result.comments.length,
        telemetry: filterResult.telemetry,
        sampleCurated: filterResult.curatedComments.slice(0, 5),
        sampleSpamBlocked: filterResult.spamComments.slice(0, 3).map((s) => ({
          text: s.comment.text,
          author: s.comment.author,
          category: s.classification.category,
          reason: s.classification.reason,
        })),
      },
      transcriptSummary: {
        available: result.transcript.available,
        totalSegments: result.transcript.segments.length,
        preview: result.transcript.fullText.slice(0, 300) + (result.transcript.fullText.length > 300 ? '...' : ''),
      },
      fetchedAt: result.fetchedAt,
    };
  } catch (error) {
    server.log.error(error);
    return reply.status(500).send({
      success: false,
      error: (error as Error).message,
    });
  }
});

// Graceful start
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`🚀 VideoTrust API running at http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
