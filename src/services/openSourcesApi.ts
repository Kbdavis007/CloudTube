import type { SourceFlag, VideoMetadata } from '../types';

/**
 * Key-free, CORS-enabled sources CloudTube can search without a sign-in.
 *
 * Each source returns a normalised `VideoMetadata` that carries its own
 * `playback.embedUrl`, so the existing sandboxed player can show it without any
 * player changes: playback stays inside the app and the only way out is the
 * explicit "Go to Source Site" link built from `playback.externalUrl`.
 */
export type OpenSourceId = 'archive' | 'peertube' | 'dailymotion';

export interface OpenSourceDefinition {
  id: OpenSourceId;
  name: string;
  /** One-line description shown next to the source toggle. */
  tagline: string;
  flag: SourceFlag;
  accent: string;
}

export const OPEN_SOURCES: OpenSourceDefinition[] = [
  {
    id: 'archive',
    name: 'Archive.org',
    tagline: 'Internet Archive films, talks and recordings',
    flag: 'ArchiveOrg',
    accent: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  },
  {
    id: 'peertube',
    name: 'PeerTube',
    tagline: 'Federated video across independent instances',
    flag: 'PeerTube',
    accent: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
  },
  {
    id: 'dailymotion',
    name: 'Dailymotion',
    tagline: 'Dailymotion public catalogue',
    flag: 'Dailymotion',
    accent: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
];

const OPEN_SOURCE_BY_ID = new Map<OpenSourceId, OpenSourceDefinition>(
  OPEN_SOURCES.map((s) => [s.id, s])
);

export const openSourceById = (id: OpenSourceId): OpenSourceDefinition =>
  OPEN_SOURCE_BY_ID.get(id) as OpenSourceDefinition;

const toIsoDuration = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  let out = 'PT';
  if (h) out += `${h}H`;
  if (m || h) out += `${m}M`;
  out += `${sec}S`;
  return out;
};

interface DraftVideo {
  sourceVideoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  durationSeconds: number;
  thumbnail: string;
  tags: string[];
  embedUrl: string;
  externalUrl: string;
}

/** Assemble the VideoMetadata shape the rest of the app already understands. */
function toVideoMetadata(source: OpenSourceDefinition, draft: DraftVideo): VideoMetadata {
  const now = new Date().toISOString();
  const youtubeId = `${source.id}:${draft.sourceVideoId}`;
  return {
    id: crypto.randomUUID(),
    youtubeId,
    title: draft.title,
    description: draft.description,
    tags: draft.tags,
    channelId: draft.channelId,
    channelTitle: draft.channelTitle,
    publishedAt: draft.publishedAt || now,
    duration: toIsoDuration(draft.durationSeconds),
    durationSeconds: draft.durationSeconds,
    // These sources expose no engagement counts here, so they stay at zero
    // rather than being invented.
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    thumbnails: {
      default: draft.thumbnail,
      medium: draft.thumbnail,
      high: draft.thumbnail,
    },
    posterUrl: draft.thumbnail,
    sourceVideoId: draft.sourceVideoId,
    playback: { embedUrl: draft.embedUrl, externalUrl: draft.externalUrl },
    sourceFlags: [source.flag],
    indexedAt: now,
    lastUpdatedAt: now,
    personal: {
      videoId: youtubeId,
      indexScore: 50,
      userRating: 70,
      userNotes: '',
      userTags: [`${source.name}-Imported`],
    },
  };
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
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
      toVideoMetadata(openSourceById('archive'), {
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

async function searchPeerTube(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const url =
    'https://sepiasearch.org/api/v1/search/videos?count=24&search=' + encodeURIComponent(query);
  const data = await fetchJson(url, signal);
  const items: any[] = data?.data ?? [];

  return items
    .filter((v) => v?.embedUrl && v?.url)
    .map((v) =>
      toVideoMetadata(openSourceById('peertube'), {
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
      toVideoMetadata(openSourceById('dailymotion'), {
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

/**
 * Search one open source. Failures are surfaced to the caller so a single
 * unreachable source never blocks the others.
 */
export async function searchOpenSource(
  id: OpenSourceId,
  query: string,
  signal?: AbortSignal
): Promise<VideoMetadata[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  switch (id) {
    case 'archive':
      return searchArchive(trimmed, signal);
    case 'peertube':
      return searchPeerTube(trimmed, signal);
    case 'dailymotion':
      return searchDailymotion(trimmed, signal);
    default:
      return [];
  }
}

export interface OpenSourceSearchResult {
  id: OpenSourceId;
  videos: VideoMetadata[];
  error?: string;
}

/** Search every open source in parallel; one failure never fails the batch. */
export async function searchAllOpenSources(
  ids: OpenSourceId[],
  query: string,
  signal?: AbortSignal
): Promise<OpenSourceSearchResult[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        return { id, videos: await searchOpenSource(id, query, signal) };
      } catch (err: any) {
        return { id, videos: [], error: err?.message || 'Search failed' };
      }
    })
  );
}
