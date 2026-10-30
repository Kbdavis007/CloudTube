# Project memory — CloudTube (Kbdavis007/CloudTube)

## What this is
- CloudTube: a YouTube-like app on Cloudflare (Vite + React + TS, Firebase auth, AI summary).
  Repo root: `/workspace/project`.
- Production is a Cloudflare **Worker** named "cloudtube" (NOT Pages): `wrangler.toml`
  (`main = worker/index.ts`, `[assets]` binding ASSETS -> ./dist, SPA fallback,
  `run_worker_first = ["/api/*"]`). Deploy/release scripts in `scripts/`.
- Package manager is **bun** (`bun.lock`); use `bun install --frozen-lockfile` then
  `bun run build` (= `vite build`). `npm install` FAILS here (ERESOLVE esbuild/vite peer
  conflict) even on unmodified main — do not use npm.
- CI: no GitHub Actions. The only check is a Cloudflare "Workers Builds: cloudtube"
  check-run; its log lives in the Cloudflare dashboard (token has no access).
- Repo has NO rulesets, NO branch protection, NO CODEOWNERS -> any push to main lands
  freely; a PR is optional.

## Sandbox persistence (IMPORTANT)
- `~` (and `/usr/local`, `/tmp`) live on the container overlay and are RESET whenever the
  sandbox is recycled (idle timeout / PID 1 restart). Only `/workspace` persists.
- `~/.copilot/lever.yml` (lever dials) is NOT persisted. Restore with
  `bash .openhands-setup/restore.sh`.
- `.openhands-setup/` IS committed so teammates and future sessions can read it; `.openhands/`
  (the live agent dir) is gitignored. This file lives in the repo tree, so `/workspace` keeps it
  across resets and `git` keeps it across clones.

## OpenHands runtime (Agent Canvas / local sandbox)
- Skills auto-load from `~/.agents/skills/`; plugins (skills + MCP) from `~/.agents/plugins/`
  and `~/.openhands/plugins/`. Lever plugin cache: `~/.openhands/cache/plugins/lever-*/`.
- Agent-server at `http://localhost:60000`. Settings/MCP/plugins APIs need header
  `X-Session-API-Key`, unavailable inside the sandbox -> install plugins/skills via filesystem.
- Agent Plugins format (openhands-sdk >=1.49.2): root `plugin.json` + `mcp.json` with
  `$schema` https://agent-plugins.org/schemas/1.0.0/{plugin,mcp}.schema.json.
- Remote OAuth MCP servers connect lazily, triggering browser OAuth on first tool use
  (tokens cached in `~/.fastmcp/oauth-mcp-client-cache/`). Not headless.

## Lever
- Dials file: `~/.copilot/lever.yml` (template: `.openhands-setup/lever.yml`).
- Current dials: autonomy default **L4**, spend **standard** (set 2026-10-30).

## Cloudflare
- Skills: `npx -y skills add cloudflare/skills --skill '*' --yes --global` -> 19 skills.
- MCP: `~/.agents/plugins/cloudflare/` (verbatim `plugin.json` + `mcp.json` from
  github.com/cloudflare/skills) -> server `cloudflare` = streamable-http
  `https://mcp.cloudflare.com/mcp` (OAuth; 401 without token).
- cf CLI (beta): `sudo npm install -g cf` -> `/usr/local/bin/cf`; `cf auth login`.
  Use the cf CLI unless the project has a Wrangler config.

## AI summaries (migrated 2026-10-30)
- Was `@google/genai` + `GEMINI_API_KEY` (key in client -> impossible for users to
  provide; no OAuth scope grants a Gemini key). Now uses **Firebase AI Logic**
  (`firebase/ai`: `getAI(app,{backend:new GoogleAIBackend()})` + `getGenerativeModel`),
  which keeps the Gemini key on Google's backend -> no key in the client at all.
- `src/services/firebaseApp.ts` = single shared app (Auth + AI share it).
  `src/services/geminiAi.ts` exports `GEMINI_AI_SETUP_URL` (deep link to
  `console.firebase.google.com/project/<id>/ailogic`), linked from Setup Wizard Step 5.
- Owner must enable AI Logic once in the Firebase console (choose Gemini Developer API =
  free tier; Vertex/Agent Platform needs billing). Enforces App Check; local dev needs a
  registered App Check debug token. See `docs/AI_SUMMARIES.md`.
- Env note: `npm install` fails (ERESOLVE esbuild/vite); I used
  `npm install --legacy-peer-deps` to typecheck, but `bun install --frozen-lockfile` is correct.
- App Check: AI Logic enforces it -> `initAppCheck()` in `src/services/firebaseApp.ts` uses
  `ReCaptchaEnterpriseProvider(recaptchaSiteKey)`; called at startup in `src/main.tsx` and
  again (idempotent) in `geminiAi.getModel`. Site key (public, in firebase-applet-config.json):
  6LcFKAcuAAAAAI3D12TPK6MHsW5Il-IOr655WM4r. Sets FIREBASE_APPCHECK_DEBUG_TOKEN=true only in
  Vite dev builds. Wizard Step 5 also links `APP_CHECK_SETUP_URL`.
- Setup wizard progress: `src/services/wizardProgress.ts` persists a `WizardProgress`
  record (completed flags, details, lastStep, aiConfigured) to localStorage key
  `cloudtube_wizard_progress`. Credentials stay in the AES-GCM vault. Steps are now
  6: auth/provision/encryption/health/**ai**/complete — step 5 is the AI setup step
  (was previously bundled into the final "complete" screen). `loadWizardProgress`
  returns null when nothing meaningful is stored, so a fresh visit never shows a
  false "resumed" banner. The wizard persists only after `hydrated` is set.
