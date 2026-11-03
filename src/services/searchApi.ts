/**
 * Cached open-source search.
 *
 * Every open-source search goes through the same-origin `/api/search` route, so
 * the Worker fans out once and caches the result in D1 and the Cloudflare edge
 * cache. That is what keeps the app under each API's rate limit: a term is
 * fetched from the upstream source once per freshness window, then served from
 * cache to everyone.
 *
 * If `/api/search` is unreachable (offline, or a dev server without the route),
 * the browser falls back to calling each source directly, so search never breaks.
 */

import type { VideoMetadata } from '../types';
import {
  searchOpenSource,
  type OpenSourceId,
  type OpenSourceSearchResult,
} from './openSourcesApi';

interface ApiSourceResult {
  videos: VideoMetadata[];
  cached?: boolean;
  ageMs?: number;
  error?: string;
}

interface ApiSearchBody {
  success: boolean;
  query?: string;
  results?: Record<string, ApiSourceResult>;
  errors?: { message?: string }[];
}

/**
 * Search the given open sources, preferring the cached API.
 *
 * Returns the same shape as `searchAllOpenSources`, so callers do not care which
 * path was taken. A per-source error is reported only when both paths fail.
 */
export async function searchOpenSourcesCached(
  ids: OpenSourceId[],
  query: string,
  signal?: AbortSignal
): Promise<OpenSourceSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed || ids.length === 0) return [];

  const viaApi = await searchViaApi(ids, trimmed, signal);
  if (viaApi) return viaApi;

  // Fallback: call each source directly from the browser.
  return Promise.all(
    ids.map(async (id) => {
      try {
        return { id, videos: await searchOpenSource(id, trimmed, signal) };
      } catch (err: any) {
        return { id, videos: [], error: err?.message || 'Search failed' };
      }
    })
  );
}

/** One attempt at `/api/search`; returns null when the route is unavailable. */
async function searchViaApi(
  ids: OpenSourceId[],
  query: string,
  signal?: AbortSignal
): Promise<OpenSourceSearchResult[] | null> {
  let response: Response;
  try {
    const url = `/api/search?q=${encodeURIComponent(query)}&ids=${ids.join(',')}`;
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch {
    return null;
  }

  // A dev server with no `/api/search` route answers the SPA HTML, or 404s.
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;

  let body: ApiSearchBody;
  try {
    body = (await response.json()) as ApiSearchBody;
  } catch {
    return null;
  }
  if (!body?.success || !body.results) return null;

  // Sources the API does not cache (key-gated ones) are absent from `results`;
  // fill them in from the browser so a mixed selection still works.
  const fromApi = new Map<OpenSourceId, OpenSourceSearchResult>();
  for (const id of ids) {
    const entry = body.results[id];
    if (entry) {
      fromApi.set(id, { id, videos: entry.videos ?? [], error: entry.error });
    }
  }

  const missing = ids.filter((id) => !fromApi.has(id));
  const filled = await Promise.all(
    missing.map(async (id) => {
      try {
        return { id, videos: await searchOpenSource(id, query, signal) } as OpenSourceSearchResult;
      } catch (err: any) {
        return { id, videos: [], error: err?.message || 'Search failed' } as OpenSourceSearchResult;
      }
    })
  );

  return [...ids.map((id) => fromApi.get(id)).filter((r): r is OpenSourceSearchResult => !!r), ...filled];
}
