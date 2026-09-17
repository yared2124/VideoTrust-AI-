import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ingestVideo, extractVideoId } from './ingestion/index.js';
import { filterAndSampleComments } from './filter/index.js';
import { scoreAndAnalyzeVideo } from './scorer/index.js';

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

// Official SPEC-001 Analysis Endpoint
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
  try {
    // 1. Ingest raw metadata, comments, and transcript via InnerTube
    const rawData = await ingestVideo(videoId, { maxComments: 500 });

    // 2. Filter bot rings, spam, and extract balanced high-signal comment sample
    const filterResult = filterAndSampleComments(rawData.comments, {
      targetSampleCount: 120,
    });

    // 3. Deterministic Trust Scoring, Clickbait Divergence & Gemini Synthesis
    const report = await scoreAndAnalyzeVideo(rawData, filterResult, {
      isCached: false,
    });

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
