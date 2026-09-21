import type { Innertube } from 'youtubei.js';
import type { RawComment } from './types.js';

/**
 * Extracts comments from a YouTube video using InnerTube's continuation token loop.
 * Paginates until reaching `maxComments` or exhausting comment threads.
 */
export async function fetchVideoComments(
  innertube: Innertube,
  videoId: string,
  maxComments = 2000
): Promise<RawComment[]> {
  const comments: RawComment[] = [];
  const startTime = Date.now();
  const maxTimeoutMs = 12000; // 12-second safety cutoff to guarantee responsiveness

  try {
    let commentFeed = await innertube.getComments(videoId);
    let iterations = 0;
    const maxIterations = 70; // Supports fetching up to 2000+ comments

    while (
      commentFeed &&
      comments.length < maxComments &&
      iterations < maxIterations &&
      Date.now() - startTime < maxTimeoutMs
    ) {
      iterations++;

      const threads = commentFeed.contents || [];
      for (const thread of threads) {
        if (comments.length >= maxComments) break;

        try {
          const raw = (thread as any).comment;
          if (!raw) continue;

          const text = raw.content?.toString() || raw.content?.text || '';
          if (!text.trim()) continue;

          // Parse vote / like count
          const voteText = raw.vote_count?.text || raw.vote_count?.toString() || '0';
          let likeCount = 0;
          if (voteText.includes('K')) {
            likeCount = Math.round(parseFloat(voteText.replace('K', '')) * 1000);
          } else if (voteText.includes('M')) {
            likeCount = Math.round(parseFloat(voteText.replace('M', '')) * 1000000);
          } else {
            likeCount = parseInt(voteText.replace(/,/g, ''), 10) || 0;
          }

          const authorThumbnail = raw.author?.thumbnails?.[0]?.url;

          comments.push({
            id: raw.comment_id || `comment-${comments.length + 1}`,
            author: raw.author?.name?.text || raw.author?.name?.toString() || 'Anonymous',
            authorThumbnail,
            text,
            likeCount,
            publishedTime: raw.published_time?.text || raw.published_time?.toString() || '',
            isPinned: Boolean(raw.is_pinned),
            replyCount: Number((thread as any).reply_count) || 0,
          });
        } catch {
          // Skip malformed individual comment
          continue;
        }
      }

      // Check if more comments are available
      if (commentFeed.has_continuation && comments.length < maxComments) {
        commentFeed = await commentFeed.getContinuation();
      } else {
        break;
      }
    }
  } catch (error) {
    // Comments may be disabled on this video
    const msg = (error as Error).message || '';
    if (msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('comments are turned off')) {
      return [];
    }
    // Return whatever comments were gathered so far instead of failing the entire analysis
    return comments;
  }

  return comments;
}
