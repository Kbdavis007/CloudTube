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

- No test runner for the app; verify with `npx tsc --noEmit` + `npx vite build`. Unit
  tests run with `npm test` (`tsx --test`), and browser end-to-end checks run with
  `npm run e2e` (Playwright; it reuses the system Chromium or
  `npx playwright install chromium`).
- `npm install` fails with ERESOLVE; use `npm install --legacy-peer-deps`. It writes a
  `package-lock.json` that is not gitignored even though the project tracks `bun.lock` — delete it
  before committing.
- After pushing, confirm the deploy landed via `curl -s https://ct.devmatrix.top/api/health`
  (returns the serving commit) and by grepping the served bundle for a new string.

## Video editor

- The **Video Editor** tab (`src/components/views/EditorView.tsx`) builds one MP4 from local
  clips: **Add clips** picks local video files, each clip gets **In**/**Out** trim handles
  (the in point stops before the out point), reorder with the arrow buttons or by dragging a
  card, **Preview** plays the timeline in order within each trim, and **Export MP4** writes the
  assembled file. It runs entirely in the browser (Mediabunny, loaded lazily) — no media is
  uploaded. Codecs are picked from what the browser can encode, preferring AVC/AAC for the MP4.
- **Add a clip** is a dropdown that lists the built-in samples first, then saved videos that
  have a direct media URL (`playback.previewUrl`), read into clips via `readClipFromUrl`. The
  samples are small clips under `public/samples/` (served by the Worker from the built asset
  bundle) so the editor can be tried without a local file; they are same-origin, so always
  readable. Only RedGifs clips qualify in the library today: their media URL is served with
  permissive CORS. A video with only an embed URL is not offered.
- **Embeds are not editable.** Videos played from a source embed (YouTube, xgroovy, most of the
  catalogue) live in a cross-origin iframe whose bytes the page cannot read, so they are not
  editor inputs — the editor says so rather than failing silently.

## Browsing videos

- Every list of videos — the saved **Videos** library, **Search & Collect** results, and the
  baked **catalogue** — offers the same search, filter, sort and pagination controls, so they
  behave the same wherever videos appear. The model lives in `src/services/videoFilter.ts`
  (`VideoFilterState`, `filterAndSortVideos`, `paginate`); the UI is `VideoFilterBar` +
  `VideoPagination` in `src/components/`. Change the behaviour there once, not per view.
- Free-text search matches every whitespace-separated term against title, channel, description
  and tags, so adding a term narrows. The catalogue passes an `extraSearchText` hook so its
  search also reaches `actors` and `category`, which `VideoMetadata` does not carry.
- List-specific bits stay in their view: the library keeps bulk actions, search results keep the
  personalized-ranking toggle (rendered into the bar's `headerExtra`), and the catalogue keys
  cards by canonical page URL because its store key (`sourceId:sourceVideoId`) can repeat.
- Source-flag badge colours live in one place, `src/data/sourceFlagColors.ts`
  (`SOURCE_FLAG_COLORS` / `sourceFlagColor`); it is exhaustive over `SourceFlag`, so a new flag is
  a compile error there rather than a silently unstyled badge.

## Searching

- **Settings → Search Sources** is the only place the enabled sources are chosen. Search reads the
  preference from `src/services/searchSources.ts` and re-reads it on change (`subscribeSearchSources`),
  but the page has no toggles of its own — the old "Also search:" chip row was removed so one
  selection is not edited in two places.
- A search result **plays in place**: `SearchResultCard` (`src/components/SearchResultCard.tsx`) holds
  its own `isPlaying` and swaps the thumbnail for the source's player (`inlinePlayerEmbedUrl` in
  `src/services/preview.ts` — the source embed, else the full YouTube player). Playback is per card,
  so several can play at once. Each card also offers **Full page**, which opens the dedicated player
  with the whole result list as the play queue. Playing never saves; only **Save** does.
- A source that fails is named in one non-blocking note; results from the working sources still show.

## Watching videos

- Opening a video **carries its list into the player** as a play queue: `SearchView` and
  `VegaSourceView` pass their (filtered, sorted) list to `App.handlePlayVideo(video, queue, label)`,
  which stores it in `playerQueue`/`queueLabel`. The player's prev/next walk that queue and the
  counter names it ("Video 2 of 24 in Search results"). Opening from the library (`handleSelectVideo`)
  clears the queue, so prev/next falls back to the library order. Change the queue by changing what
  a list passes to `onPlayVideo`, not the player.
- A video reached by prev/next may be unsaved, so `resolvePlayerSelection(videos, id, ephemeral, queue)`
  checks the library, then the transient video, then the queue. Watching — including a whole run of
  results — never saves; only the "Save to Library" button does.
- Under the player sits a **Related videos** section (`findRelatedVideos` in
  `src/services/relatedVideos.ts`): it scores candidates from metadata already carried — shared
  uploader/tag strongest, then same source and shared title words, similar length as a tie-breaker —
  draws its pool from the play queue plus the baked catalogue (`loadBakedCatalogVideos`, mapped once),
  and tops up with same-source videos so the section is rarely thin. It excludes the current video and
  its prev/next neighbours. Playing a related video does not save it.

## Pull requests and OpenSpec

- Every PR is described with `.github/pull_request_template.md`. Fill every section; the
  End-to-end proof section expects Playwright screenshots.
- **Screenshot URLs must keep working after the PR closes.** Drag images into the PR body
  (GitHub re-hosts them permanently) or link a committed file by full commit SHA. Never
  link by branch name — a branch URL 404s once the branch is deleted, even `main` moves.
- Behaviour changes are planned in `openspec/` before code is written: create a change
  for a new item (`openspec new change <name>`), and edit + re-sync the existing change
  for a bug fix or an edit to an existing feature. Validate with
  `openspec validate --all --strict`. Docs/config/tooling-only changes set
  `skip_specs: true` on the change.
- `npm run e2e` writes screenshots to gitignored `test-results/` and never dirties the
  tree. To refresh the committed proof under `docs/screenshots/`, run `npm run e2e:proof`.
