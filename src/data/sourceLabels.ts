import type { SourceFlag, CrawlJob } from '../types';
import { SOURCE_ALIASES } from './sourceAliases';

/**
 * User-facing names for source flags. The stored flag values are stable
 * identifiers used in the data layer; only these labels are shown in the UI.
 * Aliased sources resolve to a neutral name so their real name is not displayed.
 */
export const SOURCE_FLAG_LABELS: Record<SourceFlag, string> = {
  YouTubeSearch: 'Search',
  ChannelUploads: 'Uploads',
  Google: 'Google',
  Reddit: 'Reddit',
  X: 'X',
  LinkedIn: 'LinkedIn',
  Playlist: 'Playlist',
  Xvideos: SOURCE_ALIASES.Xvideos!,
  ArchiveOrg: 'Archive.org',
  PeerTube: 'PeerTube',
  Dailymotion: 'Dailymotion',
  Eporner: SOURCE_ALIASES.Eporner!,
  EmbedHub: SOURCE_ALIASES.EmbedHub!,
  RedGifs: SOURCE_ALIASES.RedGifs!,
  Pornhub: SOURCE_ALIASES.Pornhub!,
  Xhamster: SOURCE_ALIASES.Xhamster!,
  Redtube: SOURCE_ALIASES.Redtube!,
};

export const sourceFlagLabel = (flag: SourceFlag): string =>
  SOURCE_FLAG_LABELS[flag] ?? 'Other';

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
