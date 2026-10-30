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
- `.openhands/` is gitignored, so this file and project memory live in the repo tree but
  are not committed; `/workspace` keeps them across resets.

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
