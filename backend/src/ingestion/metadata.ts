import type { Innertube } from 'youtubei.js';
import type { RawVideoMetadata } from './types.js';

/**
 * Extracts and normalizes video metadata from InnerTube.
 */
export async function fetchVideoMetadata(
  innertube: Innertube,
  videoId: string
): Promise<RawVideoMetadata> {
  const info = await innertube.getInfo(videoId);
  const basic = info.basic_info;

  const views = Number(basic.view_count) || 0;
  const likes = Number(basic.like_count) || 0;
  const likeRatio = views > 0 ? Number((likes / views).toFixed(4)) : 0;
  const durationSeconds = Number(basic.duration) || 0;

  // Best quality thumbnail is typically the last item in the array
  const thumbnails = basic.thumbnail || [];
  const bestThumbnail = thumbnails.length > 0 
    ? thumbnails[thumbnails.length - 1]?.url 
    : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    videoId,
    title: basic.title || 'Unknown Title',
    description: basic.short_description || '',
    channelTitle: basic.author || 'Unknown Channel',
    channelId: basic.channel_id || '',
    views,
    likes,
    likeRatio,
    durationSeconds,
    publishedAt: (basic as any).upload_date || (basic as any).start_timestamp || new Date().toISOString(),
    thumbnailUrl: bestThumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}
