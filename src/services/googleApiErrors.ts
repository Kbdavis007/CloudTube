/**
 * Turns a Google API error message into actionable guidance.
 *
 * Google returns prose that sometimes contains a URL, for example:
 *   "YouTube Data API v3 has not been used in project 536814899859 before or it
 *    is disabled. Enable it by visiting https://console.developers.google.com/...
 *    then retry."
 *
 * Rendering that as plain text leaves the URL inert, which is useless on a
 * touch-only device. This module recognises the common Google failures and
 * extracts the link so the UI can offer a real button.
 */

export type ApiAction = {
  label: string;
  url: string;
};

export type ApiErrorGuide = {
  title: string;
  explanation: string;
  steps: string[];
  actions: ApiAction[];
};

const URL_PATTERN = /https:\/\/[^\s"'<>)]+/;

const extractUrl = (message: string): string | null => {
  const match = message.match(URL_PATTERN);
  if (!match) return null;
  return match[0].replace(/[.,;:]+$/, '');
};

const extractProject = (message: string): string | null => {
  const match = message.match(/project\s+(\d{6,})/i);
  return match ? match[1] : null;
};

export const parseGoogleApiError = (message: string): ApiErrorGuide | null => {
  if (!message) return null;
  const lower = message.toLowerCase();

  // API not enabled for the Google Cloud project.
  if (
    lower.includes('has not been used in project') ||
    lower.includes('is disabled') ||
    lower.includes('accessnotconfigured') ||
    lower.includes('service_disabled')
  ) {
    const url = extractUrl(message);
    const project = extractProject(message);
    return {
      title: 'YouTube Data API v3 is not enabled',
      explanation:
        'Your Google sign-in worked, but the YouTube Data API is switched off for the Google Cloud project behind this app, so every request is refused.' +
        (project ? ` Project number: ${project}.` : ''),
      steps: [
        'Open the Google Cloud console with the button below.',
        'Press Enable to turn on the YouTube Data API v3 for this project.',
        'Wait a couple of minutes for the change to propagate, then retry.',
      ],
      actions: url
        ? [{ label: 'Enable YouTube Data API v3', url }]
        : [
            {
              label: 'Open Google Cloud console',
              url: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
            },
          ],
    };
  }

  // Quota exhaustion. Google phrases this as "Quota exceeded for quota metric
  // 'Queries' and limit 'Queries per day'", so match the noun-first form too.
  if (
    lower.includes('quota exceeded') ||
    lower.includes('exceeded your quota') ||
    lower.includes('quotaexceeded') ||
    lower.includes('dailylimitexceeded') ||
    lower.includes('ratelimitexceeded')
  ) {
    return {
      title: 'YouTube API daily quota reached',
      explanation:
        'The free tier allows 10,000 units per day, and the limit is shared across every request this app makes. Quota resets at midnight Pacific Time.',
      steps: [
        'Wait for the daily reset at midnight Pacific Time, or',
        'Reduce requests by importing fewer videos or comments at a time.',
      ],
      actions: [
        {
          label: 'View quota in Google Cloud',
          url: 'https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas',
        },
      ],
    };
  }

  // Missing OAuth scopes.
  if (
    lower.includes('insufficient authentication scopes') ||
    lower.includes('insufficientpermissions') ||
    lower.includes('insufficient permission')
  ) {
    return {
      title: 'Google sign-in is missing YouTube permissions',
      explanation:
        'The session was granted, but not the scopes needed to read YouTube data. This usually happens when an earlier sign-in was approved with fewer permissions.',
      steps: [
        'Sign out of CloudTube.',
        'Sign in with Google again and approve every requested permission.',
      ],
      actions: [],
    };
  }

  // Expired or revoked token.
  if (
    lower.includes('invalid_credentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid_grant') ||
    lower.includes('token has been expired or revoked')
  ) {
    return {
      title: 'Google session expired',
      explanation: 'The access token is no longer valid, so YouTube rejected the request.',
      steps: ['Sign out, then sign in with Google again to get a fresh token.'],
      actions: [],
    };
  }

  // Comments turned off on the target video.
  if (lower.includes('disabled comments') || lower.includes('commentsdisabled')) {
    return {
      title: 'Comments are disabled on this video',
      explanation: 'The video owner has turned off comments, so none can be harvested.',
      steps: ['Choose a different video to harvest comments from.'],
      actions: [],
    };
  }

  // Generic message that still contains a URL worth surfacing.
  const url = extractUrl(message);
  if (url) {
    return {
      title: 'YouTube API request failed',
      explanation: message,
      steps: ['Open the link below for details, then retry.'],
      actions: [{ label: 'Open link', url }],
    };
  }

  return null;
};

/** Splits text into plain segments and URLs so the UI can render real links. */
export const splitLinks = (text: string): { text: string; url?: string }[] => {
  if (!text) return [];
  const parts: { text: string; url?: string }[] = [];
  const pattern = /https:\/\/[^\s"'<>)]+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) });
    }
    const url = match[0].replace(/[.,;:]+$/, '');
    parts.push({ text: url, url });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }
  return parts;
};
