import type { SourceFlag, VideoMetadata } from '../types';

/**
 * One filter/sort model shared by every place that lists videos — the saved
 * library, live search results, and the baked catalogue. Keeping it in one
 * module means the three lists behave the same and cannot drift apart.
 */

export type ScoreFilter = 'all' | 'elite' | 'good' | 'low';
export type RatingFilter = 'all' | 'rated' | 'unrated' | 'favorites';
export type DurationFilter = 'all' | 'short' | 'medium' | 'long';
export type VideoSort =
  | 'score'
  | 'rating'
  | 'date_desc'
  | 'date_asc'
  | 'title'
  | 'channel'
  | 'duration'
  | 'views';

export interface VideoFilterState {
  /** Free-text query over title, channel, description and tags. */
  query: string;
  source: SourceFlag | 'ALL';
  channel: string | 'ALL';
  tag: string | 'ALL';
  score: ScoreFilter;
  rating: RatingFilter;
  duration: DurationFilter;
  publishedFrom: string;
  publishedTo: string;
  sort: VideoSort;
}

export const DEFAULT_VIDEO_FILTERS: VideoFilterState = {
  query: '',
  source: 'ALL',
  channel: 'ALL',
  tag: 'ALL',
  score: 'all',
  rating: 'all',
  duration: 'all',
  publishedFrom: '',
  publishedTo: '',
  sort: 'score',
};

/** Does any filter or the sort differ from the default (so "Clear" is offered)? */
export function hasActiveVideoFilters(filters: VideoFilterState): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.source !== 'ALL' ||
    filters.channel !== 'ALL' ||
    filters.tag !== 'ALL' ||
    filters.score !== 'all' ||
    filters.rating !== 'all' ||
    filters.duration !== 'all' ||
    filters.publishedFrom !== '' ||
    filters.publishedTo !== '' ||
    filters.sort !== DEFAULT_VIDEO_FILTERS.sort
  );
}

/** Every tag across a set of videos, with counts, most common first. */
export function collectTagOptions(videos: readonly VideoMetadata[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const video of videos) {
    for (const tag of [...(video.tags ?? []), ...(video.personal?.userTags ?? [])]) {
      const key = tag.trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Every channel across a set of videos, with counts, most common first. */
export function collectChannelOptions(videos: readonly VideoMetadata[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const video of videos) {
    if (!video.channelId) continue;
    counts.set(video.channelId, (counts.get(video.channelId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Every source flag across a set of videos, with counts, most common first. */
export function collectSourceOptions(videos: readonly VideoMetadata[]): [SourceFlag, number][] {
  const counts = new Map<SourceFlag, number>();
  for (const video of videos) {
    for (const flag of video.sourceFlags ?? []) counts.set(flag, (counts.get(flag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Whether a video passes every filter. Sort order is applied separately. */
export interface VideoFilterOptions {
  /**
   * Extra text to include in the free-text search for a video. The catalogue
   * uses this to search fields its records carry (actors, category) that the
   * common video model does not expose.
   */
  extraSearchText?: (video: VideoMetadata) => string | undefined;
}

export function matchesVideoFilters(
  video: VideoMetadata,
  filters: VideoFilterState,
  options: VideoFilterOptions = {}
): boolean {
  const tokens = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    const extra = options.extraSearchText?.(video) ?? '';
    const haystack = `${video.title} ${video.channelTitle} ${video.description} ${(video.tags || []).join(' ')} ${extra}`.toLowerCase();
    // Every term must appear somewhere, so adding terms narrows the list.
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }

  if (filters.source !== 'ALL' && !(video.sourceFlags ?? []).includes(filters.source)) return false;
  if (filters.channel !== 'ALL' && video.channelId !== filters.channel) return false;

  if (filters.tag !== 'ALL') {
    const videoTags = [...(video.tags || []), ...(video.personal?.userTags ?? [])];
    if (!videoTags.some((tag) => tag.trim() === filters.tag)) return false;
  }

  const score = video.personal?.indexScore ?? 50;
  if (filters.score === 'elite' && score > 20) return false;
  if (filters.score === 'good' && score > 50) return false;
  if (filters.score === 'low' && score < 70) return false;

  const rating = video.personal?.userRating ?? 0;
  if (filters.rating === 'rated' && rating <= 0) return false;
  if (filters.rating === 'unrated' && rating > 0) return false;
  if (filters.rating === 'favorites' && !video.personal?.isFavorite) return false;

  const seconds = video.durationSeconds || 0;
  if (filters.duration === 'short' && seconds >= 300) return false;
  if (filters.duration === 'medium' && (seconds < 300 || seconds > 1200)) return false;
  if (filters.duration === 'long' && seconds <= 1200) return false;

  if (filters.publishedFrom || filters.publishedTo) {
    const from = filters.publishedFrom ? new Date(filters.publishedFrom).getTime() : null;
    const to = filters.publishedTo ? new Date(filters.publishedTo).getTime() : null;
    const published = new Date(video.publishedAt).getTime();
    if (from !== null && published < from) return false;
    if (to !== null && published > to) return false;
  }

  return true;
}

function compareVideos(a: VideoMetadata, b: VideoMetadata, sort: VideoSort): number {
  switch (sort) {
    case 'rating':
      return (b.personal?.userRating ?? 0) - (a.personal?.userRating ?? 0);
    case 'date_desc':
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    case 'date_asc':
      return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
    case 'title':
      return a.title.localeCompare(b.title);
    case 'channel':
      return a.channelTitle.localeCompare(b.channelTitle);
    case 'duration':
      return (b.durationSeconds || 0) - (a.durationSeconds || 0);
    case 'views':
      return (b.viewCount || 0) - (a.viewCount || 0);
    case 'score':
    default:
      return (a.personal?.indexScore ?? 50) - (b.personal?.indexScore ?? 50);
  }
}

/** Filter and sort a list of videos. Returns a new array. */
export function filterAndSortVideos(
  videos: readonly VideoMetadata[],
  filters: VideoFilterState,
  options: VideoFilterOptions = {}
): VideoMetadata[] {
  return videos
    .filter((video) => matchesVideoFilters(video, filters, options))
    .slice()
    .sort((a, b) => compareVideos(a, b, filters.sort));
}

/** Sort a list of videos by the model's sort key. Returns a new array. */
export function sortVideos(
  videos: readonly VideoMetadata[],
  sort: VideoSort
): VideoMetadata[] {
  return videos.slice().sort((a, b) => compareVideos(a, b, sort));
}

/** Slice a list into the page at `page`, clamped to the valid range. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): {
  page: number;
  pageCount: number;
  items: T[];
} {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * pageSize;
  return {
    page: safePage,
    pageCount,
    items: items.slice(start, start + pageSize),
  };
}
