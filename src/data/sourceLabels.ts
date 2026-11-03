import type { SourceFlag, CrawlJob } from '../types';

/**
 * User-facing names for source flags. The stored flag values are stable
 * identifiers used in the data layer; only these labels are shown in the UI.
 */
export const SOURCE_FLAG_LABELS: Record<SourceFlag, string> = {
  YouTubeSearch: 'Search',
  ChannelUploads: 'Uploads',
  Google: 'Google',
  Reddit: 'Reddit',
  X: 'X',
  LinkedIn: 'LinkedIn',
  Playlist: 'Playlist',
  Xvideos: 'XVideos',
  ArchiveOrg: 'Archive.org',
  PeerTube: 'PeerTube',
  Dailymotion: 'Dailymotion',
  Eporner: 'Eporner',
  AdultEmbed: 'AdultEmbed',
  RedGifs: 'RedGifs',
  Pornhub: 'Pornhub',
  Xhamster: 'xHamster',
  Redtube: 'RedTube',
};

export const sourceFlagLabel = (flag: SourceFlag): string =>
  SOURCE_FLAG_LABELS[flag] ?? flag;

/**
 * User-facing names for background activity types. Mirrors the crawl job
 * identifiers in the data layer.
 */
export const JOB_TYPE_LABELS: Record<CrawlJob['type'], string> = {
  search: 'Search',
  channel_expansion: 'Channel Collect',
  web_gap: 'Web Discovery',
  playlist: 'Playlist',
  comment_harvest: 'Comment Collect',
};

export const jobTypeLabel = (type: CrawlJob['type']): string =>
  JOB_TYPE_LABELS[type] ?? type.replace('_', ' ');
