import type { RawComment } from '../ingestion/types.js';

export type SpamCategory =
  | 'scam_regex'
  | 'emoji_flood'
  | 'bot_duplicate'
  | 'too_short'
  | 'promotional_link';

export interface SpamClassification {
  isSpam: boolean;
  category?: SpamCategory;
  reason?: string;
}

export type CommentBucket = 'top' | 'recent' | 'long_form' | 'keyword_boosted';

export interface CuratedComment extends RawComment {
  bucket: CommentBucket;
  signalScore: number;
  matchedKeywords: string[];
}

export interface FilterTelemetry {
  totalInputComments: number;
  spamDetectedCount: number;
  botDuplicatesCount: number;
  curatedSampleCount: number;
  bucketDistribution: Record<CommentBucket, number>;
  spamBreakdown: Record<SpamCategory, number>;
}

export interface FilterResult {
  curatedComments: CuratedComment[];
  spamComments: Array<{ comment: RawComment; classification: SpamClassification }>;
  telemetry: FilterTelemetry;
}
