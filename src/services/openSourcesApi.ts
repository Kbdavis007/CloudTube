import type { VideoMetadata } from '../types';
import { SOURCE_ALIASES } from '../data/sourceAliases';
import { readRapidApiKey } from './rapidApiKey';
import {
  catalogToVideoMetadata,
  loadBakedCatalog,
  searchCatalog,
} from './vegaApi';
import {
  OPEN_SOURCES,
  openSourceById,
  toVideoMetadata,
  type DraftVideo,
  type OpenSourceDefinition,
  type OpenSourceId,
} from './videoShape';

/**
 * Browser-side search over the open (non-YouTube) sources.
 *
 * The canonical definitions and the `VideoMetadata` assembly live in
 * `videoShape.ts`, which the edge Worker shares, so a result fetched through the
 * cached `/api/search` route and one fetched directly here are identical. The
 * browser only calls these directly as a fallback when `/api/search` is
 * unreachable.
 */
export {
  OPEN_SOURCES,
  openSourceById,
  isOpenSourceId,
  type OpenSourceDefinition,
  type OpenSourceId,
} from './videoShape';

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
      toVideoMetadata(openSourceById('eporner'), {
        sourceVideoId: String(v.id),
        title: String(v.title ?? 'Untitled'),
        // Eporner search returns keywords rather than a description; those map
        // onto tags below, so the card's description stays empty.
        description: '',
        channelId: 'eporner',
        channelTitle: SOURCE_ALIASES.Eporner!,
        publishedAt: toIsoOrEmpty(v.added),
        durationSeconds: Number(v.length_sec) || 0,
        thumbnail: String(v.default_thumb?.src ?? v.thumbs?.[0]?.src ?? ''),
        // Eporner ships a strip of stills; cycling them on hover reads as a
        // moving thumbnail without a second network call.
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

/** Convert Eporner's `YYYY-MM-DD HH:MM:SS` timestamp to ISO, or '' if unparseable. */
function toIsoOrEmpty(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** The open database returns categories/tags/performers as `{ name }` objects. */
function namesOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .slice(0, 8);
}

/** Same as `namesOf` but reads a specific key (RapidAPI uses `tag_name` etc.). */
function namesOfKeyed(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : item?.[key]))
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .slice(0, 8);
}

/** Parse a `MM:SS` or `H:MM:SS` clock string into seconds. */
function parseClock(value: unknown): number {
  if (typeof value !== 'string' || !value.includes(':')) return 0;
  return value
    .split(':')
    .map((part) => Number(part) || 0)
    .reduce((acc, part) => acc * 60 + part, 0);
}

async function searchEmbedHub(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const url =
    'https://adultembed.com/api/database/browse/?search=' +
    encodeURIComponent(query) +
    '&limit=24&page=1';
  const data = await fetchJson(url, signal);
  const items: any[] = data?.results ?? [];

  return items
    .filter((v) => v?.id)
    .map((v) =>
      toVideoMetadata(openSourceById('embedhub'), {
        sourceVideoId: String(v.id),
        title: String(v.title ?? 'Untitled'),
        description: String(v.description ?? '').replace(/<[^>]+>/g, '').slice(0, 400),
        channelId: `embedhub:${v.studio?.slug ?? 'unknown'}`,
        channelTitle: String(v.studio?.name ?? SOURCE_ALIASES.EmbedHub!),
        publishedAt: v.published_at ?? '',
        durationSeconds: Number(v.duration_seconds) || 0,
        thumbnail: String(v.thumbnail ?? ''),
        // Categories carry the useful labels; tags/performers are often empty.
        tags: [...namesOf(v.categories), ...namesOf(v.tags), ...namesOf(v.performers)].slice(0, 8),
        // The database API exposes no public watch page, so the player embed is
        // both the play target and the only exit link.
        embedUrl: `https://adultembed.com/player/embed/${v.id}/`,
        externalUrl: `https://adultembed.com/player/embed/${v.id}/`,
      })
    );
}

/**
 * RedGifs search. The API locks `access-control-allow-origin` to redgifs.com, so
 * the browser cannot call it directly: this goes through the same-origin
 * `/api/redgifs/search` proxy, which also handles the temporary token.
 */
async function searchRedGifs(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const url = `/api/redgifs/search?q=${encodeURIComponent(query)}&count=24`;
  const data = await fetchJson(url, signal);
  const items: any[] = data?.gifs ?? [];

  return items
    .filter((v) => v?.id && v?.urls)
    .map((v) =>
      toVideoMetadata(openSourceById('redgifs'), {
        sourceVideoId: String(v.id),
        title: String(v.description ?? v.userName ?? `${SOURCE_ALIASES.RedGifs!} clip`),
        description: String(v.description ?? ''),
        channelId: `redgifs:${v.userName ?? 'unknown'}`,
        channelTitle: String(v.userName ?? SOURCE_ALIASES.RedGifs!),
        publishedAt: v.createDate ? new Date(Number(v.createDate) * 1000).toISOString() : '',
        durationSeconds: Number(v.duration) || 0,
        thumbnail: String(v.urls?.poster ?? v.urls?.thumbnail ?? ''),
        tags: Array.isArray(v.tags) ? v.tags.slice(0, 8).map(String) : [],
        // `urls.html` is the dedicated framable embed page; the watch page is not.
        embedUrl: String(v.urls?.html ?? `https://www.redgifs.com/ifr/${v.id}`),
        externalUrl: `https://www.redgifs.com/watch/${v.id}`,
        // RedGifs serves the clip itself as a plain mp4, ideal for a muted hover preview.
        previewUrl: String(v.urls?.sd ?? v.urls?.hd ?? ''),
      })
    );
}

/**
 * The user's RapidAPI key, or a clear error naming the source. RapidAPI's
 * gateway sends CORS headers that let the browser call it directly, so the key
 * is sent from the browser; it is the user's own and entered in Settings.
 */
function requireRapidApiKey(sourceName: string): string {
  const key = readRapidApiKey();
  if (!key) {
    throw new Error(`Add your RapidAPI key in Settings → Search Sources to search ${sourceName}`);
  }
  return key;
}

/** Multi-site RapidAPI host backing the xHamster and RedTube sources. */
const MULTISITE_HOST = 'xhamster-pornhub-youporn-xnxx-redtube-api.p.rapidapi.com';

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

/**
 * Search xHamster or RedTube through the multi-site RapidAPI endpoint. Each
 * site is its own CloudTube source so it can be toggled independently, but they
 * share this gateway and the same JSON shape (`{ resultats: [...] }`).
 */
async function searchMultiSite(
  site: 'xhamster' | 'redtube',
  query: string,
  signal?: AbortSignal
): Promise<VideoMetadata[]> {
  const source = openSourceById(site);
  const key = requireRapidApiKey(source.name);
  const res = await fetch(
    `https://${MULTISITE_HOST}/api/search?q=${encodeURIComponent(query)}&site=${site}`,
    {
      signal,
      headers: {
        Accept: 'application/json',
        'x-rapidapi-key': key,
        'x-rapidapi-host': MULTISITE_HOST,
      },
    }
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error('RapidAPI rejected the key (check it is subscribed to this API)');
  }
  if (res.status === 429) {
    throw new Error('RapidAPI free-plan limit reached — try again later');
  }
  if (!res.ok) throw new Error(`${source.name} search responded ${res.status}`);

  const data = await res.json();
  const items: any[] = data?.resultats ?? [];

  return items
    .filter((v) => v?.lien && v?.titre)
    .map((v) => {
      const externalUrl = String(v.lien);
      const id = embedIdFromLink(externalUrl);
      return toVideoMetadata(source, {
        sourceVideoId: id,
        title: String(v.titre),
        description: String(v.titre),
        channelId: `${site}:${v.uploader ?? 'unknown'}`,
        channelTitle: String(v.uploader ?? source.name),
        // These feeds carry no publish date.
        publishedAt: '',
        durationSeconds: dureeToSeconds(v.duree),
        thumbnail: String(v.vignette ?? ''),
        tags: [],
        embedUrl: embedUrlFor(site, id),
        externalUrl,
      });
    })
    .filter((v) => v.playback?.embedUrl);
}

/**
 * Pornhub search through the RapidAPI gateway.
 *
 * RapidAPI sends CORS headers that allow the browser to call it directly with
 * `x-rapidapi-key` (verified with an OPTIONS preflight), so no proxy is needed.
 * The key is the user's own, entered in Settings; without it the search fails
 * with a clear message rather than silently returning nothing.
 */
async function searchPornhub(query: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
  const key = requireRapidApiKey(SOURCE_ALIASES.Pornhub!);

  const res = await fetch(
    `https://pornhub2.p.rapidapi.com/v2/search?query=${encodeURIComponent(query)}`,
    {
      signal,
      headers: {
        Accept: 'application/json',
        'x-rapidapi-key': key,
        'x-rapidapi-host': 'pornhub2.p.rapidapi.com',
      },
    }
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `RapidAPI rejected the key (check it is subscribed to the ${SOURCE_ALIASES.Pornhub!} API)`
    );
  }
  if (res.status === 429) {
    throw new Error('RapidAPI free-plan limit reached — try again later');
  }
  if (!res.ok) throw new Error(`${SOURCE_ALIASES.Pornhub!} search responded ${res.status}`);

  const data = await res.json();
  const items: any[] = data?.data?.videos ?? [];

  return items
    .filter((v) => v?.video_id)
    .map((v) =>
      toVideoMetadata(openSourceById('pornhub'), {
        sourceVideoId: String(v.video_id),
        title: String(v.title ?? 'Untitled'),
        description: String(v.title ?? ''),
        channelId: `pornhub:${v.pornstars?.[0]?.pornstar_name ?? 'unknown'}`,
        channelTitle: String(v.pornstars?.[0]?.pornstar_name ?? SOURCE_ALIASES.Pornhub!),
        publishedAt: toIsoOrEmpty(v.publish_date),
        durationSeconds: parseClock(v.duration),
        thumbnail: String(v.default_thumb ?? v.thumb ?? ''),
        tags: [
          ...namesOfKeyed(v.categories, 'category'),
          ...namesOfKeyed(v.tags, 'tag_name'),
          ...namesOfKeyed(v.pornstars, 'pornstar_name'),
        ].slice(0, 8),
        // The embed page is framable (no X-Frame-Options / frame-ancestors).
        embedUrl: `https://www.pornhub.com/embed/${v.video_id}`,
        externalUrl: String(v.url ?? `https://www.pornhub.com/view_video.php?viewkey=${v.video_id}`),
      })
    );
}

/**
 * Search the catalogue that ships with the build.
 *
 * The records are a static JSON module, so this needs no network and cannot
 * fail on a rate limit: the whole catalogue is searched in memory. An empty
 * query returns the newest records, so selecting the source and pressing search
 * behaves like every other source.
 */
async function searchVega(query: string): Promise<VideoMetadata[]> {
  const catalog = loadBakedCatalog();
  const ranked = searchCatalog(catalog, query, 60);
  return ranked.map((r) => catalogToVideoMetadata(r.record));
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
    case 'vega':
      return searchVega(trimmed);
    case 'archive':
      return searchArchive(trimmed, signal);
    case 'peertube':
      return searchPeerTube(trimmed, signal);
    case 'dailymotion':
      return searchDailymotion(trimmed, signal);
    case 'eporner':
      return searchEporner(trimmed, signal);
    case 'embedhub':
      return searchEmbedHub(trimmed, signal);
    case 'redgifs':
      return searchRedGifs(trimmed, signal);
    case 'pornhub':
      return searchPornhub(trimmed, signal);
    case 'xhamster':
      return searchMultiSite('xhamster', trimmed, signal);
    case 'redtube':
      return searchMultiSite('redtube', trimmed, signal);
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
