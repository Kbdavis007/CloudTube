import type { SourceFlag, CrawlJob } from '../types';
import { ADULT_SOURCE_ALIASES } from './sourceAliases';

/**
 * User-facing names for source flags. The stored flag values are stable
 * identifiers used in the data layer; only these labels are shown in the UI.
 * Adult sources resolve to a neutral alias so their real name is not displayed.
 */
export const SOURCE_FLAG_LABELS: Record<SourceFlag, string> = {
  YouTubeSearch: 'Search',
  ChannelUploads: 'Uploads',
  Google: 'Google',
  Reddit: 'Reddit',
  X: 'X',
  LinkedIn: 'LinkedIn',
  Playlist: 'Playlist',
  Xvideos: ADULT_SOURCE_ALIASES.Xvideos!,
  ArchiveOrg: 'Archive.org',
  PeerTube: 'PeerTube',
  Dailymotion: 'Dailymotion',
  Eporner: ADULT_SOURCE_ALIASES.Eporner!,
  AdultEmbed: ADULT_SOURCE_ALIASES.AdultEmbed!,
  RedGifs: ADULT_SOURCE_ALIASES.RedGifs!,
  Pornhub: ADULT_SOURCE_ALIASES.Pornhub!,
  Xhamster: ADULT_SOURCE_ALIASES.Xhamster!,
  Redtube: ADULT_SOURCE_ALIASES.Redtube!,
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
