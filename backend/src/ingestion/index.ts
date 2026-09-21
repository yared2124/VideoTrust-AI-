import { getInnertubeClient } from './innertube.js';
import { fetchVideoMetadata } from './metadata.js';
import { fetchVideoComments } from './comments.js';
import { fetchVideoTranscript } from './transcript.js';
import type { IngestionResult, RawComment, RawVideoMetadata, TranscriptResult } from './types.js';

export * from './types.js';
export { getInnertubeClient } from './innertube.js';
export { fetchVideoMetadata } from './metadata.js';
export { fetchVideoComments } from './comments.js';
export { fetchVideoTranscript } from './transcript.js';

/**
 * Utility to parse an 11-character YouTube video ID from various URL formats.
 */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  // If already an 11-character alphanumeric string (plus - and _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    
    // https://www.youtube.com/watch?v=VIDEO_ID
    if (url.searchParams.has('v')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    }

    // https://youtu.be/VIDEO_ID
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // https://www.youtube.com/shorts/VIDEO_ID or /embed/VIDEO_ID
    const parts = url.pathname.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && /^[a-zA-Z0-9_-]{11}$/.test(lastPart)) {
      return lastPart;
    }
  } catch {
    return null;
  }

  return null;
}

export interface IngestOptions {
  maxComments?: number;
}

/**
 * Concurrently ingests metadata, comments, and transcript for a YouTube video.
 */
export async function ingestVideo(
  videoIdOrUrl: string,
  options: IngestOptions = {}
): Promise<IngestionResult> {
  const videoId = extractVideoId(videoIdOrUrl);
  if (!videoId) {
    throw new Error(`Invalid YouTube video ID or URL: "${videoIdOrUrl}"`);
  }

  const innertube = await getInnertubeClient();
  const maxComments = options.maxComments ?? 2000;

  // Execute extraction in parallel for lowest latency
  const [metadataSettled, commentsSettled, transcriptSettled] = await Promise.allSettled([
    fetchVideoMetadata(innertube, videoId),
    fetchVideoComments(innertube, videoId, maxComments),
    fetchVideoTranscript(innertube, videoId),
  ]);

  if (metadataSettled.status === 'rejected') {
    throw new Error(`Failed to fetch metadata for video ${videoId}: ${metadataSettled.reason?.message || 'Unknown error'}`);
  }

  const metadata: RawVideoMetadata = metadataSettled.value;
  const comments: RawComment[] = commentsSettled.status === 'fulfilled' ? commentsSettled.value : [];
  const transcript: TranscriptResult = transcriptSettled.status === 'fulfilled' ? transcriptSettled.value : {
    available: false,
    fullText: '',
    segments: [],
  };

  return {
    videoId,
    metadata,
    comments,
    transcript,
    fetchedAt: new Date().toISOString(),
  };
}
