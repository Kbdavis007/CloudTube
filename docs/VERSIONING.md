# Versioning & Release Process

CloudTube uses [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).
The version is derived from git tags, so a running build can always be traced
back to an exact commit.

## How the version flows

```
git tag (vX.Y.Z)  ──►  scripts/version.mjs  ──►  src/generated/version.ts
                                                     │
                       ┌─────────────────────────────┼─────────────────────────────┐
                       ▼                             ▼                             ▼
                  UI header badge            index.html <meta>          GET /api/health
                  Settings > Administration  (view-source / curl)       (deploy probes)
```

`src/generated/version.ts` is **auto-generated and not committed** (it is in
`.gitignore`) — never edit it by hand. It embeds the commit hash, which cannot be
known until after a commit exists, so committing it would always leave the hash
one revision stale. Instead it is regenerated from git on every `dev`, `build`,
`start`, and `lint` run (see the npm scripts).

Where the version appears:

- **Header badge** next to the brand — `vX.Y.Z`, amber when the tree is dirty.
- **Settings → Administration** — version label, commit hash, commit date, and branch.
- **`index.html`** — `<meta name="app-version">` and `<meta name="app-commit">`,
  so you can confirm a deployment with `curl -s https://your-app | grep app-version`.
- **`GET /api/health`** — returns `version`, `tag`, `commit`, `commitDate`,
  `branch`, and `dirty`.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run version:sync` | Regenerate `src/generated/version.ts` from git. |
| `npm run release:patch` | Bump patch, update `CHANGELOG.md`, commit, and tag. |
| `npm run release:minor` | Same, for a minor bump. |
| `npm run release:major` | Same, for a major bump. |
| `npm run deploy:log -- --env production --url <url> --notes "<text>"` | Append a row to `docs/DEPLOYMENTS.md` and mark the changelog entry deployed. |

Add `--push` to a release to push the commit and tag in one step:

```bash
npm run release:minor -- --push
```

Or cut an explicit version:

```bash
node scripts/release.mjs --version 1.2.3 --push
```

## What a release does

`scripts/release.mjs`:

1. Refuses to run on a dirty working tree (so the tag always matches a commit).
2. Computes the next version from the latest tag (or `--version`).
3. Bumps `package.json` and regenerates `src/generated/version.ts`.
4. Prepends a `CHANGELOG.md` entry, grouping commits by type
   (`feat`, `fix`, `perf`, `refactor`, `docs`, `chore`) with short hashes.
5. Commits `chore(release): vX.Y.Z` and creates an annotated tag `vX.Y.Z`.
6. With `--push`, pushes the branch and the tag.

## Recommended loop

**Every push is a release.** `main` auto-deploys, so no change reaches production
without a changelog entry. Land the work, then cut a release in the same session.

```bash
# 1. Land your work on main
git add -A && git commit -m "feat: something"

# 2. Cut a release (tags + changelog + version bump) and push it
npm run release:patch -- --push      # the standing flow: 0.2.3, 0.2.4, 0.2.5, ...

# 3. Record the deploy so CHANGELOG.md flips from "pending" to a timestamp
npm run deploy:log -- --env production --url https://ct.devmatrix.top --notes "shipped"
git add docs/DEPLOYMENTS.md CHANGELOG.md && git commit -m "chore(deploy): record ship" && git push origin main
```

### Version policy

- **Bump the patch by one on every release** — `0.2.3`, `0.2.4`, `0.2.5`, and so on.
  This is the standing flow while the app is private.
- **Do not reach `1.0.0` until the owner says so.** `1.0.0` means "ready to go
  public", and it is a manual, owner-approved bump. The owner signals it with the
  phrase **"lets make this public"**; only then does an agent run the major bump
  (and confirm the app really is release-ready first):

  ```bash
  node scripts/release.mjs major --public --push
  ```

  `release.mjs` **refuses** to cut any version `>= 1.0.0` without `--public`, so the
  line cannot be crossed by accident or by an agent guessing.

`chore(release):` and `chore(deploy):` commits are skipped when building the
changelog body — they describe the release itself, not the change it carries.

## CI sketch (optional)

Because the version file is generated (not committed), CI just needs to run the
generator before building, which `npm run build` already does. A post-deploy step
can record the ledger row with the CI-provided commit:

```yaml
- run: npm ci
- run: npm run build          # regenerates src/generated/version.ts from git
- run: npm run deploy:log -- --env production --url "$DEPLOY_URL" --notes "$GITHUB_SHA"
```

## Edge deployment (Cloudflare Worker)

Production runs as a **Worker** named `cloudtube` (Workers Builds, git-connected:
any push to `main` triggers a deploy). Pages Functions are **not** used — they do
not execute on a Worker project, which is why an earlier `functions/` attempt
never ran and `POST /api/cloudflare/proxy` kept returning 405.

`worker/index.ts` serves the SPA from the `ASSETS` binding and implements:

| Route | Purpose |
| --- | --- |
| `GET /api/health` | version / commit / branch provenance |
| `POST /api/cloudflare/proxy` | server-side relay to the Cloudflare API |
| `GET /api/xvideos/export` | streams the XVideos catalogue export |
| `GET /api/redgifs/search` | RedGifs search (CORS + temporary token) |
| `GET /api/search` | cached multi-source search (D1 + edge cache) |

`wrangler.jsonc` sets `run_worker_first: ["/api/*"]` so API calls reach the
Worker before the asset layer (otherwise the asset handler answers POST with 405).

### Cached search API (`GET /api/search`)

Open-source searches run through the Worker instead of the browser, so one
upstream fetch serves every repeat of a term. Two cache layers, cheapest first:

1. **Cloudflare edge cache** (`caches.default`) — holds the whole multi-source
   response per colo for 5 minutes. A repeat search is a cache hit with no D1
   read and no upstream call.
2. **D1 `video_search_cache`** — durable, one row per (source, query) with a
   per-source freshness window (RedGifs 30 min, Dailymotion 6 h, Archive 24 h,
   the rest 12 h). A search from another colo, or after the edge entry expires,
   still avoids the upstream call until the row goes stale.

Only key-free sources are cached here; the user's key-gated sources stay
browser-direct so the RapidAPI key is never uploaded. Eporner is key-free but
also stays browser-direct: it returns an HTML block page to Cloudflare's egress
IPs, so the Worker cannot fetch it. The client (`src/services/searchApi.ts`)
fills in every source the API did not return — key-gated and Eporner alike — by
searching them directly, and falls back to direct calls for all sources when
`/api/search` is unreachable, so search never breaks.

**Enabling the D1 layer** (optional — the edge cache and service worker work
without it):

```bash
export CLOUDFLARE_API_TOKEN=...   # Workers Scripts: Edit + D1: Edit
export CLOUDFLARE_ACCOUNT_ID=...
node scripts/setup-search-db.mjs   # creates the DB, binds it, applies the migration
```

The script writes the `d1_databases` binding into `wrangler.jsonc`; commit that
change so the auto-deploy keeps the binding. The Worker also creates the table
lazily on first search, so a fresh database needs no manual migration.

Build settings for Workers Builds:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Manual deploy (requires `CLOUDFLARE_API_TOKEN` with *Workers Scripts: Edit*):

```bash
npm run deploy          # build + wrangler deploy
npm run deploy:dry      # build + bundle only, no upload
```

The Worker runs `scripts/version.mjs` during the build; when the CI checkout has
no tags it fetches them once so the version label stays `vX.Y.Z` instead of a bare
commit hash.
