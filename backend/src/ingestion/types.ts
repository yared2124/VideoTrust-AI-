export interface RawVideoMetadata {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  views: number;
  likes: number;
  likeRatio: number;
  durationSeconds: number;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface RawComment {
  id: string;
  author: string;
  authorThumbnail?: string;
  text: string;
  likeCount: number;
  publishedTime: string;
  isPinned: boolean;
  replyCount: number;
}

export interface TranscriptSegment {
  startMs: number;
  durationMs: number;
  text: string;
}

export interface TranscriptResult {
  available: boolean;
  fullText: string;
  segments: TranscriptSegment[];
}

export interface IngestionResult {
  videoId: string;
  metadata: RawVideoMetadata;
  comments: RawComment[];
  transcript: TranscriptResult;
  fetchedAt: string;
}
