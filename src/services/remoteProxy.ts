/**
 * Remote site proxy.
 *
 * The "Remote" page embeds a whole external site (xvideos.com) in a full-page
 * iframe. The site cannot be framed directly: it sends `X-Frame-Options:
 * SAMEORIGIN`, so the browser refuses to render it inside CloudTube. This module
 * powers a same-origin proxy that fetches the page and re-serves it with the
 * blocking headers removed.
 *
 * Two things make that work:
 *
 *   1. Strip `X-Frame-Options` / `frame-ancestors` (done by omission — we build
 *      a fresh response) so the iframe is allowed.
 *   2. Rewrite root-relative URLs. The upstream HTML is full of `href="/new/2"`
 *      and `src="/manifest.json"` references, which would otherwise resolve
 *      against *our* origin and 404. They are pointed back at the proxy under a
 *      single prefix so sub-resources and in-page navigation stay on the proxy.
 *
 * It is deliberately a dumb pass-through: no scripts are injected, so the site
 * keeps full control of its own navigation (pagination, video pages, players).
 *
 * The proxy lives on the app's own origin and is only ever used by the signed-in
 * owner of this single-user app. It is not an open relay: it only reaches the
 * one host below, over http(s), and only for GET/HEAD.
 */

/** Host the Remote page is allowed to reach. */
export const REMOTE_HOST = 'www.xvideos.com';

/** Proxy path prefix. `/_remote` -> upstream `https://www.xvideos.com/`. */
export const REMOTE_PREFIX = '/_remote';

/** The upstream URL a proxy request path maps to. */
export function remoteUpstreamUrl(pathAndSearch: string): string {
  const rest = pathAndSearch.startsWith(REMOTE_PREFIX)
    ? pathAndSearch.slice(REMOTE_PREFIX.length)
    : pathAndSearch;
  return `https://${REMOTE_HOST}${rest.startsWith('/') ? rest : `/${rest}`}`;
}

/** Build the proxy URL a browser should request for a given upstream path. */
export function remoteProxyPath(pathAndSearch: string): string {
  const clean = pathAndSearch.startsWith('/') ? pathAndSearch : `/${pathAndSearch}`;
  return `${REMOTE_PREFIX}${clean}`;
}

/** Absolute proxy URL, so root-relative upstream URLs round-trip through us. */
export function remoteProxyUrl(absoluteUrl: string): string {
  try {
    const url = new URL(absoluteUrl);
    return remoteProxyPath(`${url.pathname}${url.search}`);
  } catch {
    return remoteProxyPath(absoluteUrl);
  }
}

/** Response headers that must not be copied through (they block framing). */
const STRIPPED_RESPONSE_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'content-encoding',
  'content-length',
  'content-disposition',
  'transfer-encoding',
  'connection',
  'set-cookie',
  'report-to',
  'reporting-endpoints',
];

/** Does this response need its body rewritten as HTML? */
const isHtml = (contentType: string | null): boolean =>
  !!contentType && contentType.includes('text/html');

/**
 * Rewrite root-relative URL references in an HTML document so they resolve to
 * the proxy instead of the CloudTube origin. Only leading-slash references are
 * touched (`="/x"` and `='/x'`); absolute URLs and `data:`/`#` values are left
 * alone, and protocol-relative `//host` URLs keep their own host.
 */
export function rewriteHtmlForProxy(html: string): string {
  return html.replace(/\b(href|src|action|poster|data-src)=(["'])\/(?!\/)([^"']*)\2/gi, (_m, attr, quote, rest) => {
    return `${attr}=${quote}${REMOTE_PREFIX}/${rest}${quote}`;
  });
}

/** Rewrite `url(/x)` references inside inline styles and CSS documents. */
export function rewriteCssForProxy(css: string): string {
  return css.replace(/url\((\s*)(["']?)\/(?!\/)([^"')]*)\2(\s*)\)/gi, (_m, lead, quote, rest, trail) => {
    return `url(${lead}${quote}${REMOTE_PREFIX}/${rest}${quote}${trail})`;
  });
}

/** Copy an upstream response's headers, minus the ones that block framing. */
export function proxiedResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.includes(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

/**
 * Re-serve an upstream response for the iframe. HTML and CSS bodies are
 * rewritten; everything else (images, fonts, JS, JSON) is passed through
 * byte-for-byte so the site behaves exactly as it does on its own domain.
 */
export async function buildProxiedResponse(upstream: Response): Promise<Response> {
  const headers = proxiedResponseHeaders(upstream);
  const contentType = upstream.headers.get('content-type');

  if (isHtml(contentType)) {
    const body = rewriteHtmlForProxy(await upstream.text());
    headers.set('Content-Type', contentType ?? 'text/html; charset=utf-8');
    return new Response(body, { status: upstream.status, headers });
  }

  if (contentType && contentType.includes('text/css')) {
    const body = rewriteCssForProxy(await upstream.text());
    headers.set('Content-Type', contentType);
    return new Response(body, { status: upstream.status, headers });
  }

  // Stream non-text bodies straight through so large media is never buffered.
  return new Response(upstream.body, { status: upstream.status, headers });
}

/**
 * Forward a request to the remote host and return a framable response. Shared
 * by the dev server and the production Worker so the two cannot drift.
 */
export async function proxyRemote(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = remoteUpstreamUrl(`${url.pathname}${url.search}`);

  const method = request.method === 'HEAD' ? 'HEAD' : 'GET';
  const headers = new Headers();
  const ua = request.headers.get('user-agent');
  if (ua) headers.set('User-Agent', ua);
  const accept = request.headers.get('accept');
  if (accept) headers.set('Accept', accept);

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, redirect: 'follow' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown network error';
    return new Response(`Remote proxy could not reach ${REMOTE_HOST}: ${message}`, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return buildProxiedResponse(upstream);
}
