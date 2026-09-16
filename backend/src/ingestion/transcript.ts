import type { Innertube } from 'youtubei.js';
import type { TranscriptResult, TranscriptSegment } from './types.js';

/**
 * Extracts timestamped video transcript / captions via InnerTube.
 * Falls back gracefully if captions are disabled, unavailable, or auto-generation is missing.
 */
export async function fetchVideoTranscript(
  innertube: Innertube,
  videoId: string
): Promise<TranscriptResult> {
  try {
    const info = await innertube.getInfo(videoId);
    const transcriptInfo = await info.getTranscript();

    if (!transcriptInfo || !transcriptInfo.transcript) {
      return {
        available: false,
        fullText: '',
        segments: [],
      };
    }

    const rawSegments = (transcriptInfo.transcript as any)?.content?.body?.initial_segments || [];
    const segments: TranscriptSegment[] = [];

    for (const seg of rawSegments) {
      const text = seg.snippet?.text?.toString() || seg.snippet?.toString() || '';
      if (!text.trim()) continue;

      const startMs = Number(seg.start_ms) || 0;
      const endMs = Number(seg.end_ms) || startMs;
      const durationMs = Math.max(0, endMs - startMs);

      segments.push({
        startMs,
        durationMs,
        text: text.trim(),
      });
    }

    const fullText = segments.map((s) => s.text).join(' ');

    return {
      available: segments.length > 0,
      fullText,
      segments,
    };
  } catch {
    // Graceful fallback for videos without subtitles/captions
    return {
      available: false,
      fullText: '',
      segments: [],
    };
  }
}
