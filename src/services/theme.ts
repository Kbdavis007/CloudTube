/**
 * Theme selection and persistence.
 *
 * Themes work by remapping Tailwind's colour custom properties on <html>, so
 * every existing utility class re-resolves without per-component changes. Dark
 * is the default and uses Tailwind's stock palette, so it needs no overrides.
 */

export type ThemeMode = 'light' | 'medium' | 'dark';

export const THEME_STORAGE_KEY = 'cloudtube.theme';
export const DEFAULT_THEME: ThemeMode = 'dark';

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  description: string;
  /** Preview swatch colours, independent of the active theme. */
  preview: { page: string; panel: string; border: string; text: string; accent: string };
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'White surfaces, dark text, vivid orange accents.',
    preview: { page: '#FFFFFF', panel: '#F2F2F2', border: '#E4E4E7', text: '#1A1A1A', accent: '#F97316' },
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Slate-gray surfaces, soft text, desaturated orange.',
    preview: { page: '#1E1E1E', panel: '#242424', border: '#333333', text: '#E0E0E0', accent: '#D97F3A' },
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Near-black surfaces, high-contrast text, strong orange.',
    preview: { page: '#0D0D0D', panel: '#0F172A', border: '#1E293B', text: '#FFFFFF', accent: '#F97316' },
  },
];

const MODE_VALUES: ThemeMode[] = ['light', 'medium', 'dark'];

const isThemeMode = (value: unknown): value is ThemeMode =>
  typeof value === 'string' && (MODE_VALUES as string[]).includes(value);

/** Reads the saved theme, falling back to the dark default. */
export function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Applies a theme to the document. Pass `animate` when the change is
 * user-initiated so the colour transition runs; leave it off on first paint to
 * avoid animating from the default palette on load.
 */
export function applyTheme(mode: ThemeMode, options: { animate?: boolean } = {}): void {
  const root = document.documentElement;

  if (options.animate) {
    root.classList.add('ct-theme-transition');
    window.setTimeout(() => root.classList.remove('ct-theme-transition'), 500);
  }

  root.setAttribute('data-theme', mode);
  root.style.colorScheme = mode === 'light' ? 'light' : 'dark';

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute('content', mode === 'light' ? '#FFFFFF' : '#F97316');
  }
}

/** Applies and persists a theme. */
export function saveTheme(mode: ThemeMode): void {
  applyTheme(mode, { animate: true });
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* Storage can be unavailable (private mode); the theme still applies for this session. */
  }
}

/** Applies the stored theme on startup without animating. */
export function initTheme(): void {
  applyTheme(readStoredTheme());
}
