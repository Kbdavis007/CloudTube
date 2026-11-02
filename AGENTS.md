# AGENTS.md

## Delivery / autonomy

- **Default autonomy is L4.** When work is complete, **land it without asking** — do not stop at a
  "ready for you to land" hand-off.
- The owner is the **only user** of this app ("just me delving, not used by anyone else yet"), so
  shipping to `main` is expected. `main` **auto-deploys to production** (`https://ct.devmatrix.top`),
  so a push ships in ~1–2 minutes.
- **Always pull the latest first, then push:**
  1. `git fetch origin main`
  2. `git rebase origin/main` (the clone is shallow; rebases here have been clean)
  3. re-run verification (`npx tsc --noEmit` + `npx vite build`)
  4. `git push origin main`
- **Never force-push.** If a rebase conflicts in files you did not touch, resolve it or report it —
  do not clobber upstream work.
- **Every push is a release.** `main` auto-deploys, so no push may land without a `CHANGELOG.md`
  entry. After landing work, cut a release in the same session:
  1. `npm run release:patch -- --push` — the standing flow bumps the patch by one (0.2.3, 0.2.4,
     ...). `--push` pushes the release commit and the `vX.Y.Z` tag. The script refuses a dirty tree.
  2. Wait for the deploy, then record it so the entry flips from "pending" to a timestamp:
     `npm run deploy:log -- --env production --url https://ct.devmatrix.top --notes "<what shipped>"`
  3. `git add docs/DEPLOYMENTS.md CHANGELOG.md && git commit -m "chore(deploy): record <tag> ship" && git push origin main`
- **Never bump to `1.0.0` on your own.** `1.0.0` means "ready to go public" and is a manual,
  owner-approved bump. The owner announces it with **"lets make this public"**; only then, and
  after confirming the app is genuinely release-ready, run
  `node scripts/release.mjs major --public --push`. `release.mjs` refuses any version `>= 1.0.0`
  without `--public`.
- Copy-only and config changes are released the same way. See `docs/VERSIONING.md` for the full flow;
  `chore(release):` and `chore(deploy):` commits are excluded from the generated changelog body.

## Verification

- No test runner. Verify with `npx tsc --noEmit` + `npx vite build`.
- `npm install` fails with ERESOLVE; use `npm install --legacy-peer-deps`. It writes a
  `package-lock.json` that is not gitignored even though the project tracks `bun.lock` — delete it
  before committing.
- After pushing, confirm the deploy landed via `curl -s https://ct.devmatrix.top/api/health`
  (returns the serving commit) and by grepping the served bundle for a new string.
