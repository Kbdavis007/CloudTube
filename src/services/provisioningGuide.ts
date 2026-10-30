/**
 * Turns a Cloudflare API failure into concrete, actionable steps.
 *
 * The wizard is the only interface most users have, so every failure needs to
 * answer three questions: what happened, why, and where to click. Deep links use
 * Cloudflare's `?to=/:account/<path>` form, which resolves the account for the
 * signed-in user and avoids hardcoding an account ID.
 */

export type GuideAction = {
  label: string;
  url: string;
};

export type ProvisioningGuide = {
  title: string;
  explanation: string;
  steps: string[];
  actions: GuideAction[];
  /** True when the fix requires a change in Cloudflare, not a retry. */
  requiresUserAction: boolean;
};

const DASH = 'https://dash.cloudflare.com';

export const CF_LINKS = {
  tokens: `${DASH}/profile/api-tokens`,
  r2: `${DASH}/?to=/:account/r2/overview`,
  d1: `${DASH}/?to=/:account/d1`,
  kv: `${DASH}/?to=/:account/workers/kv/namespaces`,
  queues: `${DASH}/?to=/:account/queues`,
  home: `${DASH}/?to=/:account/home`,
} as const;

/** Which dashboard page fixes a problem for a given provisioning step. */
const SERVICE_LINKS: Record<string, GuideAction> = {
  R2: { label: 'Open R2 in Cloudflare', url: CF_LINKS.r2 },
  D1: { label: 'Open D1 in Cloudflare', url: CF_LINKS.d1 },
  KV: { label: 'Open KV in Cloudflare', url: CF_LINKS.kv },
  QUEUE: { label: 'Open Queues in Cloudflare', url: CF_LINKS.queues },
};

export const serviceFromEndpoint = (endpoint: string): string => {
  if (endpoint.includes('/r2/')) return 'R2';
  if (endpoint.includes('/d1/')) return 'D1';
  if (endpoint.includes('/kv/')) return 'KV';
  if (endpoint.includes('/queues')) return 'QUEUE';
  return 'UNKNOWN';
};

const SCOPE_NAMES: Record<string, string> = {
  R2: 'Workers R2 Storage: Edit',
  D1: 'D1: Edit',
  KV: 'Workers KV Storage: Edit',
  QUEUE: 'Queues: Edit',
};

export const buildGuide = (
  errorCode: number | undefined,
  endpoint: string,
  status: number
): ProvisioningGuide | null => {
  const service = serviceFromEndpoint(endpoint);
  const serviceLink = SERVICE_LINKS[service];

  // R2 is not enabled on the account. No token change can fix this.
  if (errorCode === 10042) {
    return {
      title: 'R2 needs to be enabled for your account',
      explanation:
        'Cloudflare requires you to activate R2 once per account before the API will create buckets. It is free tier, but the subscription must exist first. Your token is fine — do not edit it.',
      steps: [
        'Open R2 in the Cloudflare dashboard using the button below.',
        'If prompted, complete the R2 enable/checkout flow (a payment method on file is required even though the free tier costs $0).',
        'Come back to this tab and press Retry Provisioning.',
      ],
      actions: [
        { label: 'Enable R2 in Cloudflare', url: CF_LINKS.r2 },
        { label: 'Edit token scopes', url: CF_LINKS.tokens },
      ],
      requiresUserAction: true,
    };
  }

  if (errorCode === 1000) {
    return {
      title: 'Cloudflare did not recognise this token',
      explanation:
        'The token value itself was rejected, so nothing about the account state matters until this is fixed.',
      steps: [
        'Create a fresh Account API Token (not a Zone token, not a Global API Key) using the button below.',
        'Grant Account-scoped Edit on R2, D1, KV, Queues and Workers Scripts, plus User Details: Read.',
        'Copy the whole token (~40 characters) and paste it into Step 1, then press Test Token again.',
      ],
      actions: [
        { label: 'Create a correctly scoped token', url: CF_LINKS.tokens },
      ],
      requiresUserAction: true,
    };
  }

  if (status === 401) {
    return {
      title: 'Cloudflare rejected the credentials',
      explanation:
        'The Authorization header was refused. This is usually a paste artifact or a revoked token.',
      steps: [
        'Return to Step 1 and press Test Token to confirm the credential still verifies.',
        'If it fails there, create a new token and paste it again.',
      ],
      actions: [{ label: 'Manage tokens', url: CF_LINKS.tokens }],
      requiresUserAction: true,
    };
  }

  if (status === 403 || errorCode === 9109) {
    const scope = SCOPE_NAMES[service] ?? 'the matching Edit permission';
    return {
      title: `Token is missing the ${service} scope`,
      explanation:
        'Cloudflare accepted the token but refused this operation, which means the permission for this resource was not granted. Note that Test Token only proves the token exists — it does not check resource scopes, so a token can pass that test and still fail here.',
      steps: [
        'Open your tokens page using the button below.',
        `Edit the token in use and add Account scoped ${scope}.`,
        'Save the token, then return here and press Retry Provisioning.',
      ],
      actions: [
        { label: 'Edit token scopes', url: CF_LINKS.tokens },
        ...(serviceLink ? [serviceLink] : []),
      ],
      requiresUserAction: true,
    };
  }

  if (status === 404 || errorCode === 7003) {
    return {
      title: 'Account ID not found',
      explanation:
        'Cloudflare could not resolve the account from the ID provided, so the request had nowhere to go.',
      steps: [
        'Open your Cloudflare dashboard and copy the 32-character Account ID from the URL or the sidebar.',
        'Paste it into Step 1 (it is trimmed automatically) and retry.',
      ],
      actions: [{ label: 'Find your Account ID', url: CF_LINKS.home }],
      requiresUserAction: true,
    };
  }

  if (status === 409 || errorCode === 10009) {
    return {
      title: 'Resource already exists',
      explanation:
        'This resource is already present in your account, so there is nothing to create. It can be reused safely.',
      steps: ['Press Retry Provisioning to continue with the remaining steps.'],
      actions: [],
      requiresUserAction: false,
    };
  }

  if (status >= 500) {
    return {
      title: 'Cloudflare returned a server error',
      explanation: 'This is a temporary fault on Cloudflare’s side rather than a problem with your setup.',
      steps: ['Wait about 30 seconds, then press Retry Provisioning.'],
      actions: [],
      requiresUserAction: false,
    };
  }

  return null;
};
