/**
 * Server-side search adapters for the cached search API.
 *
 * These mirror the browser adapters in `src/services/openSourcesApi.ts`, but run
 * inside the Worker so results can be cached in D1 and served from the edge. The
 * parsing is intentionally a copy rather than a shared import: the browser
 * adapters carry key-gated sources that must never send the user's RapidAPI key
 * from the Worker, and the Worker adds the Cloudflare-only upstreams (RedGifs).
 *
 * Only sources that are key-free and reachable from a shared Worker IP live
 * here. Key-gated sources stay browser-direct, so the user's key is never
 * uploaded.
 */

import { ADULT_SOURCE_ALIASES } from '../src/data/sourceAliases';
import { openSourceById, toVideoMetadata, type OpenSourceId } from '../src/services/videoShape';
import { searchRedGifsGifs } from '../src/services/redgifsApi';
import type { VideoMetadata } from '../src/types';

const openSource = (id: OpenSourceId) => openSourceById(id);

async function fetchJson(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
}

/** Archive.org runtime is "MM:SS", "H:MM:SS" or a plain second count. */
function parseRuntime(runtime: unknown): number {
  const value = Array.isArray(runtime) ? runtime[0] : runtime;
  if (value == null) return 0;
  const text = String(value).trim();
  if (text.includes(':')) {
    return text
      .split(':')
      .map((part) => Number(part) || 0)
      .reduce((acc, part) => acc * 60 + part, 0);
  }
  const seconds = Number(text);
  return Number.isFinite(seconds) ? seconds : 0;
}

/** Convert Eporner's `YYYY-MM-DD HH:MM:SS` timestamp to ISO, or '' if unparseable. */
function toIsoOrEmpty(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** AdultEmbed returns categories/tags/performers as `{ name }` objects. */
function namesOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .slice(0, 8);
}

function parseClock(value: unknown): number {
  if (typeof value !== 'string' || !value.includes(':')) return 0;
  return value
    .split(':')
    .map((part) => Number(part) || 0)
    .reduce((acc, part) => acc * 60 + part, 0);
}

/** Durations here are "MM:SS", "H:MM:SS" or "2min"; parse to seconds. */
function dureeToSeconds(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const text = value.trim().toLowerCase();
  if (text.includes(':')) return parseClock(text);
  const minutes = text.match(/(\d+(?:[.,]\d+)?)\s*(?:min|m)\b/);
  if (minutes) return Math.round(parseFloat(minutes[1].replace(',', '.')) * 60);
  const seconds = text.match(/(\d+)\s*s/);
  return seconds ? Number(seconds[1]) : 0;
}

/** The id each site's embed URL needs, taken from the result link's last segment. */
function embedIdFromLink(link: string): string {
  const path = link.split('?')[0].replace(/\/+$/, '');
  return path.split('/').pop() ?? '';
}

function embedUrlFor(site: 'xhamster' | 'redtube', id: string): string {
  if (!id) return '';
  return site === 'redtube'
    ? `https://embed.redtube.com/?id=${encodeURIComponent(id)}`
    : `https://xhamster.com/embed/${encodeURIComponent(id)}`;
}

async function searchArchive(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const q = `(${query}) AND mediatype:(movies)`;
  const url =
    'https://archive.org/advancedsearch.php?q=' +
    encodeURIComponent(q) +
    '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=description&fl%5B%5D=creator' +
    '&fl%5B%5D=date&fl%5B%5D=subject&fl%5B%5D=publicdate&fl%5B%5D=runtime' +
    '&rows=24&page=1&output=json';
  const data = await fetchJson(url, signal);
  const docs: any[] = data?.response?.docs ?? [];

  return docs
    .filter((d) => d?.identifier)
    .map((d) =>
      toVideoMetadata(openSource('archive'), {
        sourceVideoId: d.identifier,
        title: String(d.title ?? d.identifier),
        description: String(d.description ?? '').replace(/<[^>]+>/g, '').slice(0, 400),
        channelId: `archive:${d.creator ?? 'unknown'}`,
        channelTitle: String(d.creator ?? 'Internet Archive'),
        publishedAt: d.date || d.publicdate || '',
        durationSeconds: parseRuntime(d.runtime),
        thumbnail: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
        tags: Array.isArray(d.subject) ? d.subject.slice(0, 8).map(String) : [],
        embedUrl: `https://archive.org/embed/${encodeURIComponent(d.identifier)}`,
        externalUrl: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
      })
    );
}

async function searchPeerTube(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const url =
    'https://sepiasearch.org/api/v1/search/videos?count=24&search=' + encodeURIComponent(query);
  const data = await fetchJson(url, signal);
  const items: any[] = data?.data ?? [];

  return items
    .filter((v) => v?.embedUrl && v?.url)
    .map((v) =>
      toVideoMetadata(openSource('peertube'), {
        sourceVideoId: String(v.uuid ?? v.shortUUID ?? v.id),
        title: String(v.name ?? 'Untitled'),
        description: String(v.truncatedDescription ?? v.description ?? '').slice(0, 400),
        channelId: `peertube:${v.channel?.host ?? ''}/${v.channel?.name ?? 'unknown'}`,
        channelTitle: String(v.channel?.displayName ?? v.channel?.name ?? 'PeerTube'),
        publishedAt: v.publishedAt ?? v.createdAt ?? '',
        durationSeconds: Number(v.duration) || 0,
        thumbnail: String(v.thumbnailUrl ?? v.previewUrl ?? ''),
        tags: Array.isArray(v.tags) ? v.tags.slice(0, 8).map(String) : [],
        embedUrl: String(v.embedUrl),
        externalUrl: String(v.url),
      })
    );
}

async function searchDailymotion(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const url =
    'https://api.dailymotion.com/videos?limit=24&search=' +
    encodeURIComponent(query) +
    '&fields=id,title,description,thumbnail_480_url,url,duration,created_time,owner.screenname';
  const data = await fetchJson(url, signal);
  const items: any[] = data?.list ?? [];

  return items
    .filter((v) => v?.id)
    .map((v) =>
      toVideoMetadata(openSource('dailymotion'), {
        sourceVideoId: String(v.id),
        title: String(v.title ?? 'Untitled'),
        description: String(v.description ?? '').slice(0, 400),
        channelId: `dailymotion:${v.owner?.screenname ?? 'unknown'}`,
        channelTitle: String(v.owner?.screenname ?? 'Dailymotion'),
        publishedAt: v.created_time ? new Date(Number(v.created_time) * 1000).toISOString() : '',
        durationSeconds: Number(v.duration) || 0,
        thumbnail: String(v.thumbnail_480_url ?? ''),
        tags: [],
        embedUrl: `https://www.dailymotion.com/embed/video/${v.id}`,
        externalUrl: String(v.url ?? `https://www.dailymotion.com/video/${v.id}`),
      })
    );
}

async function searchEporner(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const url =
    'https://www.eporner.com/api/v2/video/search/?query=' +
    encodeURIComponent(query) +
    '&per_page=24&page=1&thumbsize=big&order=top-weekly&gay=0&lq=1&format=json';
  const data = await fetchJson(url, signal);
  const items: any[] = data?.videos ?? [];

  return items
    .filter((v) => v?.id && v?.embed)
    .map((v) =>
      toVideoMetadata(openSource('eporner'), {
        sourceVideoId: String(v.id),
        title: String(v.title ?? 'Untitled'),
        description: '',
        channelId: 'eporner',
        channelTitle: ADULT_SOURCE_ALIASES.Eporner!,
        publishedAt: toIsoOrEmpty(v.added),
        durationSeconds: Number(v.length_sec) || 0,
        thumbnail: String(v.default_thumb?.src ?? v.thumbs?.[0]?.src ?? ''),
        previewFrames: (Array.isArray(v.thumbs) ? v.thumbs : [])
          .map((t: any) => String(t?.src ?? ''))
          .filter(Boolean)
          .slice(0, 12),
        tags: String(v.keywords ?? '')
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
          .slice(0, 8),
        embedUrl: String(v.embed),
        externalUrl: String(v.url ?? ''),
      })
    );
}

async function searchAdultEmbed(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const url =
    'https://adultembed.com/api/database/browse/?search=' +
    encodeURIComponent(query) +
    '&limit=24&page=1';
  const data = await fetchJson(url, signal);
  const items: any[] = data?.results ?? [];

  return items
    .filter((v) => v?.id)
    .map((v) =>
      toVideoMetadata(openSource('adultembed'), {
        sourceVideoId: String(v.id),
        title: String(v.title ?? 'Untitled'),
        description: String(v.description ?? '').replace(/<[^>]+>/g, '').slice(0, 400),
        channelId: `adultembed:${v.studio?.slug ?? 'unknown'}`,
        channelTitle: String(v.studio?.name ?? ADULT_SOURCE_ALIASES.AdultEmbed!),
        publishedAt: v.published_at ?? '',
        durationSeconds: Number(v.duration_seconds) || 0,
        thumbnail: String(v.thumbnail ?? ''),
        tags: [...namesOf(v.categories), ...namesOf(v.tags), ...namesOf(v.performers)].slice(0, 8),
        embedUrl: `https://adultembed.com/player/embed/${v.id}/`,
        externalUrl: `https://adultembed.com/player/embed/${v.id}/`,
      })
    );
}

async function searchRedGifs(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const { gifs } = await searchRedGifsGifs(query, 24);
  const items: any[] = gifs ?? [];

  return items
    .filter((v) => v?.id && v?.urls)
    .map((v) =>
      toVideoMetadata(openSource('redgifs'), {
        sourceVideoId: String(v.id),
        title: String(v.description ?? v.userName ?? `${ADULT_SOURCE_ALIASES.RedGifs!} clip`),
        description: String(v.description ?? ''),
        channelId: `redgifs:${v.userName ?? 'unknown'}`,
        channelTitle: String(v.userName ?? ADULT_SOURCE_ALIASES.RedGifs!),
        publishedAt: v.createDate ? new Date(Number(v.createDate) * 1000).toISOString() : '',
        durationSeconds: Number(v.duration) || 0,
        thumbnail: String(v.urls?.poster ?? v.urls?.thumbnail ?? ''),
        tags: Array.isArray(v.tags) ? v.tags.slice(0, 8).map(String) : [],
        embedUrl: String(v.urls?.html ?? `https://www.redgifs.com/ifr/${v.id}`),
        externalUrl: `https://www.redgifs.com/watch/${v.id}`,
        previewUrl: String(v.urls?.sd ?? v.urls?.hd ?? ''),
      })
    );
}

/**
 * The key-free sources the Worker caches. Every id here is safe to call from a
 * shared Worker IP and needs no user credential.
 */
const WORKER_SOURCES: Record<string, (q: string, s?: AbortSignal) => Promise<VideoMetadata[]>> = {
  archive: searchArchive,
  peertube: searchPeerTube,
  dailymotion: searchDailymotion,
  eporner: searchEporner,
  adultembed: searchAdultEmbed,
  redgifs: searchRedGifs,
};

export const isWorkerSource = (id: string): boolean => id in WORKER_SOURCES;

/** Search one key-free source from the Worker. */
export async function searchWorkerSource(
  id: string,
  query: string,
  signal?: AbortSignal
): Promise<VideoMetadata[]> {
  const fn = WORKER_SOURCES[id];
  if (!fn) throw new Error(`Source "${id}" is not cached by the search API`);
  return fn(query.trim(), signal);
}
