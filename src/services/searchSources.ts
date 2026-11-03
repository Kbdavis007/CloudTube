/**
 * Which open (key-free) sources a search should run against.
 *
 * The choice is a user preference, so it lives in localStorage rather than in a
 * component, and it survives a reload. SearchView reads it on mount and
 * re-reads it whenever Settings saves a change (see `subscribeSearchSources`),
 * so the two pages never drift.
 */

import { OPEN_SOURCES, type OpenSourceId } from './openSourcesApi';

const STORAGE_KEY = 'cloudtube.search_sources';
const CHANGE_EVENT = 'cloudtube:search-sources-changed';

const ALL_OPEN_SOURCE_IDS = OPEN_SOURCES.map((s) => s.id);

const isOpenSourceId = (value: unknown): value is OpenSourceId =>
  typeof value === 'string' && (ALL_OPEN_SOURCE_IDS as string[]).includes(value);

/** Every open source, including the ones that need a key (used by "Enable All"). */
export const allOpenSourceIds = (): OpenSourceId[] => [...ALL_OPEN_SOURCE_IDS];

/**
 * The sources a first search should run. Key-required sources are left out so a
 * fresh install never shows a "add your key" error until the user opts in.
 */
export const defaultOpenSourceIds = (): OpenSourceId[] =>
  OPEN_SOURCES.filter((s) => !s.requiresKey).map((s) => s.id);

/**
 * The enabled open sources. Falls back to the key-free default when nothing is
 * stored or the stored value is unreadable, so a corrupt entry can never leave
 * search with no sources at all.
 */
export function readEnabledOpenSources(): OpenSourceId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultOpenSourceIds();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultOpenSourceIds();
    return parsed.filter(isOpenSourceId);
  } catch {
    return defaultOpenSourceIds();
  }
}

/** Persists the enabled set and notifies any mounted listeners. */
export function saveEnabledOpenSources(ids: OpenSourceId[]): void {
  const unique = ALL_OPEN_SOURCE_IDS.filter((id) => ids.includes(id));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  } catch {
    /* Private mode: the in-memory change still notifies listeners. */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: unique }));
}

/** Runs `listener` whenever the enabled set changes. Returns an unsubscribe. */
export function subscribeSearchSources(listener: (ids: OpenSourceId[]) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    listener(Array.isArray(detail) ? detail.filter(isOpenSourceId) : readEnabledOpenSources());
  };
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
