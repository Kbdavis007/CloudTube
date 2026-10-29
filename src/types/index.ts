export type SourceFlag =
  | 'YouTubeSearch'
  | 'ChannelUploads'
  | 'Google'
  | 'Reddit'
  | 'X'
  | 'LinkedIn'
  | 'Playlist';

export interface VideoMetadata {
  id: string; // Internal UUID
  youtubeId: string; // 11-char YouTube ID
  title: string;
  description: string;
  tags: string[];
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  duration: string; // e.g. "PT18M42S"
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
    maxres?: string;
  };
  sourceFlags: SourceFlag[];
  indexedAt: string;
  lastUpdatedAt: string;
  // AI Summary persisted in metadata database
  aiSummary?: string;
  aiSummaryGeneratedAt?: string;
  // Personal Metadata (joined or embedded)
  personal?: PersonalMetadata;
}

export interface PersonalMetadata {
  videoId: string; // YouTube ID or UUID
  indexScore: number; // 1 = best, 100 = worst
  userRating: number; // 0–100 (or 0–5 star conversion)
  userNotes: string;
  userTags: string[];
  lastViewedAt?: string;
  isFavorite?: boolean;
  watchProgressSeconds?: number;
}

export interface ChannelMetadata {
  channelId: string;
  title: string;
  description: string;
  customUrl?: string;
  publishedAt: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  isExpanded: boolean;
  lastExpandedAt?: string;
  expandedVideoCount?: number;
}

export interface VideoComment {
  id: string;
  videoId: string;
  authorName: string;
  authorChannelId: string;
  authorAvatar: string;
  text: string;
  likes: number;
  publishedAt: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface CrawlJob {
  id: string;
  type: 'search' | 'channel_expansion' | 'web_gap' | 'playlist' | 'comment_harvest';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  queryOrTarget: string;
  itemsFound: number;
  progressPct: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface CloudflareQuotaStatus {
  workersRequests: { current: number; limit: number; unit: string };
  d1RowsRead: { current: number; limit: number; unit: string };
  d1RowsWritten: { current: number; limit: number; unit: string };
  r2StorageGB: { current: number; limit: number; unit: string };
  r2ClassBOps: { current: number; limit: number; unit: string };
  kvReads: { current: number; limit: number; unit: string };
  kvWrites: { current: number; limit: number; unit: string };
  queueMessages: { current: number; limit: number; unit: string };
  durableObjectsRequests: { current: number; limit: number; unit: string };
}

export interface WizardState {
  step: number; // 1: Welcome & Auth, 2: Auto-Provision, 3: Encrypted Storage, 4: Validate Health, 5: Complete
  accountId: string;
  apiToken: string;
  useSimulation: boolean;
  status: {
    r2Bucket: 'idle' | 'in_progress' | 'success' | 'error';
    d1Database: 'idle' | 'in_progress' | 'success' | 'error';
    kvNamespace: 'idle' | 'in_progress' | 'success' | 'error';
    queue: 'idle' | 'in_progress' | 'success' | 'error';
    durableObject: 'idle' | 'in_progress' | 'success' | 'error';
    tokenScoped: 'idle' | 'in_progress' | 'success' | 'error';
  };
  details: {
    r2BucketName?: string;
    d1DatabaseId?: string;
    kvNamespaceId?: string;
    queueName?: string;
    doNamespace?: string;
  };
  validationResults: {
    d1Health: boolean;
    kvHealth: boolean;
    r2Health: boolean;
    queueHealth: boolean;
    workerHealth: boolean;
  };
  errorMsg?: string;
}

export interface ScaffoldFile {
  path: string;
  category: 'wrangler' | 'worker' | 'durable-objects' | 'queues' | 'schemas' | 'providers' | 'pwa' | 'setup';
  description: string;
  language: string;
  code: string;
}
