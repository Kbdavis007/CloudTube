# CloudTube project memory

## Memory policy (user standing instruction, 2026-11-04)
- **Always write memory into the repository you are working in** — never rely on the
  user-tier / session memory (`~/.openhands/memory/`), which is not shared and is lost
  when the sandbox is recycled. Everything durable belongs in the repo.
- Canonical location: **`.openhands/memory/MEMORY.md`**, tracked in git. `.gitignore` uses
  `.openhands/*` + `!.openhands/memory/` so other agent state stays out of version control.
- **Keep repos separate**: CloudTube memory goes in CloudTube, YieldBot memory in YieldBot.
  The shared sandbox/Cloudflare notes are duplicated into both rather than cross-referenced.
- **Commit and push memory changes like any other change** (fetch `origin main` first).
  NOTE: CloudTube is **public** and auto-deploys from `main`; a memory-only commit is
  docs-only but still triggers the deploy pipeline.
- Never write secrets, tokens, or credentials into memory — reference them by name only.

## CloudTube project (github.com/Kbdavis007/CloudTube)

### Delivery / autonomy (user standing instruction, 2026-10-31)
- Default autonomy is **L4**: when work is done, **land it without asking** — no "ready for you
  to land" hand-off. The user is the only user of this app ("just me delving, not used by
  anyone else yet"), so shipping to `main` is expected and auto-deploys to production.
- **Always pull latest first, then push**: `git fetch origin main` + `git rebase origin/main`
  (clone is shallow; rebase has been clean), re-run `tsc`/`vite build`, then `git push origin main`.
  Never force-push. If rebase conflicts in files I did not touch, resolve or report — do not
  clobber upstream work.
- Copy-only / docs / config changes are still pushed the same way; `npm run release:*` tagging is
  only for real versioned releases (release.mjs refuses a dirty tree).

- No test runner. Verify with `npx tsc --noEmit` + `npx vite build`, plus ad-hoc scripts run
  through the repo's own `node_modules/.bin/tsx`.
- `npm install` fails with ERESOLVE (@tailwindcss/vite ^4.3.3 vs vite 8). Use
  `npm install --legacy-peer-deps`. It writes a `package-lock.json` that is NOT gitignored even
  though the project tracks `bun.lock` — delete it before committing.
- UI convention (as of 2026-10-30): Settings (`SettingsView`) is the single home for all admin
  surface — Cloudflare stats at the top, credentials, backups, and admin-only actions (Setup
  Wizard, Architecture & Code). Those admin pages are intentionally NOT sidebar nav items;
  sidebar only carries user-facing library views. Version provenance lives in the header badge
  and Settings > Administration (moved out of the sidebar footer).
- Cloudflare usage numbers must come from the GraphQL Analytics API, never be fabricated:
  `cfClient.fetchUsageSnapshot()` posts to `/graphql` through the same CF proxy and reads
  `workersInvocationsAdaptive` (datetime_geq/leq), `d1AnalyticsAdaptiveGroups` (date_geq/leq,
  rowsRead/rowsWritten), `kvOperationsAdaptiveGroups` (grouped by `actionType`, sum `requests`),
  `r2StorageAdaptiveGroups` (max payloadSize+metadataSize). These datasets need the token's
  `Account Analytics: Read` permission and fail independently, so return partial data + errors.
  Free-tier limits live in `CLOUDFLARE_FREE_TIER_LIMITS` in `src/services/cloudflareApi.ts`.
- The R2 datasets declare `filter` as a **required non-null arg**
  (`r2StorageAdaptiveGroups(filter: AccountR2StorageAdaptiveGroupsFilter_InputObject!, limit: uint64!)`).
  Omitting it fails the WHOLE multi-dataset request with
  `error parsing args for "r2StorageAdaptiveGroups": filter: not an object`, blanking every gauge,
  not just R2. Always pass `filter: { datetime_geq, datetime_leq }`; R2 storage rows are sampled
  daily, so use a >=48h window (the current day alone can be legitimately empty). The `date_geq`
  keys are NOT on this input object — use `datetime_geq`/`datetime_leq` (both are valid).
  Full account schema browsable at
  https://pages.johnspurlock.com/graphql-schema-docs/cloudflare.html (introspect the live schema
  with a real token for the authoritative answer).
- `r2StorageAdaptiveGroups` returns **one snapshot per bucket per sample time**, not a total.
  Never sum all rows (that multiplies storage by the sample count). Request
  `dimensions { bucketName datetime }` + `orderBy: [datetime_DESC]` and keep only the newest row
  per `bucketName` before summing `max.payloadSize + max.metadataSize`. Cloudflare bills R2 on
  GB-month (avg of daily peaks), so no instantaneous sample equals the billed amount.
- `src/services/cloudflareApi.ts` has **no imports and no browser globals**, so
  `node_modules/.bin/tsx` can import it directly; stub global `fetch` to return the proxy shape
  `{status, ok, data}` to test `fetchUsageSnapshot()` against real code with no mocks of the unit.
- Free-tier panel (`CloudflareStatsPanel`) shows 8 metrics from `CLOUDFLARE_FREE_TIER_LIMITS`:
  Workers req, D1 rows read/written, KV reads/writes/deletes/lists, R2 storage. KV meters each
  `actionType` separately (reads 100k/day; writes/deletes/lists 1k/day each), so never collapse
  them into one total. `CloudflareUsageMetric.note` renders a clarifying line under a bar (used
  for R2, whose gauge is current stored bytes while Cloudflare bills GB-month).
- `src/generated/version.ts` is gitignored and regenerated by `node scripts/version.mjs`;
  run it before tsc/build or the build fails on the missing module.
- Run the app: `PORT=12000 DISABLE_HMR=true npx tsx server.ts` (Express + Vite middleware).
  DISABLE_HMR=true matters during agent edits (file watching off, no flicker).
- IndexedDB logic is testable headlessly with `fake-indexeddb/auto` + repo tsx. The service is a
  module-level singleton, so one DB per process: open at v1 to seed, then let the app open at v2
  to exercise migrations.
- Convention: IndexedDB via `idbService` is the source of truth; React state mirrors it and is
  refreshed through App's `refreshLibraryData()` after each mutation. Multi-store writes that must
  not diverge share one transaction.
- Derived models (e.g. the taste profile) are computed on the fly, never persisted, so undo is instant.
- `bun` is not installable in this sandbox (no `unzip`, EACCES on /usr/local/lib). Use npm.
- Gemini model name lives in `src/services/geminiAi.ts` as `GEMINI_MODEL_NAME`, overridable
  with the `VITE_GEMINI_MODEL` build var. Default `gemini-3.8-flash` (Gemini 2.5 is now
  limited to projects that used it before the cutoff -> 404 "no longer available to new
  users"). Check current names at https://firebase.google.com/docs/ai-logic/models.
- Testing services that touch Vite-only globals (`import.meta.env`): a bare `tsx` harness
  crashes on `import.meta.env` being undefined. Bundle the harness with esbuild and
  `define: {'import.meta.env': JSON.stringify({...})}` while aliasing `firebase/*` to stubs —
  that exercises the real service code with no network. Guard new `import.meta.env` reads
  with `?.` so the module stays importable outside the bundler.
- The Firebase AI SDK defaults to a **180s request timeout**, and an abandoned request
  produces no error of its own — the promise just stays pending. Any AI button that spins
  "forever with no error" is this: pass `requestOptions.timeout` to `getGenerativeModel`
  (3rd arg). Current cap: 60s via `VITE_GEMINI_TIMEOUT_MS` in `src/services/geminiAi.ts`.
- App Check is enforced for AI Logic. A call whose attestation token is missing, or minted
  for a domain not registered on the reCAPTCHA Enterprise key AND the App Check provider,
  is refused. The app's runtime domain changes on every sandbox rebuild
  (e.g. work-1-<random>.prod-runtime.all-hands.dev), so an old registered domain will not
  cover it — check this first when AI works in code but not in the browser.
- **Production is `https://ct.devmatrix.top`** (Cloudflare Worker `cloudtube`, custom domain).
  It **auto-deploys from `main` on every push**, so `git push` ships to production in
  ~1-2 minutes. No manual `wrangler deploy` needed.
- Fastest way to confirm what is live: `curl -s https://ct.devmatrix.top/api/health` returns
  the serving commit (`server.ts` `/api/health` reads `src/generated/version.ts`). Do this
  before debugging a "still broken" report — it settles whether the fix is deployed at all.
- `docs/DEPLOYMENTS.md` is a hand-maintained ledger and lags reality now that deploys are
  automatic; trust `/api/health`, not the ledger's last row.
- `npx wrangler preview` (Worker Previews, Wrangler >= 4.135.0) **requires a `[previews]`
  block** in `wrangler.toml` and aborts before deploying without one. The block may be
  empty — `ensurePreviewsConfig` returns early when `config.previews !== undefined`.
  `assets`, `compatibility_date`/`_flags`, `placement` stay at top level and are NOT
  inherited from it. Wrangler runs `requireAuth` *before* the config check, so this error
  cannot be reproduced locally without live credentials; instead validate with
  `wrangler deploy --dry-run` (needs `node scripts/version.mjs` + a `dist/` dir first).
  Install wrangler into a scratch dir (`npm i wrangler` in /tmp) — global `npm i -g` hits
  EACCES on /usr/local/lib.
- Sandbox `*.prod-runtime.all-hands.dev` domains are ephemeral and differ from production.
  When AI works locally but fails in production, App Check domain allowlisting is the first
  suspect: `ct.devmatrix.top` must be on BOTH the reCAPTCHA Enterprise key and the App Check
  provider. Never register a sandbox domain and expect it to cover production.
- AI summaries are rendered by `src/components/MarkdownSummary.tsx`, a dependency-free
  markdown subset renderer (headings, ul/ol, bold/italic, inline+fenced code, quote, hr,
  links) styled as a Google-AI-overview card. It emits React nodes only — never
  `dangerouslySetInnerHTML` — so model output cannot inject markup. The prompt in
  `generateConciseSummary` is constrained to that subset, and `stripWrappingFence` unwraps a
  whole-response ``` fence the model sometimes adds. `UL_RE` also accepts a literal `•`
  because pre-prompt-change cached summaries used it.
- Gotcha when writing inline-markdown regexes: a shared module-level `/g` regex clobbers
  `lastIndex` when `renderInline` recurses for bold/italic, and the loop spins until the
  process OOMs (node dies with "Ineffective mark-compacts near heap limit"). Build a fresh
  `new RegExp(pattern, 'g')` per call instead.
- Renderer/UI can be verified headlessly with `react-dom/server`'s `renderToStaticMarkup` +
  repo tsx: assert on the HTML string (e.g. `<strong>`/`<code>` present, raw `**` absent,
  `&lt;img` escaped). For a real visual check, render to static HTML, link the built
  `dist/assets/*.css`, serve it, and open it in the browser.
- `npm install --legacy-peer-deps` writes `package-lock.json`, which is NOT gitignored even
  though the project tracks `bun.lock` — delete it before committing.
- The local clone is **shallow** (`git rev-parse --is-shallow-repository` -> true) and `main`
  moves without me: a push was rejected because origin had 3 newer commits. `git fetch origin
  main` + `git rebase origin/main` worked cleanly (no conflicts, none of my files touched),
  then re-run `tsc`/`vite build` and push. Feature commits go straight to `main`; tagged
  `npm run release:*` is only for real releases (release.mjs refuses a dirty tree).
- Confirm a deploy landed by checking BOTH: `curl -s https://ct.devmatrix.top/api/health`
  (commit hash) and grepping the served bundle for a new string
  (`grep -o 'assets/index-[^"]*\.js'` from the page HTML, then curl that file). The hash alone
  proves the commit shipped; the bundle grep proves the built assets include the change.
- **Multi-source search (2026-10-31).** `src/services/openSourcesApi.ts` is the single place that
  knows the open, key-free, CORS-`*` catalogues: archive.org (`advancedsearch.php` + `/embed/` +
  `/services/img/`), PeerTube via `sepiasearch.org/api/v1/search/videos` (carries `embedUrl` and
  page `url`), and Dailymotion (`api.dailymotion.com/videos` + `/embed/video/{id}`). Any source
  that returns a real embed URL works through the **existing sandboxed player with zero player
  changes** — set `playback.embedUrl` (in-app playback) and `playback.externalUrl` (the ONLY
  "Go to Source Site" target). `SearchView` treats a result as open-source iff `video.playback`
  is set; open-source cards get a "Play" action instead of "Collect Channel" (there is no YouTube
  channel), and a YouTube auth failure degrades to a note rather than blanking results that came
  from the open sources. New `SourceFlag`s (`ArchiveOrg`/`PeerTube`/`Dailymotion`) must be added
  to the union in `src/types/index.ts`, `SOURCE_FLAG_LABELS` in `src/data/sourceLabels.ts`, and
  BOTH `Record<SourceFlag,string>` colour maps (`SearchView.tsx`, `VideoPlayerView.tsx`) — `tsc`
  enforces the exhaustive maps, so a missing key is a compile error, not a silent gap.
- Copy-only refactors (infra jargon → plain user language) touch ~20 files with zero logic
  change. Boundaries that matter: `SetupWizardView` + `ScaffoldingExplorerView` +
  `HealthCheckPanel`/`services/healthCheck.ts` are genuine setup/dev tools and legitimately
  name Cloudflare/D1/R2/KV; `src/data/scaffoldingCode.ts` and `src/services/cloudflareApi.ts`
  internals stay technical. Everything else (views, chrome, toasts, `index.html`, manifest) is
  end-user surface and must be jargon-free. Entry-point labels into the tools are neutralized
  ("Setup Wizard", "View Code", "Open Dashboard"). `src/data/sourceLabels.ts` maps stable
  data-layer identifiers (`SourceFlag`, `CrawlJob['type']`) to display strings — add new
  labels there, never rename the stored values. `tsc`/`vite build` will NOT catch leftover
  copy, so audit with `grep` on both `src/**/*.tsx` and the built `dist/assets/index-*.js`
  (minified bundle strings survive verbatim), excluding the tool files above.

### Layout & playback UX (2026-10-31)
- The app shell is a fixed-height frame: outer div is `h-screen`, the layout row is
  `md:overflow-hidden md:min-h-0`, and `<main>` is the only scroll container. This is what
  makes the sidebar stay put on desktop. The sidebar itself is
  `md:sticky md:top-0 md:z-[1000] md:self-start md:max-h-screen md:overflow-y-auto`, so it also
  scrolls independently when the nav list outgrows the viewport. On mobile (`<md`) the wrapper
  keeps natural height and the page scrolls; the sidebar is a horizontal strip. All of this is
  `md:`-prefixed on purpose — do not drop the prefix or mobile breaks.
- Playback never leaves the app: play/pause/seek/forward all stay in the embedded `<iframe>`.
  The single external action is the **Go to Source Site** button in `VideoPlayerView`, shown
  only when the video has `playback.externalUrl` (set for the baked Vega catalogue, absent for
  YouTube — do not guess a URL), opened in a new tab with `rel="noopener noreferrer"`. Styled
  `#ff6600` → hover `#ffaa33`. See `docs/UX_BEHAVIOR.md`.
- Verifying sticky/scroll behavior without a test runner: render `Sidebar`/`VideoPlayerView`
  with `react-dom/server`'s `renderToStaticMarkup` and assert on the HTML string (Tailwind
  class names survive verbatim), then for real scroll proof serve the built `dist/` CSS with a
  tiny static HTML page mirroring the exact shell classes, set `main.scrollTop`, and compare the
  sidebar's `getBoundingClientRect().top` before/after in a browser. Gotcha: Tailwind only emits
  classes actually used in the app, so arbitrary values like `h-[1600px]` in a throwaway test
  page compile to nothing — use an inline `style="height:…"` to force scroll height instead.
- The Dashboard's "Recent Activity" panel (last crawl jobs) was removed on 2026-10-31 — the user
  does not act on that internal bookkeeping. Crawl jobs are still written to IndexedDB as history
  (`idbService.addCrawlJob` in `App.tsx`); only the dashboard read (`getCrawlJobs` into `jobs`
  state) was dropped. `jobTypeLabel`/`JOB_TYPE_LABELS` in `src/data/sourceLabels.ts` now have no
  callers, so if that panel ever returns, reuse them rather than re-adding labels. The
  "Open Channel Collector" card stayed (it was in the same column).
- The library browser (search + filters + sort over all library videos) lives in
  `src/components/views/VideoPlayerView.tsx` below the player grid, as its own
  "All Library Videos" panel. State is local (`libraryQuery`, `filterSource/Channel/Score/
  Rating/Duration`, `filterPublishedFrom/To`, `sortBy`); the visible list is derived in a
  `useMemo` over `allVideos`. Sort defaults to score-ascending (1 = best). Date filters
  compare against `publishedAt`; duration buckets are <5 / 5–20 / >20 min from
  `durationSeconds`.
- Driving React-controlled inputs from a headless/scripted browser: plain `browser_type`
  does NOT reach React's `onChange` for `<input type="date">` (segment-wise entry) — write the
  value with the prototype's native setter, then dispatch bubbling `input`+`change` events.
  Reusable harness: `npx esbuild scripts/<entry>.tsx --bundle --outfile=dist/x.js --loader:.tsx=tsx
  --jsx=automatic --define:process.env.NODE_ENV='"development"'`, serve `dist/` with
  `python3 -m http.server`, link the built `dist/assets/index-*.css`. Results read back via a
  `<pre>` appended to the DOM (a `<title>` change did not show up in `browser_get_state`).
  Delete all temp files (`scripts/tmp-*`, `dist/lib-*`, `dist/*-check*`) before committing.
- Embed navigation is locked down in `VideoPlayerView.tsx` with
  `sandbox="allow-scripts allow-same-origin allow-presentation"` on the iframe. The sandbox
  omits `allow-top-navigation`, `allow-popups` and `allow-popups-to-escape-sandbox`, so a tap
  on the embed cannot navigate the app away or open a tab — `Go to Source Site`
  (`currentVideo.playback?.externalUrl`) is the only exit. Do not add those tokens back.
  Verified by loading the same sandbox string in a test page whose child tries
  `window.top.location.href = ...` and `window.open(...)`: both are refused and the top page
  stays, while an un-sandboxed control iframe does navigate away. Results were read back from
  `localStorage` (a DOM `<pre>` and the page title were not visible to the browser tools).
- The Vega catalogue ships **baked into the build**: `src/data/vegaCatalog.json` is imported by
  `src/services/vegaApi.ts`, so Vite inlines it (`resolveJsonModule`). There is no download, no
  proxy route and no IndexedDB catalogue store (DB v4 dropped `xvideosCatalog`). `VegaSourceView`
  reads the module directly; `catalogToVideoMetadata` maps a record onto `VideoMetadata` with
  `youtubeId = "<sourceId>:<sourceVideoId>"`. The file may hold several sources — each record
  names its `sourceId` and the top-level `sources[]` maps ids to a name and `SourceFlag`.

## Free-video sources: what's wired up (Eporner v0.2.5; AdultEmbed + RedGifs + source picker v0.2.6, 2026-11-02)
Open-source picker lives in `src/services/openSourcesApi.ts` -> `OPEN_SOURCES`/`OpenSourceId`,
rendered by `SearchView.tsx`. An adapter returns `VideoMetadata` with its own `playback.embedUrl`;
`SearchView` treats `isOpenSource = !!video.playback`, so any source with an embed URL gets the
in-app Play button automatically. `SourceFlag` is defined in `src/types/index.ts`.
- **IMPORTANT: adding a SourceFlag is exhaustive across 3 UI color maps** — `SearchView.tsx`,
  `SelectedVideoPage.tsx` (was `VideoPlayerView.tsx`; upstream renamed it in v0.2.4, git's rename
  detection re-applies edits to the new path during rebase) and `VideosPage.tsx` (also upstream,
  v0.2.4), plus `SOURCE_FLAG_LABELS` in `src/data/sourceLabels.ts`. Miss one and `tsc` fails with
  "Property 'X' is missing ... Record<SourceFlag, string>".
- **Eporner — implemented, fully drop-in.** Official webmaster API v2, no key, no proxy needed:
  `GET https://www.eporner.com/api/v2/video/search/?query=&per_page=&page=&thumbsize=big&order=top-weekly&gay=0&lq=1&format=json`
  returns `access-control-allow-origin: *`; JSON `videos[]` has `id,title,keywords,views,rate,url,added,length_sec,embed,default_thumb`. `keywords` -> tags (no description field). Embed page
  `https://www.eporner.com/embed/<id>/` is framable (no XFO/frame-ancestors). `sourceVideoId`=id,
  `externalUrl`=url, `embedUrl`=embed.
- **AdultEmbed — SHIPPED (v0.2.6), open API, no key.** `GET https://adultembed.com/api/database/browse/?search=&limit=&page=`
  (`access-control-allow-origin: *`) -> `count,results[]` with `id,title,slug,description,thumbnail,duration_seconds,
  categories,tags,performers,studio,published_at`. Plain framable player: `https://adultembed.com/player/embed/<id>/`
  (CSP `frame-ancestors *`; a signed `?sig=&exp=&d=<domain>` variant is optional/expires 2h). No external page URL in
  the API — `externalUrl` points "Go to Source Site" at the plain player. `categories/tags/performers` are `{name}`
  objects (often empty); `duration_seconds` can be 0. Docs at `/api/docs`. Adapter `searchAdultEmbed` is direct-CORS.
- **RedGifs — SHIPPED (v0.2.6) but BLOCKED FROM THE WORKER.** `GET https://api.redgifs.com/v2/auth/temporary`
  returns a token (~24h), but `/v2/gifs/search?search_text=&order=top&type=g&count=` locks
  `access-control-allow-origin` to `https://www.redgifs.com`, so search goes through a same-origin route
  `/api/redgifs/search?q=&count=` (Worker `worker/index.ts` + Node `server.ts`), shared helper
  `src/services/redgifsApi.ts` (caches token, retries 429). Embed `https://www.redgifs.com/ifr/<id>` is framable
  (200, no XFO); watch page is not. **A plain `query=` returns empty — must use `search_text` + `order`/`type`.**
  **KNOWN ISSUE: RedGifs returns 429 to the Cloudflare Worker's shared egress IPs** (reproducible after a 4-min
  quiet period) while direct calls from the sandbox return 200. The route is correct; it is an IP-reputation block.
  Fix needs a non-Cloudflare-egress path (e.g. a small external proxy), not a code change. Worker route also has a
  5-min `caches.default` edge cache to cut call rate.
- **Source selection (v0.2.6).** `src/services/searchSources.ts` persists the enabled `OpenSourceId[]` to
  `localStorage['cloudtube.search_sources']` (default = all) and broadcasts a `cloudtube:search-sources-changed`
  event. Settings panel `src/components/SearchSourcesPanel.tsx` (rendered in `SettingsView.tsx`) has the checkboxes;
  `SearchView.tsx` seeds from `readEnabledOpenSources()` and subscribes, and `toggleOpenSource` now also persists.
  Search only queries the enabled set (`searchAllOpenSources` over the selection).
- **Pornhub via RapidAPI — SHIPPED (v0.2.8).** User subscribes to a RapidAPI Pornhub API and
  enters the `x-rapidapi-key` in Settings → Search Sources. **Subscription host matters: the
  user's key is bound to `pornhub2.p.rapidapi.com`** (`/v2/search?query=&page=` -> `{status,data:{videos:[]}}`
  with `duration`("29:53"), `views`, `video_id`, `rating`, `ratings`, `title`, `url`, `default_thumb`,
  `publish_date`("YYYY-MM-DD HH:MM:SS"), `tags[{tag_name}]`, `pornstars[{pornstar_name}]`,
  `categories[{category}]`, `segment`). Other hosts (`pornhub.p.`, `pornhub-api1.p.`) 403 "not
  subscribed". **No proxy needed** — RapidAPI's OPTIONS preflight explicitly allows
  `x-rapidapi-key` and reflects the Origin, so the browser calls it directly (matches the
  Cloudflare-credential pattern). Embed `https://www.pornhub.com/embed/<video_id>` is framable
  (200, no XFO/frame-ancestors). Key stored in `localStorage['cloudtube.rapidapi_key']`
  (`src/services/rapidApiKey.ts`, same read/save/subscribe shape as searchSources). Free plan
  caps ~100 req/15min per key + a hard monthly limit (read `x-ratelimit-*` headers).
  Adapter `searchPornhub` in `openSourcesApi.ts`; throws a clear message when the key is missing.
- **xHamster + RedTube via multi-site RapidAPI — SHIPPED (v0.2.9).** Second host
  `xhamster-pornhub-youporn-xnxx-redtube-api.p.rapidapi.com`, same key as above. Search:
  `GET /api/search?q=<q>&site=<site>` -> `{ok,requete,site,resultats:[{duree,lien,titre,uploader,vignette,vues}]}`.
  Valid `site` values (from its own error msg): **xhamster, pornhub, youporn, xnxxvideos, redtube**.
  `page` param is IGNORED (page 1==2==3). `duree` is "MM:SS" or "2min" (parse both). No publish
  date. `GET /api/video` 404s; `POST /api/video {"link":url}` returns IP-locked HLS/MP4 (`formats.hls`
  /`formats.mp4`) — **streams are IP-locked to the caller** so they are useless via a proxy/Worker;
  use the site's own embed instead. **Only xhamster and redtube are wired — they are the only
  framable sites** (embed `https://xhamster.com/embed/<id>` and `https://embed.redtube.com/?id=<id>`,
  both 200, no XFO). youporn embed 302s to `/`; xnxxvideos sends `X-Frame-Options: SAMEORIGIN`
  (it's an XVideos mirror) — both dead. Pornhub already has its own source. **Embed id = last path
  segment of `lien`** (xhamster `/videos/<slug>` e.g. `jo-15-13447036` or `omg-...-xhsFXCb`; redtube
  `/<numericid>`); the full xhamster slug works as the embed id (only the id also works). Adapters
  `searchMultiSite` in `openSourcesApi.ts` (one function, `site` doubles as the source id).
- **Key-gated sources are opt-in.** `OpenSourceDefinition.requiresKey` (Pornhub, xHamster, RedTube
  set it) drives `defaultOpenSourceIds()` in `searchSources.ts` — the default enabled set EXCLUDES
  key-gated sources, so a fresh install never shows an "add your key" error. `allOpenSourceIds()`
  (Enable All) still includes them. Panel marks them with a "key" badge; one RapidAPI key field
  covers all three (`requireRapidApiKey()` in `openSourcesApi.ts`).
- **Dead ends (no public JSON API / blocked):** Pornhub (`api.pornhub.com` 404s), xhamster (`/api/v1/search` 404),
  youporn (302 -> `/`), spankbang (403), tube8/beeg/porntrex/pornhd/tnaflix/hqporner (HTML or 403/404). Hubtraffic
  (MindGeek webmaster feed) exists but needs a key and is Pornhub/RedTube only.

## Watching vs saving, and hover previews (issue #11, 2026-11-05)
- **Watching must not save.** `handleIndexVideo` in `src/App.tsx` is the ONLY writer that adds a
  video to the library (it calls `idbService.saveVideo`). Play paths must never call it. The bug was
  `SearchView.playVideo` calling `onIndexVideo(video)` for open-source results, plus
  `handleIndexAndPlay` (index-then-play) used by Vega.
- **Transient playback:** `ephemeralVideo` state in `App.tsx` holds a video that is being watched but
  is not in the library. `resolvePlayerSelection(videos, selectedVideoId, ephemeral)` in
  `src/services/playerSelection.ts` returns `{video, isInLibrary}`. `SelectedVideoPage` shows
  **Save to Library** when `!isInLibrary` and hides the removal button (removal is library-only).
  Clear `ephemeralVideo` in `navigate('player')`, `handleSelectVideo`, `handleBackToVideos`,
  removal and restore.
- **`VideosPage`/`SelectedVideoPage` props are load-bearing:** adding a required prop to
  `SelectedVideoPage` means updating `VideosPage`, which means updating the `App.tsx` call site.
  Tests render `VideosPage` directly (SSR via `renderToStaticMarkup`) to cover that wiring.
- **Hover previews:** rules live in `src/services/preview.ts` — `withAutoplay(embedUrl)`,
  `youtubeEmbedUrl(id)`, `hoverPreviewEmbedUrl(video)` (source embed → external page → YouTube
  embed derived from `youtubeId`, since YouTube results have no `playback`). `SearchView`,
  `VegaSourceView` and `VideosPage` library cards all render `HoverPreview`. Put the clickable
  overlay button as a **child** of `HoverPreview`, never wrapping it — otherwise `mouseenter` never
  fires on the wrapper (the iframe covers it) and the preview silently never starts.
- **Tests:** `npx tsx --test tests/x.test.tsx` runs a single file. SSR rendering of React
  components works with no DOM/jsdom. `npm test` = `tsx --test tests/**/*.test.ts(x)`.
- **`package-lock.json` reappears** after `npm install --legacy-peer-deps`; delete before committing
  (project tracks `bun.lock`).

## Legal pages: /privacy and /tos (v0.2.x, 2026-11-05)
- **Why:** Google OAuth consent screen (branding) requires a privacy policy + TOS on a domain
  you own, as a **dedicated HTML page**, **linked on the app homepage**, with a **Limited Use
  disclosure**. Ref: https://support.google.com/cloud/answer/13806988
- **Files:** `public/privacy.html`, `public/tos.html`, `public/legal.css` — standalone HTML with
  **no JS and no sign-in**, because the React app is gated behind Google sign-in and a reviewer
  cannot see it otherwise. Copied to `dist/` by the Vite build.
- **Friendly URLs:** the Worker's SPA fallback used to answer `/privacy` and `/tos` with the app
  shell (**200**), so a status-code-only check falsely implies the pages exist. Cloudflare's
  `assets.html_handling` default `auto-trailing-slash` maps `/privacy` -> `/privacy.html`
  (`/privacy.html` 307s back to `/privacy`); pinned explicitly in `wrangler.jsonc`.
- **Dev parity:** `server.ts` serves them from `public/` *before* `vite.middlewares` (dev only),
  using the shared allowlist `resolveLegalPage()` in `worker/legalPages.ts`. Explicit map, not
  filesystem-derived.
- **Policy content is grounded in code:** it names the actual scopes, states the library lives in
  IndexedDB/localStorage and the OAuth token is memory-only, and **discloses the one server-side
  store** — the Cloudflare D1 `video_search_cache` (public video metadata, keyed by source+query,
  shared by all users, TTL hours). Do not claim "no server storage" without checking the code.
- Operator identity in the policy: Brian Keith Davis / `kbdavis0007@gmail.com` (git author).

## Repo workflow: PR template, OpenSpec, Playwright (issue #9, v0.2.x 2026-11-05)
- **`.github/pull_request_template.md`** is plain markdown — GitHub supports YAML
  frontmatter on *issue* templates only, never on PR templates. Its section headings are
  the contract (Summary, Type of change, OpenSpec, Lever, Harness impact, Verification,
  End-to-end proof (Playwright), Risk and rollback, Checklist).
- **OpenSpec is the planning gate** (`openspec/`, standalone CLI
  `curl -fsSL https://openspec.dev/cli/install.sh | sh`): new items get a change first
  (`openspec new change <name>`), bug fixes / edits edit + re-sync the existing change.
  `openspec validate --all --strict` passes a zero-delta change only when the change's
  `.openspec.yaml` sets **`skip_specs: true`** (docs/tooling changes). Use
  `openspec init --tools none` — `--tools agents` dumps 95KB of skills into `.agents/`.
- **Playwright e2e** (`npm run e2e`, `tests/e2e/`, `playwright.config.ts`): `@playwright/test`
  ships **no postinstall**, so `bun install --frozen-lockfile` still reports "no changes"
  (CF build stays green). No browser download needed here — the sandbox has
  `/usr/bin/chromium`; the config falls back env -> `/usr/bin/chromium` -> managed browser.
  Proof pattern: POST the template to `api.github.com/markdown` (gfm) and screenshot the
  rendered HTML into `docs/screenshots/`.
- **Harness kit** tracked in `.harness/source.json` (`kit_url`, `kit_commit`, `updated_at`,
  `update_command`).

## Sandbox persistence (IMPORTANT)
- `~` (and `/usr/local`, `/tmp`) live on the container overlay and are RESET whenever the
  sandbox is recycled (e.g. after idle timeout, PID 1 restarts). Only `/workspace` persists.
- Durable setup backup + idempotent restore live at `/workspace/.openhands-setup/`.
  After a reset run: `bash /workspace/.openhands-setup/restore-cloudflare.sh`

## OpenHands runtime (Agent Canvas / local sandbox)
- Skills auto-load from `~/.agents/skills/` (symlinked into `~/.openhands/skills/`).
- Plugins (skills + MCP) auto-load per conversation from `~/.agents/plugins/` and
  `~/.openhands/plugins/` (project: `.agents/plugins`, `.openhands/plugins`).
- Agent-server at `http://localhost:60000`. Settings/MCP/plugins APIs require header
  `X-Session-API-Key`, unavailable inside the sandbox -> use filesystem plugin/skill install.
- Agent Plugins format (openhands-sdk >=1.49.2): root `plugin.json` + `mcp.json` with
  `$schema` https://agent-plugins.org/schemas/1.0.0/{plugin,mcp}.schema.json. Vendored
  schemas ship in the PyInstaller bundle under `/tmp/_MEI*/openhands/sdk/plugin/format/schemas/`.
- Remote OAuth MCP servers connect lazily, triggering browser OAuth on first tool use
  (tokens cached in `~/.fastmcp/oauth-mcp-client-cache/`). Not headless.
- 6 MCP servers are pre-configured per conversation (`agent.mcp_config` in the conversation's
  `base_state.json`): `default` (remote SHTTP), `browser_mcp`, `playwright`, `fetch`, `memory`,
  `sequential_thinking`. No per-project MCP file. Adding/changing servers only affects NEW
  conversations. `browser_mcp_browser` bridges to the *user's own* Chrome via the Browser MCP
  extension — it does NOT drive the sandbox browser, and fails "No browser is connected" when no
  extension is paired.
- **No display / no VNC by default** (`OH_ENABLE_VNC=0`); pre-installed browsers are headless only.
  For a *viewable* browser: `sudo apt-get install -y --no-install-recommends xvfb x11vnc novnc
  websockify fluxbox` then `bash /home/openhands/vnc-browser.sh [url]` -> viewer at
  https://work-2-<host>/vnc.html (port 12001). Details in `2026-11-06.md`. Overlay-only, lost on reset.
- Chromium 155 CDP rejects a bare origin: launch with `--remote-allow-origins=*` or connect with
  `suppress_origin=True`, else `Page.captureScreenshot` returns 403.

## Cloudflare setup
- Skills: `npx -y skills add cloudflare/skills --skill '*' --yes --global` -> 19 skills.
- MCP: `~/.agents/plugins/cloudflare/` (verbatim `plugin.json` + `mcp.json` from
  github.com/cloudflare/skills) -> server `cloudflare` = streamable-http
  `https://mcp.cloudflare.com/mcp` (OAuth; 401 without token).
- cf CLI (beta): `sudo npm install -g cf` -> `/usr/local/bin/cf` (v0.15.0). Auth via
  `cf auth login` (OAuth device flow at https://dash.cloudflare.com/oauth2/device/verify).
  **Not completable from inside the sandbox:** the verify page serves a Turnstile
  "Verify you are human" challenge that never resolves headless -> the owner must enter the
  device code in their own browser. `cf auth login --no-browser --device` prints the code.
- Instruction line: `When interacting with Cloudflare, use the cf CLI unless the project has a
  Wrangler config file.` lives in `~/.openhands/AGENTS.md` (mirrored to `~/.agents/AGENTS.md`).
- **After any sandbox reset** (all of the above live on the ephemeral overlay) run:
  `bash .openhands-setup/cloudflare/restore.sh` (from the repo root; templates in
  `.openhands-setup/cloudflare/`, documented in `.openhands-setup/README.md`). It restores
  skills, the MCP plugin and the AGENTS.md line, and installs `cf` — but NOT auth.

## CloudTube daily Vega refresh (2026-11-05)
- `.github/workflows/refresh-vega-catalogue.yml` scrapes (Firecrawl CLI, server-side fetch so the
  runner IP is irrelevant), rebuilds, bakes into `src/data/vegaCatalog.json`, then **cuts a
  release** (`release.mjs patch --push`) — AGENTS.md requires every push to be a release, so it
  must not push a bare data commit. Needs `fetch-depth: 0`.
- Its required repo secret `FIRECRAWL_API_KEY` is **not set and the agent cannot set it**: both
  `GITHUB_TOKEN` and `Github_Super_Token` get 403 on `/actions/secrets/public-key`. Owner must add
  it under Settings -> Secrets and variables -> Actions. Without it the run skips the scrape and
  stays green (a `::notice::` explains). `CF_DEPLOY_HOOK` is optional.
- If a push ever fails with `remote: fatal error in commit_refs` + `! [remote rejected] (failure)`
  while reads work, it is a transient GitHub write outage — wait a few minutes and retry.

## Firecrawl quota + CI release gotchas (2026-11-06)
- **Firecrawl free plan = 10 requests/minute.** Batch scrapes must be paced or the
  11th+ request fails `Rate limit exceeded` (the free tier rejects, it does not
  queue). `scrapers/vega/scrape.sh` paces with a sliding window and shows the CLI's
  stderr. There is no `--timeout`/`--retry` flag on `firecrawl scrape`.
- **`actions/checkout` does not fetch tags by default.** A workflow that runs
  `scripts/release.mjs` (uses `git describe` + tag list) must set `fetch-tags: true`
  and re-fetch tags before releasing, or it picks a version a concurrent session
  already tagged and the tag push is rejected. Push commit+tag with
  `git push --atomic` so a collision cannot leave an untagged release commit on main.

## Vega scraper: curl-first, Firecrawl fallback (2026-11-06)
- **GitHub Actions runner IP is NOT blocked by xvideos** (the CF Worker IP is —
  that's why Firecrawl was bought). So `scrape.sh` fetches the listing directly
  with curl + a browser UA, and only falls back to the Firecrawl CLI if curl
  returns blocked/no result cards. curl path: 15 pages in ~11s, no key, no limit.
- Parser reads raw HTML (BeautifulSoup) *or* Firecrawl markdown, so both backends
  feed the same records. Raw HTML has everything Firecrawl's markdown did.
- Raw HTML uses a literal `THUMBNUM` placeholder in thumbnails and the
  `/video.<id>/THUMBNUM/<slug>` watch path; use `data-sfwthumb` (resolved) or swap
  `THUMBNUM->1`. `pageUrl` drops the frame segment entirely (canonical).
- **Catalogue is append + dedupe by canonical `pageUrl`, not by id** — the same
  video can be listed under different ids. Older entries carry forward.
- Raw page dumps (`scrapers/vega/data/vega_pages/`) are git-ignored (HTML is ~4x
  the JSON and regenerated every run); only the built catalogue is committed.

## Vortex = xgroovy, second baked source (v0.2.34, 2026-11-06)
- **xgroovy is wired as a second source** alongside Vega. Alias/UI name **Vortex**,
  `SourceFlag` **`XGroovy`** (real host only in the stored embed/page URLs, never
  rendered). Files: `xg_parse.py` (listing parser), `xg_dates.py` (date resolver),
  `xgroovy_urls.txt`; `scrape.sh` now takes `[OUTPUT_DIR] [URLS_FILE]`;
  `vega_build_manifest.py` is source-aware (`--source`, `SOURCES` has both ids,
  `to_catalog_video(..., source_id)`).
- **Listing**: `https://xgroovy.com/search/riding-pov/<page>/?sort=new` (omit
  `<page>` for page 1), 50/page, ~20 pages. `sort=new` IS newest-first. **No dates
  in the listing and no period filter** (period/added params ignored). Cards:
  `div.item[data-video-id]` → `a[href]`, `strong.title`, `span.item-quality`,
  `div.duration` ("11 min"), `div.views` ("922 views"), optional
  `div.author-link a`. ~40/50 cards have **no author** (user uploads) — that is
  normal, not a parse miss. The `/ajax/*` and `?mode=async` endpoints return
  **empty**; there is no JSON API.
- **Exact date is only on the video page**: JSON-LD `"uploadDate": "…+00:00"`
  (note: `"uploadDate": "…"` with a space after the colon). `xg_dates.py` reads
  each video page, writes `{id: isoDate}`, skips ids already dated in `--known`
  (the committed catalogue), so a daily run fetches only new ids.
- **xgroovy rate-limits bursts**: concurrency 8 → HTTP 429 (nginx); concurrency
  2–4 with a small delay is fine. `xg_dates.py` defaults to concurrency 2 +
  0.1s delay + 429 retry with backoff; 197 ids took ~45s, 0 failures.
- **Embed**: `https://xgroovy.com/embed/<id>` → 200, **no X-Frame-Options**
  (framable; kt_player). `/videos/<id>/embed` redirects to the detail page and
  HAS `X-Frame-Options: SAMEORIGIN` — use `/embed/<id>`.
- **Pipeline is now two passes** (both append into the one catalogue):
  `scrape.sh` vega → `scrape.sh` xgroovy → `xg_dates.py` → `build --source vega`
  → `build --source xgroovy --dates …` → bake `src/data/vegaCatalog.json`.
  Result: **548 videos = 351 Vega + 197 Vortex**, deduped by canonical pageUrl.
- **`vega_to_cloudtube.py` has `FLAG_BY_SOURCE`** (id→SourceFlag) that also needs
  a per-source entry; `userTags` derives from it.
- Vortex's 4-page window spans ~2 weeks (~50–57 videos/week), so a 7-day window
  has margin; `xg_dates.py` skips already-dated ids so re-runs are cheap.

## Source discovery survey (v0.2.37, 2026-11-06)
- Findings live in `docs/SOURCE_DISCOVERY.md`. Method: probe a search URL, confirm
  results change for a second query, open a detail page, extract the real embed,
  check `X-Frame-Options`/CSP `frame-ancestors` + a player marker.
- **Web-search notes:** Tavily quota exhausted; DDG/Mojeek block scraping; **Bing
  via curl works** (`bing.com/search?q=`, parse `<cite>`) but censors adult
  queries. `theporndude.com/` is a good tube-domain source.
- **11 framable, query-filtering candidates:** justporn.com (only one with exact
  dates in the listing), hornyfap.tv, xxbrits.com, yesporn.vip, notfans.com,
  pornlib.com, drtuber.com, porngo.com, youjizz.com (`/videos/embed/{id}`),
  anysex.com, alotporn.com (thin for multi-word queries). 3movs.com is framable
  but ignores the query. KVS family (hclips/txxx/upornia/voyeurhit) search works
  but `/embed/{id}/` returned no player (path unknown).
- **Rule reinforced:** framable-from-sandbox is NOT sufficient — must re-check
  from the Cloudflare Worker egress (xvideos-proxy / RedGifs lesson).

## Eleven more sources wired (v0.2.39, 2026-11-06)
- The 11 screened candidates from the survey are now baked sources. Aliases/flags:
  justporn=Quasar/JustPorn, hornyfap=Nebula/HornyFap, yesporn=Zenith/YesPorn,
  xxbrits=Pulsar/XXBrits, notfans=Onyx/NotFans, pornlib=Atlas/PornLib,
  drtuber=Halo/DrTuber, porngo=Prism/PornGo, youjizz=Orbit/YouJizz,
  anysex=Lumen/AnySex, alotporn=Cinder/AlotPorn. Catalogue 579 -> **1221 videos /
  13 sources**. Real host only in stored `embedUrl`/`pageUrl`; UI shows the alias.
- **Parsers** in `scrapers/vega/engine_parse.py`: one card parser per engine family
  (`_kt_kvs` justporn/yesporn/alotporn, `_kvs_alt` hornyfap/notfans/youjizz,
  `_xxbrits`, `_pornlib`, `_drtuber`, `_porngo`, `_anysex`), `ENGINES` selector
  map, `HOST_BY_SOURCE`, and **`RESULTS_SELECTOR`** which scopes parsing to the
  results grid (`#list_videos_videos_list_search_result_items` on KVS sites,
  `#search_results` drtuber, `div.thumbs.result` pornlib) — without it sidebar /
  "related" cards get mixed in (justporn 31->27, drtuber 66->66, pornlib 36->36).
- **Dates**: `engine_dates.py` reads the detail page (`uploadDate`/`datePublished`/
  "Published on DD.MM.YYYY"/ISO/relative ago). 9/11 sources yield dates; **drtuber
  and porngo expose none anywhere** — their entries fall back to the first-seen
  date, which `vega_build_manifest.py` carries forward from the committed
  catalogue (keyed by canonical pageUrl), so it is stable across runs.
- **Pagination differs per site**: KVS family uses **`&from_videos=N`** (NOT
  `?page=N`, which is ignored); pornlib/porngo use a trailing path segment
  `/2/`; youjizz uses `?page=N`; drtuber is AJAX-only (single page, 66 results);
  xxbrits ignores paging params (single page). justporn `?sort_by=post_date` is a
  no-op (already newest-ish); porngo/anysex/hornyfap/notfans/yesporn honour
  `sort_by=post_date`.
- **`scrape.sh` gate** (`looks_like_results`) must recognise each engine's card
  marker or the run aborts: `div id="video_"`, `data-video-id`, `data-video_id`,
  `data-videoid`, `data-fav-video-id`, `ch-video` (drtuber's `a.th.ch-video`),
  `thumb__top` (porngo).
- **porngo embed quirk**: `https://porngo.com/embed/<id>` 301s to `http://www...`
  (mixed content). Store the **`https://www.porngo.com/embed/<id>`** form — 200,
  no XFO, no redirect. All 11 embeds verified 200 + framable from the sandbox.
- **`vega_to_cloudtube.py` `FLAG_BY_SOURCE`** and the three `Record<SourceFlag,
  string>` colour maps (VideosPage/SelectedVideoPage/SearchView) must each get the
  new flags or `tsc` fails. Panel count now sums every catalogue flag
  (`CATALOG_SOURCES`), not just Vega+XGroovy.
- Workflow scrapes every source with `|| echo "::warning::…"` so one dead site
  cannot block the daily refresh (its videos carry forward). Pages/dates caches
  git-ignored via `scrapers/vega/data/*_pages/` + `*_dates.json`.
- **`npm run release:patch -- --push` prompts for a GitHub username** (no creds in
  the sandbox); the commit+tag are still created locally. Push with
  `git push --atomic "https://${GITHUB_TOKEN}@github.com/Kbdavis007/CloudTube.git"
  main vX.Y.Z` (or plain `main` for the deploy-record commit). Verify with
  `curl -s https://ct.devmatrix.top/api/health` (version flips in ~1 min).
## Video editor: research + spec (add-video-editor, 2026-11-06)
- **The editor must be client-side.** CT deploys as a Cloudflare Worker serving static
  assets (`wrangler.jsonc` + `worker/index.ts`); there is no transcode backend, and the
  media it plays is mostly **cross-origin iframes** (YouTube/xgroovy/RedGifs) whose bytes
  cannot be read in the browser. Editable inputs = a **local file** or a **direct media
  URL** (Vega/Vortex catalogue already has `previewUrl` mp4s).
- **Engine choice: Mediabunny** (`Vanilagy/mediabunny`, **MPL-2.0**, pure TS, tree-shakable,
  no ffmpeg, **no COOP/COEP**). Rejected: **ffmpeg.wasm** (mt build needs
  COOP/COEP → would break the third-party iframe embeds; wrapper MIT but core LGPL/GPL;
  2GB wasm cap), **WebAV** (MIT, WebCodecs, ~50KB, fine but lower-level), **Etro** (GPL-3.0
  copyleft), **Remotion** + **OpenVideo/react-video-editor** (tiered "free for individuals,
  paid above a company-size threshold" — NOT OSI-open; OpenVideo is Next.js/PixiJS).
- **Spec landed as `openspec/changes/add-video-editor/`** (2 capabilities: `video-editor`,
  `video-export`; 4 phases: 1 trim+combine local files, 2 export options/progress/cancel,
  3 direct-URL clips + recent exports (IndexedDB `videoExports`, v4→v5), 4 optional
  ffmpeg.wasm fallback). Validated with `openspec validate add-video-editor --strict`.
- **openspec CLI** reinstall: `curl -fsSL https://openspec.dev/cli/install.sh -o /tmp/x.sh`
  then `sh /tmp/x.sh` (SHA256-verified) → `~/.local/bin/openspec`; schema templates are
  unpacked at `~/.local/share/openspec/binary-schemas/*/spec-driven/templates/`.
- **Spec format that passes `--strict`:** `### Requirement:` (desc ≤500 chars) + at least
  one `#### Scenario:` (exactly 4 `#`) with a WHEN/GIVEN and a THEN step; new capabilities
  start with a `## Purpose` of 50+ chars. Validated clean.

## Video editor Phase 1 shipped (v0.2.44, 2026-11-07)
- **Phase 1 of `add-video-editor` is implemented and landed.** Files: `src/services/videoEditor.ts`
  (Mediabunny wrapper), `src/components/views/EditorView.tsx`, `src/components/editor/{ClipCard,TimelinePreview}.tsx`.
  Editor is a **lazy chunk** (`React.lazy`) in `App.tsx` so Mediabunny (~557KB) stays out of the
  initial bundle. Tab `editor` added to `PageTab`, nav array in `Sidebar.tsx` (`Scissors` icon),
  and `PERSISTED_TABS` in `viewState.ts`.
- **Export = encode path, not stream-copy.** Stream-copy (`Conversion`) snaps trims to keyframes and
  breaks the muxer on re-stamped negative timestamps. Encode path uses `VideoSampleSink.samples(start,end)`
  + `VideoSampleSource`/`AudioSampleSource` into `Mp4OutputFormat` → `BufferTarget`, re-stamping each
  sample to `offset + (t - segStart)`. Output duration == sum of trimmed spans (verified: 1s+2s→3.03s).
- **Codec preference for MP4: AVC then AAC, then the clip's own codec, then vp9/vp8/av1, opus/vorbis.**
  Chromium has **no AAC encoder** (`canEncodeAudio('aac')`=false) so audio falls back to opus-in-MP4
  (valid); video picks AVC. `canEncodeVideo(codec,{width,height})` needs even dims — geometry is rounded
  to even. Audio-less export is allowed (audio codec `null` → video only).
- **Node has no WebCodecs** → unit tests (`tests/videoEditor.test.ts`, `tests/editorView.test.tsx`)
  cover pure logic (trim clamp, timeline duration, formatTime), decoder-free metadata (`readClip` via
  `Input.canRead()`/`computeDuration`), and error mapping. The real encode/export is proven by
  Playwright (`tests/e2e/editor.spec.ts`) against a harness page `tests/harness/editor.html` that mounts
  EditorView without the Google sign-in gate (served by the Vite dev server). Test fixture:
  `tests/fixtures/sample.webm` (2s VP8+opus, 160x120) — committed.
- **Gotcha:** in Playwright, setting a React-controlled `<input type=range>` value needs the native
  `value` setter + `input` event (plain `.value=` doesn't update React state).

- **Library dropdown ("Add from your library", 2026-11-07):** lists saved videos that have a
  direct media URL (`playback.previewUrl`) and adds one as a clip via `readClipFromUrl`
  (`src/components/editor/LibraryClipPicker.tsx`; `EditorView` takes a `videos` prop from `App.tsx`).
  **Only RedGifs clips qualify** — `media.redgifs.com` sends permissive CORS (`access-control-allow-origin`
  reflects, range requests OK), so `fetch()` can read the bytes. Catalogue/YouTube videos are iframe-only
  (no direct URL) and are filtered out. `isEditableVideo` / `editableLibraryVideos` classify them.
- **Built-in samples (2026-11-07):** `public/samples/*.mp4` (3 small clips, ~363 KB, ffmpeg-made)
  are served by the Worker's ASSETS binding (Vite copies `public/`→`dist/`); listed via
  `src/data/sampleClips.ts` and shown in the picker as the "Samples (built in)" optgroup so the
  editor works with no local file. Same-origin ⇒ no CORS, always readable.

## Unified video browsing (v0.2.48, 2026-11-07)
- **One search/filter/sort/paginate model for every video list.** `src/services/videoFilter.ts`
  exports `DEFAULT_VIDEO_FILTERS`, `VideoFilterState`, `filterAndSortVideos(videos, filters, options?)`,
  `matchesVideoFilters`, `sortVideos`, `paginate(items, page, pageSize)` (returns `{page, pageCount, items}`,
  clamps out-of-range pages), `hasActiveVideoFilters`, `collect{Source,Channel,Tag}Options` (count-desc).
  UI: `src/components/VideoFilterBar.tsx` (props `videos, filters, onChange(patch), onClear, searchPlaceholder?,
  headerExtra?`) + `src/components/VideoPagination.tsx` (`page, pageCount, onPage`). Test ids:
  `video-filter-bar`, `video-filter-search`, `video-filter-source`, `video-filter-sort`, `video-filter-clear`,
  `video-pagination`.
- **Free-text search ANDs whitespace terms** across title/channel/description/tags; `options.extraSearchText(video)`
  adds list-specific fields (the catalogue uses it for `actors` + `category`, which `VideoMetadata` lacks).
- **Wired into** `VideosPage` (library, keeps bulk actions), `SearchView` (keeps personalized-ranking toggle in
  the bar's `headerExtra`; resets filters+page on a new search), `VegaSourceView` (catalogue; now paginated).
  Each list resets `page` to 0 whenever a filter changes.
- **Gotcha:** the baked catalogue has duplicate `sourceId:sourceVideoId` store keys (the same video under
  different slugs; the catalogue dedupes by canonical `pageUrl`), so `VegaSourceView` keys cards by
  `playback.externalUrl`, not the store key, or React logs a duplicate-key warning and drops cards.
- **OpenSpec CLI is `@fission-ai/openspec`** (not installed; run via `npx --yes @fission-ai/openspec@1.16.1 …`).
  Flow: `new change <name>`, then `instructions <artifact> --change <name>`, write files, `status --change`,
  `validate --all --strict`.

## Player play queue + related videos (2026-11-07)
- **Opening a video carries its list into the player.** `handlePlayVideo(video, queue, label)`
  (App) stores `playerQueue`/`queueLabel`; prev/next walks that queue and the counter names it
  ("Video N of M in Search results"/"in Catalogue"). Library opens (`handleSelectVideo`) clear the
  queue so it falls back to `videos`. A *saved* result opened from search still walks the search
  queue (only ephemeral-ness depends on saved status).
- **`resolvePlayerSelection(videos, id, ephemeral, queue?)`** now checks library → ephemeral → queue,
  so prev/next onto an unsaved result resolves instead of blanking the player. Queue moves only set
  `selectedVideoId`; saving stays explicit.
- **Related videos** (`src/services/relatedVideos.ts`): `relatednessScore` weights shared channelId
  (+5) > shared tag (+3) > shared title words (+2) > same source (+1); a similar duration (+1) only
  applies once something else matched (alone it is noise). `findRelatedVideos({pool, exclude, limit})`
  returns strongest-first and tops up with same-source videos. `App` builds the pool from
  `queueVideos` + `loadBakedCatalogVideos()` (dedup by youtubeId) and excludes the current video and
  its prev/next neighbours. Playing a related video appends it to the queue.
- **`loadBakedCatalogVideos()`** (vegaApi) maps the baked catalogue to `VideoMetadata` once and caches.
  NOTE: the baked catalogue has **no actors/category** (all records blank) and Vega uploader is often
  "" — so relatedness mostly rides on shared tags (the one tag is `riding pov` for the whole catalogue,
  which ties everything) + source top-up.
- Test hooks: `player-queue-label`, `related-videos`, `related-video-card`. Harness
  `tests/harness/player.html` mounts `SelectedVideoPage` with a synthetic queue; e2e
  `tests/e2e/player.spec.ts`.
