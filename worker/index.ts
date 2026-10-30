/**
 * CloudTube edge Worker.
 *
 * The production deployment is a Worker (not a Pages project), so Pages
 * Functions in functions/ are never executed. This entry point serves the built
 * SPA from the ASSETS binding and implements the same-origin API the browser
 * needs:
 *
 *   GET  /api/health            -> build/version provenance
 *   POST /api/cloudflare/proxy  -> server-side relay to the Cloudflare API
 *
 * The proxy exists because api.cloudflare.com sends no CORS headers, so a
 * browser cannot call it directly.
 */

import {
  VERSION,
  TAG,
  COMMIT,
  COMMIT_DATE,
  BRANCH,
  DIRTY,
  VERSION_LABEL,
} from '../src/generated/version';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

interface ProxyBody {
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const json = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });

const handleHealth = (): Response =>
  json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'CloudTube Studio Backend',
    version: VERSION,
    tag: TAG,
    commit: COMMIT,
    commitDate: COMMIT_DATE,
    branch: BRANCH,
    dirty: DIRTY,
    versionLabel: VERSION_LABEL,
  });

async function handleProxy(request: Request): Promise<Response> {
  let payload: ProxyBody;
  try {
    payload = (await request.json()) as ProxyBody;
  } catch {
    return json({ status: 400, ok: false, errors: [{ message: 'Invalid JSON body' }] }, 400);
  }

  const { endpoint, method = 'GET', headers = {}, body } = payload;
  if (!endpoint) {
    return json(
      { status: 400, ok: false, errors: [{ message: 'Missing required "endpoint" parameter' }] },
      400
    );
  }

  const cfUrl = `https://api.cloudflare.com/client/v4${
    endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  }`;
  const upperMethod = method.toUpperCase();

  const init: RequestInit = {
    method: upperMethod,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'CloudTube-Studio/1.0',
      ...headers,
    },
  };
  if (body && ['POST', 'PUT', 'PATCH'].includes(upperMethod)) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const startTime = Date.now();
  try {
    const cfResponse = await fetch(cfUrl, init);
    const durationMs = Date.now() - startTime;

    const responseText = await cfResponse.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawText: responseText };
    }

    return json(
      { status: cfResponse.status, ok: cfResponse.ok, durationMs, data: responseData },
      cfResponse.status
    );
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : 'Unknown network error';
    return json(
      {
        status: 502,
        ok: false,
        durationMs,
        errors: [{ message: `Failed to reach Cloudflare API server: ${message}`, code: 502 }],
      },
      502
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/health') {
      return handleHealth();
    }

    if (pathname === '/api/cloudflare/proxy') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      if (request.method !== 'POST') {
        return json(
          { status: 405, ok: false, errors: [{ message: 'Use POST for /api/cloudflare/proxy' }] },
          405
        );
      }
      return handleProxy(request);
    }

    // Unknown API paths must not fall through to the SPA (which would answer
    // with HTML and look like a bogus 200 to JSON clients).
    if (pathname.startsWith('/api/')) {
      return json({ status: 404, ok: false, errors: [{ message: `No API route for ${pathname}` }] }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
