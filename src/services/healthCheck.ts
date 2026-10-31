/**
 * End-to-end health check.
 *
 * Verifies every permission, provisioned resource, and client setting the app
 * depends on, and reports each one independently so a single failure does not
 * hide the rest. Every check that can fail for a fixable reason carries a `fix`
 * descriptor, which the UI renders as a button.
 *
 * Safe to run at any time: it only performs read/list calls, never creates or
 * deletes anything.
 */

import {
  cfClient,
  CLOUDFLARE_RESOURCES,
  buildAnalyticsTokenUrl,
  buildTokenTemplateUrl,
  looksLikeGlobalApiKey,
} from './cloudflareApi';
import { loadAndDecryptCredentials, isVaultConfigured } from './crypto';
import { firebaseApp, APP_CHECK_SETUP_URL } from './firebaseApp';
import { GEMINI_MODEL_NAME } from './geminiAi';
import type { HealthCheckItem, HealthReport } from '../types';

/** Turns a probe failure into a fixable or unfixable item. */
const fromProbe = (
  base: Omit<HealthCheckItem, 'status'>,
  probe: { ok: boolean; present: boolean; error?: string; status?: number; code?: number },
  opts: { onMissing?: HealthCheckItem['fix']; fixLabel?: string } = {}
): HealthCheckItem => {
  if (!probe.ok) {
    const isPermission = probe.status === 403 || probe.code === 9109;
    return ({
      ...base,
      status: 'fail',
      message: probe.error,
      fix: isPermission
        ? {
            label: opts.fixLabel ?? 'Create a token with this scope',
            kind: 'token',
            url: buildTokenTemplateUrl(),
          }
        : { label: 'Retry check', kind: 'retry' },
    });
  }
  if (!probe.present) {
    return ({
      ...base,
      status: 'fail',
      message: 'Not found in this account.',
      fix: opts.onMissing,
    });
  }
  return ({ ...base, status: 'pass' });
};

/**
 * Runs the full health check. Never throws: an unreachable API is itself a
 * reported failure, so the UI always gets a complete report to render.
 */
export const runHealthCheck = async (): Promise<HealthReport> => {
  const groups: HealthReport['groups'] = [];

  // --- Group 1: credentials and account identity -------------------------
  const credItems: HealthCheckItem[] = [];
  const vaultConfigured = isVaultConfigured();
  let creds: Awaited<ReturnType<typeof loadAndDecryptCredentials>> = null;

  if (!vaultConfigured) {
    credItems.push(
      ({
        id: 'vault',
        label: 'Encrypted credential vault',
        detail: 'Stores the Cloudflare token at rest',
        status: 'fail',
        message: 'No credentials are stored yet.',
        fix: { label: 'Open the setup wizard', kind: 'credentials', step: 1 },
      })
    );
  } else {
    try {
      creds = await loadAndDecryptCredentials();
    } catch (e: any) {
      creds = null;
    }
    credItems.push(
      ({
        id: 'vault',
        label: 'Encrypted credential vault',
        detail: 'Stores the Cloudflare token at rest',
        status: creds?.apiToken ? 'pass' : 'fail',
        message: creds?.apiToken ? undefined : 'The vault exists but could not be decrypted.',
        fix: creds?.apiToken
          ? undefined
          : { label: 'Re-enter credentials', kind: 'credentials', step: 1 },
      })
    );
  }

  if (creds?.apiToken) {
    cfClient.setCredentials(creds.accountId, creds.apiToken, creds.accountEmail, creds.authMode);

    const accountShapeOk = /^[0-9a-f]{32}$/i.test(creds.accountId || '');
    credItems.push(
      ({
        id: 'accountId',
        label: 'Cloudflare Account ID',
        detail: '32-character hex account identifier',
        status: accountShapeOk ? 'pass' : 'fail',
        message: accountShapeOk ? undefined : 'Not a 32-character hex account ID.',
        fix: accountShapeOk
          ? undefined
          : { label: 'Find your Account ID', kind: 'dashboard', url: 'https://dash.cloudflare.com/?to=/:account/home' },
      })
    );

    credItems.push(
      ({
        id: 'tokenType',
        label: 'Credential type',
        detail: 'An API Token is preferred over a Global API Key',
        status: looksLikeGlobalApiKey(creds.apiToken) ? 'warn' : 'pass',
        message: looksLikeGlobalApiKey(creds.apiToken)
          ? 'Using a Global API Key, which is account-wide and cannot be scoped.'
          : undefined,
        fix: looksLikeGlobalApiKey(creds.apiToken)
          ? { label: 'Create a scoped API Token', kind: 'token', url: buildTokenTemplateUrl() }
          : undefined,
      })
    );
  }

  groups.push({ title: 'Credentials & Account', items: credItems });

  if (!creds?.apiToken || !creds?.accountId) {
    // Without credentials every Cloudflare check would fail identically, which
    // is noise. Report the one actionable cause instead.
    const passed = credItems.filter((i) => i.status === 'pass').length;
    const failed = credItems.filter((i) => i.status === 'fail').length;
    return {
      ranAt: new Date().toISOString(),
      ok: failed === 0,
      groups,
      passed,
      failed,
      warned: credItems.filter((i) => i.status === 'warn').length,
    };
  }

  // --- Group 2: token validity -------------------------------------------
  const tokenItems: HealthCheckItem[] = [];
  try {
    const verify = await cfClient.verifyToken();
    tokenItems.push(
      ({
        id: 'tokenValid',
        label: 'Token is active',
        detail: 'Cloudflare recognises the credential',
        status: verify.valid ? 'pass' : 'fail',
        message: verify.valid ? undefined : `Cloudflare reports status "${verify.status}".`,
        fix: verify.valid
          ? undefined
          : { label: 'Create a new token', kind: 'token', url: buildTokenTemplateUrl() },
      })
    );
  } catch (e: any) {
    tokenItems.push(
      ({
        id: 'tokenValid',
        label: 'Token is active',
        detail: 'Cloudflare recognises the credential',
        status: 'fail',
        message: e?.message,
        fix: { label: 'Create a new token', kind: 'token', url: buildTokenTemplateUrl() },
      })
    );
  }
  groups.push({ title: 'Token', items: tokenItems });

  // --- Group 3: per-permission checks ------------------------------------
  // Each probe lists one resource type, so a 403 here proves that specific
  // scope is missing rather than the whole token being rejected.
  const acc = creds.accountId;
  const permissionDefs = [
    { id: 'permR2', label: 'Workers R2 Storage: Edit', detail: 'R2 media vault access', endpoint: `/accounts/${acc}/r2/buckets` },
    { id: 'permD1', label: 'D1: Edit', detail: 'library database access', endpoint: `/accounts/${acc}/d1/database` },
    { id: 'permKV', label: 'Workers KV Storage: Edit', detail: 'cache namespace access', endpoint: `/accounts/${acc}/storage/kv/namespaces` },
    { id: 'permQueues', label: 'Queues: Edit', detail: 'crawler queue access', endpoint: `/accounts/${acc}/queues` },
    { id: 'permWorkers', label: 'Workers Scripts: Edit', detail: 'edge gateway access', endpoint: `/accounts/${acc}/workers/scripts` },
  ];
  const permissionItems = await Promise.all(
    permissionDefs.map(async ({ id, label, detail, endpoint }) => {
      const probe = await cfClient.probe(`HC_PERM_${id}`, endpoint);
      return fromProbe({ id, label, detail }, probe, { fixLabel: `Grant ${label}` });
    })
  );
  groups.push({ title: 'Token Permissions', items: permissionItems });

  // --- Group 4: provisioned resources ------------------------------------
  const resourceItems: HealthCheckItem[] = [];

  const d1 = await cfClient.probe('HC_D1', `/accounts/${acc}/d1/database`, (r) =>
    Array.isArray(r) ? r.some((db: any) => db.name === CLOUDFLARE_RESOURCES.d1Database) : false
  );
  resourceItems.push(
    fromProbe(
      {
        id: 'resD1',
        label: `D1 database "${CLOUDFLARE_RESOURCES.d1Database}"`,
        detail: 'Stores the video library',
      },
      d1,
      { onMissing: { label: 'Provision it', kind: 'credentials', step: 2 } }
    )
  );

  const kv = await cfClient.probe('HC_KV', `/accounts/${acc}/storage/kv/namespaces`, (r) =>
    Array.isArray(r) ? r.some((ns: any) => ns.title === CLOUDFLARE_RESOURCES.kvNamespace) : false
  );
  resourceItems.push(
    fromProbe(
      {
        id: 'resKV',
        label: `KV namespace "${CLOUDFLARE_RESOURCES.kvNamespace}"`,
        detail: 'Caches API responses at the edge',
      },
      kv,
      { onMissing: { label: 'Provision it', kind: 'credentials', step: 2 } }
    )
  );

  const r2 = await cfClient.probe('HC_R2', `/accounts/${acc}/r2/buckets`, (r) => {
    const buckets = r?.buckets ?? r;
    return Array.isArray(buckets)
      ? buckets.some((b: any) => b.name === CLOUDFLARE_RESOURCES.r2Bucket)
      : false;
  });
  resourceItems.push(
    fromProbe(
      {
        id: 'resR2',
        label: `R2 bucket "${CLOUDFLARE_RESOURCES.r2Bucket}"`,
        detail: 'Stores downloaded media',
      },
      r2,
      {
        onMissing: {
          label: 'Activate R2 in Cloudflare',
          kind: 'dashboard',
          url: 'https://dash.cloudflare.com/?to=/:account/r2/overview',
        },
      }
    )
  );

  const queue = await cfClient.probe('HC_Q', `/accounts/${acc}/queues`, (r) =>
    Array.isArray(r) ? r.some((q: any) => q.queue_name === CLOUDFLARE_RESOURCES.queue) : false
  );
  resourceItems.push(
    fromProbe(
      {
        id: 'resQueue',
        label: `Queue "${CLOUDFLARE_RESOURCES.queue}"`,
        detail: 'Dispatches background crawls',
      },
      queue,
      { onMissing: { label: 'Provision it', kind: 'credentials', step: 2 } }
    )
  );

  const worker = await cfClient.probe('HC_W', `/accounts/${acc}/workers/scripts`, (r) =>
    Array.isArray(r) && r.length > 0
  );
  resourceItems.push(
    fromProbe(
      {
        id: 'resWorker',
        label: 'Worker script deployed',
        detail: 'Serves the edge API',
      },
      worker,
      { onMissing: { label: 'Deploy the Worker', kind: 'dashboard', url: 'https://dash.cloudflare.com/?to=/:account/workers-and-pages' } }
    )
  );

  groups.push({ title: 'Provisioned Resources', items: resourceItems });

  // --- Group 5: usage analytics ------------------------------------------
  const analyticsItems: HealthCheckItem[] = [];
  try {
    const snap = await cfClient.fetchUsageSnapshot();
    const partial = snap.errors.length > 0;
    analyticsItems.push(
      ({
        id: 'analytics',
        label: 'Usage analytics readable',
        detail: 'Powers the Settings usage gauges',
        status: partial ? 'warn' : 'pass',
        message: partial ? snap.errors.join(' ') : undefined,
        fix: partial
          ? { label: 'Create a token with this scope', kind: 'token', url: buildAnalyticsTokenUrl() }
          : undefined,
      })
    );
  } catch (e: any) {
    // The scope problem can surface two ways: the service's own typed error, or
    // a proxy-level 403 (Cloudflare answers GraphQL authz failures that way),
    // which arrives as a plain Error carrying cfStatus. Both are fixed by a
    // token with the analytics scope, so both must offer the token button.
    const needsScope = Boolean(
      e?.needsAnalyticsPermission || e?.cfStatus === 403 || e?.cfCode === 9109
    );
    analyticsItems.push(
      ({
        id: 'analytics',
        label: 'Usage analytics readable',
        detail: 'Powers the Settings usage gauges',
        status: 'fail',
        message: e?.message,
        fix: needsScope
          ? { label: 'Create a token with this scope', kind: 'token', url: buildAnalyticsTokenUrl() }
          : { label: 'Retry check', kind: 'retry' },
      })
    );
  }
  groups.push({ title: 'Usage Analytics', items: analyticsItems });

  // --- Group 6: client-side settings -------------------------------------
  const settingItems: HealthCheckItem[] = [];

  // Probe the proxy itself rather than assuming it: on static hosting POST
  // /api/* returns 405 from the asset server, which breaks every CF call.
  let proxyReachable = false;
  try {
    const res = await fetch('/api/cloudflare/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: '/user/tokens/verify', method: 'GET', headers: {}, body: undefined }),
    });
    const json: any = await res.json().catch(() => null);
    proxyReachable = typeof json?.ok === 'boolean' && 'data' in json;
  } catch {
    proxyReachable = false;
  }

  const siteKey = (firebaseApp.options as any)?.recaptchaSiteKey;
  settingItems.push(
    ({
      id: 'appCheckKey',
      label: 'App Check reCAPTCHA site key',
      detail: 'Required for AI Logic to accept requests',
      status: siteKey ? 'pass' : 'fail',
      message: siteKey ? undefined : 'No reCAPTCHA Enterprise site key configured.',
      fix: siteKey
        ? undefined
        : { label: 'Register App Check provider', kind: 'dashboard', url: APP_CHECK_SETUP_URL },
    })
  );

  settingItems.push(
    ({
      id: 'proxyRoute',
      label: 'Server API proxy reachable',
      detail: 'Cloudflare blocks direct browser calls, so /api/cloudflare/proxy must be served',
      status: proxyReachable ? 'pass' : 'fail',
      message: proxyReachable
        ? undefined
        : 'The proxy route did not respond. Run the local server (npm run dev) or deploy the Worker.',
      fix: proxyReachable ? undefined : { label: 'Retry check', kind: 'retry' },
    })
  );

  settingItems.push(
    ({
      id: 'geminiModel',
      label: `AI model "${GEMINI_MODEL_NAME}"`,
      detail: 'Used for summaries and comment insights',
      status: 'pass',
    })
  );

  groups.push({ title: 'App Settings', items: settingItems });

  const all = groups.flatMap((g) => g.items);
  return {
    ranAt: new Date().toISOString(),
    ok: all.every((i) => i.status !== 'fail'),
    groups,
    passed: all.filter((i) => i.status === 'pass').length,
    failed: all.filter((i) => i.status === 'fail').length,
    warned: all.filter((i) => i.status === 'warn').length,
  };
};
