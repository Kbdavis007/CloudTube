/**
 * The user's RapidAPI key for the Pornhub search source.
 *
 * RapidAPI's gateway sends CORS headers that explicitly allow the browser to
 * send `x-rapidapi-key` (verified with an OPTIONS preflight), so the key is used
 * directly from the browser rather than through a Worker secret. That matches
 * how the Cloudflare credentials already work in this app.
 *
 * This key is lower-value than the Cloudflare one — it only spends the user's
 * own free RapidAPI quota — so it is kept in plain localStorage rather than the
 * encrypted vault, which is scoped to the Cloudflare token.
 */

const STORAGE_KEY = 'cloudtube.rapidapi_key';
const CHANGE_EVENT = 'cloudtube:rapidapi-key-changed';

/** The stored key, or '' when unset. */
export function readRapidApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Persists (or clears, with '') the key and notifies any mounted listeners. */
export function saveRapidApiKey(key: string): void {
  const trimmed = key.trim();
  try {
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Private mode: the in-memory change still notifies listeners. */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: trimmed }));
}

/** Runs `listener` whenever the key changes. Returns an unsubscribe. */
export function subscribeRapidApiKey(listener: (key: string) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    listener(typeof detail === 'string' ? detail : readRapidApiKey());
  };
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
