/**
 * Baked catalogue loader.
 *
 * The catalogue is a static JSON file committed under `src/data/` and imported
 * here, so it is bundled into the build (Vite inlines it; `resolveJsonModule` is
 * on). There is no runtime fetch and no network dependency: every video the app
 * can browse comes from this one file, which may carry records from several
 * sources at once (each record names its `sourceId`).
 *
 * Records are mapped onto the app's `VideoMetadata` so an indexed catalogue
 * video is indistinguishable from one discovered any other way.
 */

import type { VideoMetadata } from '../types';
import catalogFile from '../data/vegaCatalog.json';

export interface CatalogSource {
  id: string;
  name: string;
  flag: VideoMetadata['sourceFlags'][number];
  tagline: string;
}

/** One video, from whichever source produced it. */
export interface CatalogVideo {
  sourceId: string;
  /** Source-native id; the slug in the source's page URL. */
  sourceVideoId: string;
  title: string;
  description: string;
  tags: string[];
  actors: string[];
  category: string;
  quality: string;
  durationSeconds: number;
  thumbnail: string;
  previewThumbnail: string;
  embedUrl: string;
  pageUrl: string;
  uploader: string;
  publishedDate: string;
  viewCount: number;
  isPremium: boolean;
}

interface CatalogFile {
  schemaVersion: number;
  generatedAt: string;
  sources: CatalogSource[];
  videos: CatalogVideo[];
}

const CATALOG = catalogFile as unknown as CatalogFile;

export const CATALOG_SOURCES: CatalogSource[] = CATALOG.sources;
export const CATALOG_GENERATED_AT: string = CATALOG.generatedAt;

const SOURCE_BY_ID = new Map(CATALOG_SOURCES.map((s) => [s.id, s]));

export const catalogSourceById = (id: string): CatalogSource | undefined => SOURCE_BY_ID.get(id);

/** The baked catalogue. Parsed once at module load. */
export function loadBakedCatalog(): CatalogVideo[] {
  return CATALOG.videos;
}

export function countBakedCatalog(): number {
  return CATALOG.videos.length;
}

/** `<sourceId>:<sourceVideoId>` - the store key; cannot collide with a YouTube id. */
export const catalogKey = (video: Pick<CatalogVideo, 'sourceId' | 'sourceVideoId'>): string =>
  `${video.sourceId}:${video.sourceVideoId}`;

/** Format seconds as an ISO-8601 duration so existing UI formatting still works. */
export function toIsoDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  let out = 'PT';
  if (h) out += `${h}H`;
  if (m || h) out += `${m}M`;
  out += `${s}S`;
  return out;
}

/** Map a catalogue record onto the app's video model. */
export function catalogToVideoMetadata(record: CatalogVideo): VideoMetadata {
  const source = catalogSourceById(record.sourceId);
  const key = catalogKey(record);
  const now = new Date().toISOString();
  const uploader = record.uploader.trim();

  return {
    id: crypto.randomUUID(),
    youtubeId: key,
    title: record.title,
    description: record.description,
    tags: record.tags,
    channelId: `${record.sourceId}-uploader:${uploader.toLowerCase() || 'unknown'}`,
    channelTitle: uploader || 'Unknown uploader',
    publishedAt: record.publishedDate || now,
    duration: toIsoDuration(record.durationSeconds),
    durationSeconds: record.durationSeconds,
    // Engagement counts the source does not expose stay at zero rather than
    // being invented.
    viewCount: record.viewCount || 0,
    likeCount: 0,
    commentCount: 0,
    thumbnails: {
      default: record.thumbnail,
      medium: record.thumbnail,
      high: record.thumbnail,
    },
    posterUrl: record.previewThumbnail || record.thumbnail,
    sourceVideoId: record.sourceVideoId,
    playback: record.embedUrl
      ? { embedUrl: record.embedUrl, externalUrl: record.pageUrl }
      : undefined,
    sourceFlags: source ? [source.flag] : [],
    indexedAt: now,
    lastUpdatedAt: now,
    personal: {
      videoId: key,
      indexScore: 50,
      userRating: 70,
      userNotes: '',
      userTags: source ? [`${source.name}-Imported`] : [],
    },
  };
}

export interface CatalogSearchResult {
  record: CatalogVideo;
  score: number;
}

/**
 * Rank the catalogue against a query. Every whitespace-separated token must
 * appear somewhere (title, tags, actors, category, uploader), so adding terms
 * narrows rather than widens. Title matches weigh most; ties break on recency.
 */
export function searchCatalog(
  records: CatalogVideo[],
  query: string,
  limit = 60
): CatalogSearchResult[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return records.slice(0, limit).map((record) => ({ record, score: 0 }));
  }

  const phrase = query.toLowerCase().trim();
  const results: CatalogSearchResult[] = [];

  for (const record of records) {
    const title = record.title.toLowerCase();
    const tags = record.tags.join(' ').toLowerCase();
    const actors = record.actors.join(' ').toLowerCase();
    const category = record.category.toLowerCase();
    const uploader = record.uploader.toLowerCase();
    const haystack = `${title} ${tags} ${actors} ${category} ${uploader}`;

    let score = 0;
    let matchedAll = true;

    for (const token of tokens) {
      if (!haystack.includes(token)) {
        matchedAll = false;
        break;
      }
      if (title.includes(token)) score += 3;
      if (tags.includes(token)) score += 2;
      if (actors.includes(token)) score += 2;
      if (category.includes(token)) score += 1;
      if (uploader.includes(token)) score += 1;
    }

    if (!matchedAll) continue;

    if (title.includes(phrase)) score += 5;
    results.push({ record, score });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.record.publishedDate || '').localeCompare(a.record.publishedDate || '');
  });

  return results.slice(0, limit);
}
