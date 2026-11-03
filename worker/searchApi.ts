/**
 * Cached search API.
 *
 * A single search fans out to every enabled open source, saves each source's
 * result set in D1, and returns it. Repeat searches of the same term inside the
 * per-source freshness window are served from D1 (or the Cloudflare edge cache)
 * without touching the upstream source again, which is what keeps the app under
 * each API's rate limit.
 *
 * Two cache layers, cheapest first:
 *   1. `caches.default` — per-colo, holds the whole multi-source response for a
 *      short window. This is what makes a repeat search feel instant.
 *   2. D1 `video_search_cache` — durable, holds one row per (source, query) so a
 *      search from a different colo, or after the edge entry expires, still
 *      avoids the upstream call until the row goes stale.
 *
 * Only key-free sources run here (see `searchSources.ts`); the user's key-gated
 * sources are searched browser-direct so the key is never uploaded.
 */

import type { VideoMetadata } from '../src/types';
import { isWorkerSource, searchWorkerSource } from './searchSources';
import { isOpenSourceId } from '../src/services/videoShape';

export interface D1Result<T = unknown> {
  results?: T[];
  success?: boolean;
  meta?: { changes?: number };
}

/** Minimal D1 surface used here, so the module needs no workers-types dep. */
export interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<D1Result<T>>;
      run(): Promise<D1Result>;
    };
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<D1Result<T>>;
    run(): Promise<D1Result>;
  };
  exec(query: string): Promise<D1Result>;
}

export interface SearchEnv {
  DB?: D1Database;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });

/**
 * How long a cached result set stays fresh, per source. Sources whose feeds
 * change slowly (or rate-limit hard) get a longer window; that window is what
 * caps upstream calls.
 */
const SOURCE_TTL_MS: Record<string, number> = {
  archive: 24 * 60 * 60 * 1000,
  peertube: 12 * 60 * 60 * 1000,
  dailymotion: 6 * 60 * 60 * 1000,
  eporner: 12 * 60 * 60 * 1000,
  embedhub: 12 * 60 * 60 * 1000,
  redgifs: 30 * 60 * 1000,
};

/** Edge-cache TTL for the whole response: short, so new upstream videos appear. */
const EDGE_TTL_SECONDS = 300;
/** Shorter TTL when at least one source failed, so the miss is retried soon. */
const PARTIAL_TTL_SECONDS = 30;

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
export const ttlForSource = (id: string): number => SOURCE_TTL_MS[id] ?? DEFAULT_TTL_MS;

/** D1 stores a source's results as a compact JSON array. */
interface CachedPayload {
  videos: VideoMetadata[];
}

export interface SourceResult {
  videos: VideoMetadata[];
  cached: boolean;
  ageMs: number;
  error?: string;
}

const normaliseQuery = (query: string): string => query.trim().toLowerCase();

/** A stable cache key for one source + query, independent of colo. */
const cacheKeyFor = (id: string, query: string): string => `${id}\u0000${normaliseQuery(query)}`;

export const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS video_search_cache (
  source      TEXT NOT NULL,
  query       TEXT NOT NULL,
  payload     TEXT NOT NULL,
  videos      INTEGER NOT NULL DEFAULT 0,
  fetched_at  INTEGER NOT NULL,
  PRIMARY KEY (source, query)
)`;

/**
 * Create the cache table if it is missing. Run lazily on first search so a
 * fresh D1 database works without a separate migration step, and also provided
 * as a migration for a clean deploy.
 *
 * Uses `prepare().run()` rather than `exec()`: D1's `exec` splits on newlines
 * and rejects this multi-line statement.
 */
async function ensureSchema(db: D1Database): Promise<void> {
  await db.prepare(CREATE_TABLE_SQL).run();
}

/** Read a fresh cache row, or null when missing/stale/unreadable. */
async function readCacheRow(
  db: D1Database,
  id: string,
  query: string,
  now: number
): Promise<SourceResult | null> {
  try {
    const row = await db
      .prepare('SELECT payload, fetched_at FROM video_search_cache WHERE source = ? AND query = ?')
      .bind(id, normaliseQuery(query))
      .first<{ payload: string; fetched_at: number }>();
    if (!row) return null;
    if (now - row.fetched_at > ttlForSource(id)) return null;
    const parsed = JSON.parse(row.payload) as CachedPayload;
    if (!Array.isArray(parsed.videos)) return null;
    return { videos: parsed.videos, cached: true, ageMs: now - row.fetched_at };
  } catch {
    // A read error must never fail the search; fall through to the network.
    return null;
  }
}

/** Persist a source's results. Failures are non-fatal (the search still returns). */
async function writeCacheRow(
  db: D1Database,
  id: string,
  query: string,
  videos: VideoMetadata[],
  now: number
): Promise<void> {
  try {
    const payload = JSON.stringify({ videos } satisfies CachedPayload);
    await db
      .prepare(
        `INSERT INTO video_search_cache (source, query, payload, videos, fetched_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(source, query) DO UPDATE SET
           payload = excluded.payload,
           videos = excluded.videos,
           fetched_at = excluded.fetched_at`
      )
      .bind(id, normaliseQuery(query), payload, videos.length, now)
      .run();
  } catch {
    /* cache write is best-effort */
  }
}

export interface SearchApiDeps {
  db?: D1Database;
  /** Lets the Worker extend the response lifetime past the handler return. */
  waitUntil?: (promise: Promise<unknown>) => void;
  fetchImpl?: typeof fetch;
}

/**
 * Search one source, preferring D1 over the network.
 *
 * `staleWhileRevalidate` mode is used for background refresh: it returns the
 * stale row immediately and refreshes in the background, so a slow upstream
 * never delays the response.
 */
async function searchOne(
  id: string,
  query: string,
  deps: SearchApiDeps,
  options: { allowStale: boolean }
): Promise<SourceResult> {
  const now = Date.now();
  const db = deps.db;

  if (db) {
    const fresh = await readCacheRow(db, id, query, now);
    if (fresh) return fresh;

    if (options.allowStale) {
      // Background refresh path: serve the stale row and revalidate behind it.
      try {
        const row = await db
          .prepare('SELECT payload, fetched_at FROM video_search_cache WHERE source = ? AND query = ?')
          .bind(id, normaliseQuery(query))
          .first<{ payload: string; fetched_at: number }>();
        if (row) {
          const parsed = JSON.parse(row.payload) as CachedPayload;
          if (Array.isArray(parsed.videos)) {
            const refresh = searchWorkerSource(id, query)
              .then((videos) => writeCacheRow(db, id, query, videos, Date.now()))
              .catch(() => undefined);
            (deps.waitUntil ?? ((p: Promise<unknown>) => void p))(refresh);
            return { videos: parsed.videos, cached: true, ageMs: now - row.fetched_at };
          }
        }
      } catch {
        /* fall through to a live fetch */
      }
    }
  }

  try {
    const videos = await searchWorkerSource(id, query);
    if (db) {
      const write = writeCacheRow(db, id, query, videos, Date.now());
      (deps.waitUntil ?? ((p: Promise<unknown>) => void p))(write);
    }
    return { videos, cached: false, ageMs: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return { videos: [], cached: false, ageMs: 0, error: message };
  }
}

/**
 * Handle `GET /api/search`.
 *
 * Query params:
 *   q     — the search term (required)
 *   ids   — comma-separated source ids to search (defaults to all cacheable ones)
 *   fresh — `1` to skip the edge cache and force a D1/network read
 */
export async function handleSearch(request: Request, deps: SearchApiDeps): Promise<Response> {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  const idsParam = url.searchParams.get('ids') ?? '';
  const forceFresh = url.searchParams.get('fresh') === '1';

  if (!query) {
    return jsonResponse({ success: false, errors: [{ message: 'Missing "q" parameter' }] }, 400);
  }

  const requested = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const ids = (requested.length ? requested : ['archive', 'peertube', 'dailymotion', 'embedhub', 'redgifs']).filter(
    (id) => isOpenSourceId(id) && isWorkerSource(id)
  );

  if (!ids.length) {
    return jsonResponse(
      { success: false, errors: [{ message: 'No cacheable sources in "ids"' }] },
      400
    );
  }

  // Layer 1: the edge cache, keyed on the normalised request. It holds the whole
  // multi-source payload, so a repeat search costs no D1 read and no upstream call.
  const cache = (caches as unknown as { default?: Cache }).default;
  const edgeKey = new Request(
    `https://cloudtube.cache.internal/search?q=${encodeURIComponent(normaliseQuery(query))}&ids=${ids.join(',')}`,
    { method: 'GET' }
  );
  if (cache && !forceFresh) {
    const hit = await cache.match(edgeKey);
    if (hit) return hit;
  }

  const db = deps.db;
  if (db) await ensureSchema(db);

  const entries = await Promise.all(
    ids.map(async (id) => [id, await searchOne(id, query, deps, { allowStale: false })] as const)
  );
  const results: Record<string, SourceResult> = Object.fromEntries(entries);

  const body = {
    success: true,
    query,
    results,
    meta: {
      sources: ids,
      cachedCount: entries.filter(([, r]) => r.cached).length,
      servedAt: new Date().toISOString(),
      ttlSeconds: EDGE_TTL_SECONDS,
    },
  };
  const response = jsonResponse(body);

  if (cache && !forceFresh) {
    // Cache a fully-successful fan-out for the full window. A partial failure is
    // still cached, but only briefly, so one flaky source cannot disable caching
    // for the term while also not freezing a transient error in for long.
    const allOk = entries.every(([, r]) => !r.error);
    const ttl = allOk ? EDGE_TTL_SECONDS : PARTIAL_TTL_SECONDS;
    const toStore = new Response(JSON.stringify(body), {
      headers: {
        ...JSON_HEADERS,
        'Cache-Control': `public, max-age=${ttl}`,
      },
    });
    const put = cache.put(edgeKey, toStore);
    (deps.waitUntil ?? ((p: Promise<unknown>) => void p))(put);
  }

  return response;
}
