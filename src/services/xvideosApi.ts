/**
 * XVideos source adapter.
 *
 * XVideos publishes an official bulk export of its embeddable catalogue for
 * webmasters (https://info.xvideos.net/db) as a semicolon-delimited CSV inside a
 * gzip. There is no API and no auth: the file is meant to be downloaded and
 * imported wholesale.
 *
 * The export CDN sends no CORS headers, so the browser cannot fetch it directly.
 * Requests go through the same-origin proxy at /api/xvideos/export (see
 * server.ts and worker/index.ts), which just streams the file through.
 *
 * Parsing lives here, on the client, for two reasons: the catalogue is large
 * (the weekly export alone is ~12k rows), and decompressing it in the Worker
 * would risk the free tier's CPU limit.
 */

import type { VideoMetadata } from '../types';

export type XvideosExportRange = 'week' | 'full';

/** The export URLs the proxy knows how to reach. */
export const XVIDEOS_EXPORT_RANGES: Record<XvideosExportRange, string> = {
  week: 'https://public-assets.xvideos-cdn.com/webmaster-tools/xvideos.com-export-week.csv.gz',
  full: 'https://public-assets.xvideos-cdn.com/webmaster-tools/xvideos.com-export-full.csv.gz',
};

/**
 * One row of the export. Field order is fixed and verified against the live
 * file (15 columns, no quoting, no embedded separators):
 *
 *   0 page URL   1 title       2 "N sec" duration  3 thumb URL  4 embed <iframe>
 *   5 tags       6 actors      7 numeric id        8 category   9 quality
 *  10 uploader  11 preview thumb  12 date (YYYY-MM-DD)  13 (unused)  14 premium flag
 */
export interface XvideosRecord {
  pageUrl: string;
  title: string;
  durationSeconds: number;
  thumbUrl: string;
  embedUrl: string;
  tags: string[];
  actors: string[];
  videoId: string;
  category: string;
  quality: string;
  uploader: string;
  previewThumbUrl: string;
  date: string;
  isPremium: boolean;
}

const EMBED_SRC = /src=["']?([^"'\s>]+)["']?/i;
const SLUG = /\/video\.([A-Za-z0-9_-]+)\//;
const DURATION_SECONDS = /(\d+)\s*sec/i;

const clean = (value: string | undefined): string => (value ?? '').trim();

const splitList = (value: string): string[] =>
  clean(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

/** Pull the embeddable player URL out of the export's raw `<iframe>` snippet. */
export function extractEmbedUrl(embedCode: string): string {
  const match = EMBED_SRC.exec(embedCode);
  return match ? match[1] : '';
}

/** The stable per-video identifier: the slug in the page URL (e.g. `olhfcmubbc1`). */
export function extractSlug(pageUrl: string): string {
  const match = SLUG.exec(pageUrl);
  return match ? match[1] : '';
}

/**
 * Parse a single export line. Returns null for blank or short lines so a
 * truncated final line cannot poison the whole import.
 */
export function parseXvideosLine(line: string): XvideosRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const f = trimmed.split(';');
  if (f.length < 15) return null;

  const pageUrl = clean(f[0]);
  const slug = extractSlug(pageUrl);
  if (!slug) return null;

  const durationMatch = DURATION_SECONDS.exec(f[2]);

  return {
    pageUrl,
    title: clean(f[1]),
    durationSeconds: durationMatch ? parseInt(durationMatch[1], 10) : 0,
    thumbUrl: clean(f[3]),
    embedUrl: extractEmbedUrl(f[4]),
    tags: splitList(f[5]),
    actors: splitList(f[6]),
    videoId: clean(f[7]),
    category: clean(f[8]),
    quality: clean(f[9]),
    uploader: clean(f[10]),
    previewThumbUrl: clean(f[11]),
    date: clean(f[12]),
    isPremium: clean(f[14]) === '1',
  };
}

export function parseXvideosCsv(csv: string): XvideosRecord[] {
  const records: XvideosRecord[] = [];
  for (const line of csv.split('\n')) {
    const record = parseXvideosLine(line);
    if (record) records.push(record);
  }
  return records;
}

/** Format a duration as an ISO-8601 duration so existing UI formatting still works. */
export function toIsoDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `PT${hours > 0 ? `${hours}H` : ''}${minutes > 0 ? `${minutes}M` : ''}${secs}S`;
}

/** `xv:<slug>` cannot collide with a real 11-character YouTube id. */
export const xvideosKey = (slug: string): string => `xv:${slug}`;

/**
 * Map a catalogue row onto the app's video model. `youtubeId` keeps its role as
 * the store key (the videos store is keyed by it), holding the namespaced slug.
 */
export function xvideosRecordToVideo(record: XvideosRecord): VideoMetadata {
  const slug = extractSlug(record.pageUrl) || record.videoId;
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    youtubeId: xvideosKey(slug),
    title: record.title,
    description: record.category ? `${record.category}${record.uploader ? ` · ${record.uploader}` : ''}` : '',
    tags: [...record.tags, ...record.actors],
    channelId: `xv-uploader:${record.uploader || 'unknown'}`,
    channelTitle: record.uploader || 'Unknown uploader',
    publishedAt: record.date || now,
    duration: toIsoDuration(record.durationSeconds),
    durationSeconds: record.durationSeconds,
    // The export carries no engagement stats, so these stay at zero rather than
    // being invented. IndexScore falls back to a neutral value accordingly.
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    thumbnails: {
      default: record.thumbUrl,
      medium: record.thumbUrl,
      high: record.thumbUrl,
    },
    posterUrl: record.previewThumbUrl || record.thumbUrl,
    sourceVideoId: slug,
    playback: record.embedUrl
      ? { embedUrl: record.embedUrl, externalUrl: record.pageUrl }
      : undefined,
    sourceFlags: ['Xvideos'],
    indexedAt: now,
    lastUpdatedAt: now,
    personal: {
      videoId: xvideosKey(slug),
      indexScore: 50,
      userRating: 70,
      userNotes: '',
      userTags: ['XVideos-Imported'],
    },
  };
}

export interface XvideosFetchOptions {
  signal?: AbortSignal;
  onProgress?: (recordCount: number, bytes: number) => void;
}

/** Fetch the export through the same-origin proxy and decompress it as a stream. */
async function openXvideosStream(
  range: XvideosExportRange,
  options: XvideosFetchOptions = {}
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const response = await fetch(`/api/xvideos/export?range=${range}`, { signal: options.signal });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `XVideos export request failed (${response.status}). ${detail.slice(0, 200)}`.trim()
    );
  }
  if (!response.body) throw new Error('XVideos export returned no body.');

  // The proxy passes the gzip through untouched, so decompress here. Fall back to
  // the raw stream if the runtime lacks DecompressionStream, which would only
  // matter for an un-gzipped response.
  const body =
    typeof DecompressionStream === 'function'
      ? response.body.pipeThrough(new DecompressionStream('gzip'))
      : response.body;

  return body.getReader();
}

/**
 * Stream the export, handing each parsed record to `onRecord`. Streaming keeps
 * memory flat, which matters for the full export (~7M rows).
 */
export async function streamXvideosExport(
  range: XvideosExportRange,
  onRecord: (record: XvideosRecord) => void,
  options: XvideosFetchOptions & { maxRecords?: number } = {}
): Promise<number> {
  const reader = await openXvideosStream(range, options);
  const decoder = new TextDecoder();
  let buffer = '';
  let count = 0;
  let bytes = 0;

  const emit = (line: string): boolean => {
    const record = parseXvideosLine(line);
    if (!record) return true;
    onRecord(record);
    count++;
    if (count % 500 === 0) options.onProgress?.(count, bytes);
    return options.maxRecords === undefined || count < options.maxRecords;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!emit(line)) return count;
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer) emit(buffer);
  } finally {
    reader.cancel().catch(() => undefined);
  }

  options.onProgress?.(count, bytes);
  return count;
}

/** Load the whole catalogue into memory. Intended for the weekly export. */
export async function loadXvideosCatalog(
  range: XvideosExportRange = 'week',
  options: XvideosFetchOptions = {}
): Promise<XvideosRecord[]> {
  const records: XvideosRecord[] = [];
  await streamXvideosExport(range, (record) => records.push(record), options);
  return records;
}

export interface XvideosSearchResult {
  record: XvideosRecord;
  score: number;
}

/**
 * Rank the catalogue against a query. Every whitespace-separated token must
 * appear somewhere (title, tags, actors, category, uploader), so adding terms
 * narrows rather than widens. Title matches weigh most; ties break on recency.
 */
export function searchXvideosCatalog(
  catalog: XvideosRecord[],
  query: string,
  limit = 60
): XvideosSearchResult[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return catalog.slice(0, limit).map((record) => ({ record, score: 0 }));
  }

  const results: XvideosSearchResult[] = [];
  const phrase = query.toLowerCase().trim();

  for (const record of catalog) {
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

    // Reward an exact phrase hit so the most literal result floats to the top.
    if (title.includes(phrase)) score += 5;
    results.push({ record, score });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.record.date || '').localeCompare(a.record.date || '');
  });

  return results.slice(0, limit);
}
