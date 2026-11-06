/**
 * Friendly URLs for the standalone legal pages.
 *
 * The privacy policy and terms are plain HTML files in `public/`, deliberately
 * outside the React app so they render without signing in. In production the
 * Cloudflare asset layer maps `/privacy` to `/privacy.html` itself
 * (`assets.html_handling` in wrangler.jsonc); this module is what gives the Node
 * dev server the same behaviour, so a URL verified in development behaves
 * identically once deployed.
 *
 * The map is explicit rather than derived from the filesystem: an allowlist
 * cannot start serving a file that happens to be dropped into `public/`.
 */

const LEGAL_PAGE_ROUTES: Record<string, string> = {
  '/privacy': 'privacy.html',
  '/tos': 'tos.html',
};

/**
 * The HTML file to serve for `pathname`, or null when the path is not a legal
 * page. A trailing slash is accepted (`/privacy/`) so a hand-typed URL still
 * lands on the page.
 */
export function resolveLegalPage(pathname: string): string | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return LEGAL_PAGE_ROUTES[normalized] ?? null;
}
