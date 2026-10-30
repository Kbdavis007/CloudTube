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
                  Sidebar footer              (view-source / curl)       (deploy probes)
```

`src/generated/version.ts` is **auto-generated and not committed** (it is in
`.gitignore`) — never edit it by hand. It embeds the commit hash, which cannot be
known until after a commit exists, so committing it would always leave the hash
one revision stale. Instead it is regenerated from git on every `dev`, `build`,
`start`, and `lint` run (see the npm scripts).

Where the version appears:

- **Header badge** next to the brand — `vX.Y.Z`, amber when the tree is dirty.
- **Sidebar footer** — version label, commit hash, commit date, and branch.
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

```bash
# 1. Land your work on main
git add -A && git commit -m "feat: something"

# 2. Cut a release (tags + changelog + version bump)
npm run release:patch -- --push

# 3. Deploy, then record it
npm run deploy:log -- --env production --url https://your-app.example --notes "shipped"
```

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

`wrangler.toml` sets `run_worker_first = ["/api/*"]` so API calls reach the
Worker before the asset layer (otherwise the asset handler answers POST with 405).

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
