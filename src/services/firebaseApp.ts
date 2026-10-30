/**
 * Single Firebase app instance shared by Auth and AI Logic.
 *
 * AI Logic is called with the same app the user signed in with, so the Gemini
 * request is attributed to that Google account and no API key is needed on the
 * client.
 *
 * App Check is initialised here because Firebase AI Logic enforces it: without a
 * valid attestation token every Gemini call is rejected. The provider is
 * reCAPTCHA Enterprise, using the site key from firebase-applet-config.json
 * (a public site key, safe to ship in the bundle). The debug token is only
 * enabled when running a Vite dev build, so production cannot be spoofed.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/** Firebase console page where the App Check provider is registered once. */
export const APP_CHECK_SETUP_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/appcheck`;

/**
 * Google Cloud page listing the reCAPTCHA Enterprise keys for this project.
 * Used to add the app's domains, confirm the key is score-based, and monitor
 * assessment scores on the key's Overview tab.
 */
export const RECAPTCHA_KEYS_URL = `https://console.cloud.google.com/security/recaptcha?project=${firebaseConfig.projectId}`;

/**
 * Guards against registering the App Check provider twice when modules are
 * re-evaluated (HMR, or two imports racing during startup).
 */
export const initAppCheck = (): AppCheck | null => {
  const siteKey = (firebaseConfig as { recaptchaSiteKey?: string }).recaptchaSiteKey;
  if (!siteKey) {
    console.warn(
      '[App Check] No reCAPTCHA Enterprise site key in firebase-applet-config.json; ' +
        'AI Logic calls will be rejected once App Check is enforced.'
    );
    return null;
  }

  if (import.meta.env.DEV) {
    // Lets the Firebase console debug token pass during local development.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string })
      .FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    return initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // initializeAppCheck throws if already initialised; not fatal.
    console.debug('[App Check] initializeAppCheck skipped:', err);
    return null;
  }
};
