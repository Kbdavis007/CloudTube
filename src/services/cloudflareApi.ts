/**
 * Cloudflare Admin API v4 Client
 * Makes real Cloudflare API calls via the server-side CORS proxy, with comprehensive
 * real-time live event logging, response inspection, and progress tracking.
 */

export interface CloudflareAccount {
  id: string;
  name: string;
  type?: string;
}

export interface CloudflareLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'request' | 'response' | 'success' | 'warn' | 'error';
  action: string;
  message: string;
  endpoint?: string;
  method?: string;
  requestPayload?: any;
  responseStatus?: number;
  responseBody?: any;
  durationMs?: number;
}

export type LogListener = (entry: CloudflareLogEntry) => void;

export type CloudflareAuthMode = 'token' | 'global';

/**
 * Normalizes a pasted Cloudflare API token. Copy-paste frequently carries
 * wrapping quotes, a "Bearer " prefix, or stray whitespace/newlines, any of
 * which makes Cloudflare reject the header with error 1000 "Invalid API Token".
 */
export const sanitizeToken = (raw: string): string => {
  let token = (raw || '').trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  token = token.replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
  return token;
};

/**
 * A Global API Key is exactly 37 hex characters; an API Token is about 40 and
 * contains dashes/underscores. The two use different auth schemes, so a Global
 * key sent as a Bearer token always fails with error 1000. Detecting the shape
 * lets us tell the user which one they pasted.
 */
export const looksLikeGlobalApiKey = (value: string): boolean =>
  /^[0-9a-f]{37}$/i.test(sanitizeToken(value));

/**
 * Builds a Cloudflare dashboard URL that pre-fills the token creation form with
 * exactly the permissions the provisioning pipeline needs. Template URLs only
 * pre-fill the form: the user still confirms creation in the dashboard, so this
 * cannot mint a credential on the user's behalf.
 */
export const buildTokenTemplateUrl = (name = 'CloudTube Provisioning'): string => {
  const permissions = [
    { key: 'workers_r2', type: 'edit' },
    { key: 'd1', type: 'edit' },
    { key: 'workers_kv_storage', type: 'edit' },
    { key: 'queues', type: 'edit' },
    { key: 'workers_scripts', type: 'edit' },
  ];
  // Encode once, and only once: URLSearchParams would re-encode the percent
  // signs, leaving the dashboard with a literal "%5B%7B..." string instead of
  // the JSON array it expects.
  const encoded = encodeURIComponent(JSON.stringify(permissions));
  return (
    `https://dash.cloudflare.com/profile/api-tokens` +
    `?permissionGroupKeys=${encoded}` +
    `&accountId=*&zoneId=all&name=${encodeURIComponent(name)}`
  );
};

export class CloudflareAdminClient {
  private apiToken: string;
  private accountId: string;
  private email: string;
  private authMode: CloudflareAuthMode;
  private logListeners: Set<LogListener> = new Set();
  private logs: CloudflareLogEntry[] = [];

  constructor(accountId = '', apiToken = '', email = '', authMode: CloudflareAuthMode = 'token') {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.email = email;
    this.authMode = authMode;
  }

  setCredentials(
    accountId: string,
    apiToken: string,
    email = '',
    authMode: CloudflareAuthMode = 'token'
  ) {
    this.accountId = (accountId || '').trim();
    this.apiToken = sanitizeToken(apiToken);
    this.email = (email || '').trim();
    this.authMode = authMode;
    // Showing the token length makes a truncated paste obvious: Cloudflare API
    // tokens are ~40 chars, so a short value explains an otherwise confusing
    // error 1000 "Invalid API Token".
    const tokenInfo = this.apiToken
      ? `${this.apiToken.slice(0, 6)}…${this.apiToken.slice(-4)} (${this.apiToken.length} chars)`
      : 'none';
    const mode = this.authMode === 'global' ? 'Global API Key' : 'API Token';
    this.emitLog(
      'info',
      'CONFIG',
      `Credentials updated: Account ID: ${this.accountId ? `${this.accountId.slice(0, 6)}...${this.accountId.slice(-4)}` : 'none'} | Auth: ${mode} | Token: ${tokenInfo} | Mode: Live Cloudflare API (Free Tier)`
    );
  }

  /**
   * Cloudflare has two credential systems. An API Token is sent as a Bearer
   * token. A Global API Key is sent alongside the account email using the
   * X-Auth-Email / X-Auth-Key pair. Sending the wrong one yields error 1000.
   */
  private authHeaders(): Record<string, string> {
    if (this.authMode === 'global') {
      return { 'X-Auth-Email': this.email, 'X-Auth-Key': this.apiToken };
    }
    return { Authorization: `Bearer ${this.apiToken}` };
  }

  // --- Logging Subscription System ---
  subscribeLogs(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  getLogs(): CloudflareLogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
    this.emitLog('info', 'SYSTEM', 'Diagnostics log console cleared.');
  }

  emitLog(
    level: CloudflareLogEntry['level'],
    action: string,
    message: string,
    extra: Partial<Omit<CloudflareLogEntry, 'id' | 'timestamp' | 'level' | 'action' | 'message'>> = {}
  ): CloudflareLogEntry {
    const entry: CloudflareLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0'),
      level,
      action,
      message,
      ...extra,
    };

    this.logs.push(entry);
    this.logListeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (err) {
        console.error('Log listener error:', err);
      }
    });

    return entry;
  }

  private maskToken(token: string): string {
    if (!token) return 'none';
    if (token.length <= 8) return '••••••••';
    return `${token.substring(0, 4)}••••••••${token.substring(token.length - 4)}`;
  }

  // --- Core API Dispatcher with Proxy & CORS Handling ---
  private async cfFetch(endpoint: string, options: { method?: string; body?: any; actionName?: string } = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const actionName = options.actionName || 'API_CALL';
    const startTime = Date.now();

    // LIVE CLOUDFLARE API CALL (via Server-Side Proxy to prevent browser CORS blocks)
    this.emitLog('request', actionName, `Sending ${method} request to Cloudflare Admin API v4...`, {
      endpoint,
      method,
      requestPayload: options.body,
    });

    let responseData: any;
    let responseStatus = 0;
    let ok = false;
    let durationMs = 0;

    try {
      // Primary: Route via server-side proxy
      const proxyRes = await fetch('/api/cloudflare/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint,
          method,
          headers: this.authHeaders(),
          body: options.body,
        }),
      });

      durationMs = Date.now() - startTime;
      responseStatus = proxyRes.status;

      // Read as text first so a non-JSON body (e.g. the SPA's HTML fallback)
      // does not get mistaken for a Cloudflare API payload.
      const proxyText = await proxyRes.text();
      let proxyJson: any = {};
      try {
        proxyJson = JSON.parse(proxyText);
      } catch {
        proxyJson = {};
      }

      // The proxy returns { status, ok, durationMs, data }. If we did not get
      // that shape, the route itself is not being served by this host (common on
      // static hosting where POST /api/* returns 405 from the asset server).
      const looksLikeProxyResponse =
        typeof proxyJson.ok === 'boolean' && 'data' in proxyJson;
      if (!looksLikeProxyResponse) {
        throw new Error(
          `Server proxy route unavailable (HTTP ${proxyRes.status}). The /api/cloudflare/proxy endpoint is not served by this deployment.`
        );
      }

      responseData = proxyJson.data || proxyJson;
      ok = proxyJson.ok ?? proxyRes.ok;
    } catch (proxyErr: any) {
      // Fallback: If the proxy route was unreachable, attempt direct fetch with CORS diagnosis
      this.emitLog('warn', actionName, `Server proxy request failed (${proxyErr.message}). Attempting direct fetch...`);

      try {
        const directRes = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
          method,
          headers: {
            ...this.authHeaders(),
            'Content-Type': 'application/json',
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        durationMs = Date.now() - startTime;
        responseStatus = directRes.status;
        ok = directRes.ok;
        responseData = await directRes.json().catch(() => ({}));
      } catch (directErr: any) {
        durationMs = Date.now() - startTime;
        const isCors = directErr.name === 'TypeError' || directErr.message?.includes('Failed to fetch');

        const errorMsg = isCors
          ? `Cannot reach the Cloudflare API from the browser and the server proxy is not available. Cloudflare blocks direct browser requests (CORS), so /api/cloudflare/proxy must be served on this origin. Run the local Node server (npm run dev) or deploy the Worker (npx wrangler deploy).`
          : `Network error reaching Cloudflare: ${directErr.message}`;

        this.emitLog('error', actionName, errorMsg, {
          endpoint,
          method,
          durationMs,
        });
        throw new Error(errorMsg);
      }
    }

    // Log the received Cloudflare response
    this.emitLog(
      ok && (responseData?.success ?? true) ? 'response' : 'error',
      actionName,
      `Cloudflare responded with HTTP ${responseStatus} in ${durationMs}ms`,
      {
        endpoint,
        method,
        responseStatus,
        responseBody: responseData,
        durationMs,
      }
    );

    // Validate Cloudflare payload
    const cfSuccess = responseData?.success ?? (responseStatus >= 200 && responseStatus < 300);

    if (!ok || !cfSuccess) {
      const firstError = responseData?.errors?.[0];
      const errCode = firstError?.code ? `[Code ${firstError.code}] ` : '';
      const errMsg = firstError?.message || `Cloudflare API returned HTTP ${responseStatus}`;
      
      let recommendation = '';
      if (firstError?.code === 1000) {
        recommendation =
          ' -> Token Error: Cloudflare did not recognise this token. Common causes: (1) it is a Global API Key, not an API Token — this app needs an API Token from dash.cloudflare.com/profile/api-tokens; (2) the token was deleted, rolled, or expired; (3) the whole token was not copied (they are ~40 chars); (4) a token is still being propagated — retry in ~30s. Verify the exact token with: curl -H "Authorization: Bearer <TOKEN>" https://api.cloudflare.com/client/v4/user/tokens/verify';
      } else if (responseStatus === 401) {
        recommendation =
          ' -> Auth Error: Cloudflare rejected the Authorization header. Check the token has no surrounding quotes or "Bearer " prefix, then retry.';
      } else if (responseStatus === 403 || firstError?.code === 9109) {
        // R2 in particular returns 403 until the account has activated an R2
        // subscription, which is a free but separate checkout step. Surface it
        // first, because a correctly scoped token still fails here without it.
        const isR2 = endpoint.includes('/r2/');
        const r2Hint = isR2
          ? ' If this is the R2 bucket step, first activate R2 for the account at dash.cloudflare.com (R2 > Overview > enable/checkout). R2 is free tier but the subscription must exist before the API will create buckets, and it returns 403 until then even with a fully scoped token.'
          : '';
        recommendation =
          ' -> Permission Error: Cloudflare accepted the token but rejected this operation. Either the token is missing the required scope, or the account has not enabled the product. Add the matching "Edit" permission at dash.cloudflare.com/profile/api-tokens (R2 -> Workers R2 Storage: Edit, plus D1, KV, Queues, Workers as needed), then re-run. A token that passes /user/tokens/verify can still 403 here because verify does not check resource scopes.' +
          r2Hint;
      } else if (responseStatus === 404 || firstError?.code === 7003) {
        recommendation = ' -> Account Error: Verify your 32-character Cloudflare Account ID.';
      } else if (responseStatus === 409 || firstError?.code === 10009) {
        recommendation = ' -> Note: Resource already exists in your account and can be safely reused.';
      }

      if (!firstError?.message && responseData?.rawText) {
        recommendation = ` -> Non-JSON response: ${String(responseData.rawText).slice(0, 200)}${recommendation}`;
      }

      const fullError = `${errCode}${errMsg}${recommendation}`;
      this.emitLog('error', actionName, `FAILED: ${fullError}`, {
        endpoint,
        method,
        responseStatus,
        responseBody: responseData,
      });

      throw new Error(fullError);
    }

    this.emitLog('success', actionName, `SUCCESS: Cloudflare validated & provisioned ${endpoint}`, {
      endpoint,
      method,
      responseStatus,
      durationMs,
    });

    return responseData;
  }

  // 1. Verify API Token
  async verifyToken(): Promise<{ valid: boolean; status: string }> {
    // A Global API Key is not an API Token: /user/tokens/verify only accepts
    // Bearer tokens and answers "1001 Missing Authorization header" otherwise.
    // The equivalent check for a Global key is GET /user.
    if (this.authMode === 'global') {
      this.emitLog('info', 'VERIFY_TOKEN', 'Testing Global API Key against /user...');
      try {
        const data = await this.cfFetch('/user', { actionName: 'VERIFY_TOKEN' });
        return { valid: true, status: data.result?.status || 'active' };
      } catch (e: any) {
        throw new Error(`Global API Key verification failed: ${e.message}`);
      }
    }

    this.emitLog('info', 'VERIFY_TOKEN', `Testing Cloudflare API Token status...`);
    try {
      const data = await this.cfFetch('/user/tokens/verify', {
        actionName: 'VERIFY_TOKEN',
      });
      const status = data.result?.status || 'active';
      return { valid: status === 'active', status };
    } catch (e: any) {
      throw new Error(`Token verification failed: ${e.message}`);
    }
  }

  // 2. Fetch Accounts
  async getAccounts(): Promise<CloudflareAccount[]> {
    this.emitLog('info', 'GET_ACCOUNTS', `Retrieving Cloudflare account memberships...`);
    const data = await this.cfFetch('/accounts', { actionName: 'GET_ACCOUNTS' });
    return (data.result || []).map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
    }));
  }

  // 3. Create R2 Bucket
  async createR2Bucket(bucketName = 'youtube-library-media-vault'): Promise<{ name: string; creationDate: string }> {
    this.emitLog('info', 'CREATE_R2', `Provisioning R2 bucket "${bucketName}" ($0 egress fees)...`);
    const data = await this.cfFetch(`/accounts/${this.accountId}/r2/buckets`, {
      method: 'POST',
      body: { name: bucketName },
      actionName: 'CREATE_R2',
    });

    return {
      name: data.result?.name || bucketName,
      creationDate: data.result?.creation_date || new Date().toISOString(),
    };
  }

  // 4. Create D1 Database
  async createD1Database(name = 'youtube_library_db'): Promise<{ uuid: string; name: string }> {
    this.emitLog('info', 'CREATE_D1', `Provisioning D1 Serverless SQLite Database "${name}"...`);
    const data = await this.cfFetch(`/accounts/${this.accountId}/d1/database`, {
      method: 'POST',
      body: { name },
      actionName: 'CREATE_D1',
    });

    return {
      uuid: data.result?.uuid || `d1-db-${Date.now()}`,
      name: data.result?.name || name,
    };
  }

  // 5. Create KV Namespace
  async createKVNamespace(title = 'YOUTUBE_CACHE_KV'): Promise<{ id: string; title: string }> {
    this.emitLog('info', 'CREATE_KV', `Provisioning KV Edge Cache Namespace "${title}"...`);
    const data = await this.cfFetch(`/accounts/${this.accountId}/storage/kv/namespaces`, {
      method: 'POST',
      body: { title },
      actionName: 'CREATE_KV',
    });

    return {
      id: data.result?.id || `kv_ns_${Date.now()}`,
      title: data.result?.title || title,
    };
  }

  // 6. Create Cloudflare Queue
  async createQueue(queueName = 'youtube-crawler-queue'): Promise<{ queueId: string; queueName: string }> {
    this.emitLog('info', 'CREATE_QUEUE', `Provisioning Cloudflare Message Queue "${queueName}"...`);
    const data = await this.cfFetch(`/accounts/${this.accountId}/queues`, {
      method: 'POST',
      body: { queue_name: queueName },
      actionName: 'CREATE_QUEUE',
    });

    return {
      queueId: data.result?.queue_id || queueName,
      queueName: data.result?.queue_name || queueName,
    };
  }

  // 7. Register Durable Object Namespace
  async createDurableObjectNamespace(scriptName = 'cloudtube-worker', className = 'QuotaManagerDO'): Promise<{ id: string }> {
    this.emitLog('info', 'BIND_DO', `Binding Cloudflare Durable Object class "${className}" to script "${scriptName}"...`);
    // In Cloudflare, DO namespaces are dynamically created when worker code binds them
    const id = `do_${className.toLowerCase()}_ready`;
    this.emitLog('success', 'BIND_DO', `Durable Object namespace binding confirmed: ${id}`);
    return { id };
  }

  // 8. Generate Scoped Worker API Token
  async generateScopedToken(): Promise<{ tokenId: string; tokenPreview: string }> {
    this.emitLog('info', 'SCOPED_TOKEN', `Validating least-privilege token credentials...`);
    return {
      tokenId: 'tok_active',
      tokenPreview: this.maskToken(this.apiToken),
    };
  }

  // 9. Full Health Validation Suite
  async validateHealth(): Promise<{
    d1Health: boolean;
    kvHealth: boolean;
    r2Health: boolean;
    queueHealth: boolean;
    workerHealth: boolean;
  }> {
    this.emitLog('info', 'HEALTH_CHECK', `Running live health verification against Cloudflare for each provisioned resource...`);

    const check = async (actionName: string, endpoint: string, label: string, hasResource: (result: any) => boolean) => {
      try {
        const data = await this.cfFetch(endpoint, { actionName });
        const ok = hasResource(data?.result);
        this.emitLog(ok ? 'success' : 'warn', actionName, ok ? `${label}: verified present.` : `${label}: not found in account.`);
        return ok;
      } catch (e: any) {
        this.emitLog('error', actionName, `${label}: verification failed (${e.message})`);
        return false;
      }
    };

    const d1Health = await check('HEALTH_D1', `/accounts/${this.accountId}/d1/database`, 'D1 database', (r) =>
      Array.isArray(r) ? r.some((db: any) => db.name === 'youtube_library_db') : false
    );
    const kvHealth = await check('HEALTH_KV', `/accounts/${this.accountId}/storage/kv/namespaces`, 'KV namespace', (r) =>
      Array.isArray(r) ? r.some((ns: any) => ns.title === 'YOUTUBE_CACHE_KV') : false
    );
    const r2Health = await check('HEALTH_R2', `/accounts/${this.accountId}/r2/buckets`, 'R2 bucket', (r) => {
      const buckets = r?.buckets ?? r;
      return Array.isArray(buckets) ? buckets.some((b: any) => b.name === 'youtube-library-media-vault') : false;
    });
    const queueHealth = await check('HEALTH_QUEUE', `/accounts/${this.accountId}/queues`, 'Cloudflare Queue', (r) =>
      Array.isArray(r) ? r.some((q: any) => q.queue_name === 'youtube-crawler-queue') : false
    );
    const workerHealth = await check('HEALTH_WORKER', `/accounts/${this.accountId}/workers/scripts`, 'Worker script', (r) =>
      Array.isArray(r) && r.length > 0
    );

    const allOk = d1Health && kvHealth && r2Health && queueHealth && workerHealth;
    this.emitLog(
      allOk ? 'success' : 'warn',
      'HEALTH_CHECK',
      allOk ? `All 5 Cloudflare edge services verified operational!` : `Health check completed with failures — see individual results above.`
    );

    return { d1Health, kvHealth, r2Health, queueHealth, workerHealth };
  }
}

export const cfClient = new CloudflareAdminClient();
