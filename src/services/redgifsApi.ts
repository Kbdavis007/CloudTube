/**
 * RedGifs search helper.
 *
 * RedGifs sends `access-control-allow-origin: https://www.redgifs.com` on its
 * search endpoint, so the browser cannot call it directly. Both runtimes that
 * serve the app (the edge Worker and the Node dev server) expose a same-origin
 * `/api/redgifs/search` route that calls this helper, which also handles the
 * short-lived temporary auth token.
 *
 * The token is cached in module scope and refreshed when it is close to expiry,
 * so a burst of searches does not request a new token per call.
 */

const API_ROOT = 'https://api.redgifs.com/v2';
const USER_AGENT = 'CloudTube-Studio/1.0';

/** Safety margin: refresh the token this many ms before it actually expires. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getTemporaryToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return cachedToken.value;
  }

  const res = await fetch(`${API_ROOT}/auth/temporary`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`RedGifs auth responded ${res.status}`);

  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error('RedGifs auth returned no token');

  // The temporary token is documented as ~24h; fall back conservatively.
  cachedToken = { value: data.token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
  return data.token;
}

export interface RedGifsSearchResult {
  gifs: any[];
  total: number;
}

/** Search RedGifs GIFs. `count` is clamped to the API's 1..80 range. */
export async function searchRedGifsGifs(
  query: string,
  count = 24
): Promise<RedGifsSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { gifs: [], total: 0 };

  const token = await getTemporaryToken();
  const safeCount = Math.min(80, Math.max(1, Math.floor(count) || 24));
  const url =
    `${API_ROOT}/gifs/search?search_text=${encodeURIComponent(trimmed)}` +
    `&order=top&type=g&count=${safeCount}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  // A stale token yields 401; drop it so the next call re-authenticates.
  if (res.status === 401) {
    cachedToken = null;
    throw new Error('RedGifs rejected the temporary token');
  }
  if (!res.ok) throw new Error(`RedGifs search responded ${res.status}`);

  const data = (await res.json()) as { gifs?: any[]; total?: number };
  return { gifs: data.gifs ?? [], total: data.total ?? 0 };
}
