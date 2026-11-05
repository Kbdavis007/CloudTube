import type { PageTab } from '../components/Sidebar';

/**
 * Which view the app is on, kept in localStorage so a reload returns to it
 * instead of resetting to the dashboard. Only the navigation state is stored —
 * library data still lives in IndexedDB.
 */
export interface ViewState {
  tab: PageTab;
  /** Video open on the Videos page, if any. */
  selectedVideoId: string;
}

const STORAGE_KEY = 'cloudtube.view_state';

/** Every tab the sidebar can show; anything else is not worth restoring. */
const PERSISTED_TABS: PageTab[] = [
  'dashboard',
  'search',
  'vega',
  'player',
  'channels',
  'comments',
  'ratings',
  'removals',
  'wizard',
  'scaffolding',
  'settings',
];

const DEFAULT_VIEW: ViewState = { tab: 'dashboard', selectedVideoId: '' };

const isPersistedTab = (value: unknown): value is PageTab =>
  typeof value === 'string' && (PERSISTED_TABS as string[]).includes(value);

/**
 * The view to restore on load. Falls back to the dashboard when nothing is
 * stored or the stored value is unreadable, so a corrupt entry can never leave
 * the app on a blank view.
 */
export function loadViewState(): ViewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VIEW };
    const parsed = JSON.parse(raw) as Partial<ViewState>;
    if (!isPersistedTab(parsed.tab)) return { ...DEFAULT_VIEW };
    return {
      tab: parsed.tab,
      selectedVideoId:
        typeof parsed.selectedVideoId === 'string' ? parsed.selectedVideoId : '',
    };
  } catch {
    return { ...DEFAULT_VIEW };
  }
}

/** Persist the current view. Storage failures are non-fatal. */
export function saveViewState(state: ViewState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tab: state.tab,
        selectedVideoId: state.selectedVideoId ?? '',
      })
    );
  } catch {
    // Quota or private-mode failures must not break navigation.
  }
}
