# AI Video Summaries

AI summaries use **Firebase AI Logic**, not a Gemini API key on the client. Firebase's
proxy holds the Gemini key on its backend, so the key is never embedded in the app
bundle and users never see or configure one. Requests are attributed to the Google
account the user already signed in with.

## One-time owner setup

Do this once per Firebase project. The Setup Wizard (Step 5) links straight to it.

1. Open the AI Logic page for the project:
   `https://console.firebase.google.com/project/<projectId>/ailogic`
2. Run the guided workflow. When asked for a **Gemini API provider**, choose the
   **Gemini Developer API** (free tier, no billing). The Agent Platform / Vertex AI
   option requires billing.
3. The workflow enables the required APIs and enforces **App Check** for AI Logic.
   Enforcing App Check is required for the feature to work in production.

After this, any signed-in user can generate summaries. No user action, no key.

## Model name

Summaries use `gemini-3.8-flash`, the current stable Gemini Flash. Gemini 2.5 models
are limited to projects that used them before their cutoff, so a project that never
called them gets a 404 (`... no longer available to new users ...`) from
`generateContent`.

Google retires model names on a schedule, so the name is not hard-coded. Set the
`VITE_GEMINI_MODEL` build variable to override it without editing code:

```bash
VITE_GEMINI_MODEL="gemini-3.5-flash" npm run build
```

The default lives in `src/services/geminiAi.ts`. When a name is retired the service
rewrites the 404 into a message naming the model this build requested and the docs
page listing supported names
(`https://firebase.google.com/docs/ai-logic/models`), rather than showing the raw
`firebasevertexai.googleapis.com` URL.

## App Check (reCAPTCHA Enterprise)

AI Logic enforces App Check, so the client must present a valid attestation token.
The web provider is **reCAPTCHA Enterprise**, configured with the site key stored in
`firebase-applet-config.json` (`recaptchaSiteKey`). The site key is public and safe to
ship in the bundle; it is not a secret.

Setup once per project:

1. Create a reCAPTCHA Enterprise key at
   `https://console.cloud.google.com/security/recaptcha` for the project.
2. Add the app's production domains to the key's allowed domains
   (reCAPTCHA Enterprise -> the key -> Domains).
3. Register the site key under Firebase console -> Security -> App Check -> Apps,
   selecting **reCAPTCHA Enterprise** as the provider. This links the key so Firebase
   accepts tokens minted with it.

`src/services/firebaseApp.ts` calls `initializeAppCheck` with
`new ReCaptchaEnterpriseProvider(siteKey)`.

## Local development with App Check enforced

App Check is enforced in the console. For local dev, register an App Check debug
token (Firebase console -> Security -> App Check -> Apps -> Manage debug tokens).
`initAppCheck()` already sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` when running
a Vite dev build, so a fresh debug token is printed to the browser console on first run;
register that value once in the console. The flag is never set in production builds.

## Request timeout

AI requests are capped at 60s (`VITE_GEMINI_TIMEOUT_MS`, default `60000` in
`src/services/geminiAi.ts`). The Firebase AI SDK's own default is 180s, which is far
too long for a button: when a call cannot complete the request simply stays pending,
so the UI spins with no error for three minutes.

If you see "The AI request did not complete within 60s", the request was abandoned
rather than rejected. The usual cause is **App Check**: when it is enforced, any call
whose attestation token is missing or minted for an unregistered domain is refused,
and the app's runtime domain must be on both the reCAPTCHA Enterprise key and the
app's App Check provider. Confirm AI Logic is enabled, then retry.

## Where it lives in the code

- `src/services/geminiAi.ts` - Gemini calls via `firebase/ai` (`getAI` +
  `getGenerativeModel`). Exposes `GEMINI_AI_SETUP_URL` used by the Setup Wizard,
  `GEMINI_MODEL_NAME` (default `gemini-3.8-flash`, overridable with
  `VITE_GEMINI_MODEL`) and `GEMINI_MODELS_URL`.
- `src/services/firebaseApp.ts` - the single Firebase app shared by Auth and AI Logic.

If AI Logic has not been enabled, calls fail with a permission error; the service
rewrites that into a message pointing at the setup link above. If the model name has
been retired, calls fail with a 404; the service rewrites that into a message naming
the requested model and the supported-names docs page.
