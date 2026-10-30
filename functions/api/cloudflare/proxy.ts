/**
 * Cloudflare Pages Function: /api/cloudflare/proxy
 *
 * Mirrors the Express proxy in server.ts so the deployed static build can reach
 * the Cloudflare API without browser CORS restrictions. Pages Functions are
 * picked up automatically from the functions/ directory — no routing config
 * needed.
 *
 * The browser POSTs { endpoint, method, headers, body } and receives
 * { status, ok, durationMs, data }.
 */

interface ProxyBody {
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

export const onRequestOptions = async (): Promise<Response> =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost = async (context: { request: Request }): Promise<Response> => {
  const { request } = context;

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

  const cfUrl = `https://api.cloudflare.com/client/v4${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const upperMethod = method.toUpperCase();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'CloudTube-Studio/1.0',
    ...headers,
  };

  const init: RequestInit = { method: upperMethod, headers: requestHeaders };
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
};
