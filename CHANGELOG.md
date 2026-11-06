# Changelog

All notable changes to CloudTube are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the release version is injected
into the UI at build time (`npm run version:sync`).

The version shown in the app header comes from the most recent git tag. When the
working tree has uncommitted changes the badge turns amber and shows the
`-dirty` suffix, so what you see running always matches a real commit.






























## [0.2.27] - 2026-11-06

**Tag:** `v0.2.27` · **Branch:** `main` · **Deployed:** pending

### Documentation
- require permanent screenshot URLs and keep e2e from dirtying the tree (d355d8d)

### Maintenance
- refresh the baked catalogue (e1c357a)

## [0.2.27] - 2026-11-06

**Tag:** `v0.2.27` · **Branch:** `main` · **Deployed:** pending

### Documentation
- require permanent screenshot URLs and keep e2e from dirtying the tree (d355d8d)

## [0.2.26] - 2026-11-06

**Tag:** `v0.2.26` · **Branch:** `main` · **Deployed:** pending

### Fixes
- pace the scrape under Firecrawl's rate limit (4143ccc)

### Documentation
- pin PR screenshot evidence to a commit SHA, not a branch (99e80e9)

### Other Changes
- Only save a video when Save is pressed, and preview on hover (#13) (6d57fe1)

## [0.2.25] - 2026-11-05

**Tag:** `v0.2.25` · **Branch:** `main` · **Deployed:** 2026-11-05 23:33 UTC (production)

### Documentation
- add an agent-first pull request template (OpenSpec + harness + Playwright proof) (#12) (676b745)

## [0.2.24] - 2026-11-05

**Tag:** `v0.2.24` · **Branch:** `main` · **Deployed:** 2026-11-05 23:30 UTC (production)

### Documentation
- note the daily refresh workflow and its secret (135bc4a)

## [0.2.23] - 2026-11-05

**Tag:** `v0.2.23` · **Branch:** `main` · **Deployed:** 2026-11-05 23:28 UTC (production)

### Documentation
- record the daily refresh workflow and the GitHub write outage (3188f2f)

## [0.2.22] - 2026-11-05

**Tag:** `v0.2.22` · **Branch:** `main` · **Deployed:** 2026-11-05 23:21 UTC (production)

### Documentation
- record the direct-to-main landing flow and release steps (068ae82)

### Other Changes
- land the daily catalogue refresh as a release (9795ac8)

## [0.2.21] - 2026-11-05

**Tag:** `v0.2.21` · **Branch:** `main` · **Deployed:** 2026-11-05 23:18 UTC (production)

### Features
- add /privacy and /tos pages for Google OAuth verification (7dc8052)

### Documentation
- record the legal pages setup and the SPA-fallback gotcha (4ec3417)

## [0.2.20] - 2026-11-05

**Tag:** `v0.2.20` · **Branch:** `main` · **Deployed:** 2026-11-05 23:16 UTC (production)

### Fixes
- track expanded channels and restore the view on reload (#7) (a467928)

### Documentation
- record the lockfile fix and the Vega search source (b30130f)

### Other Changes
- refresh the baked Vega catalogue daily (d5368f5)

## [0.2.19] - 2026-11-05

**Tag:** `v0.2.19` · **Branch:** `main` · **Deployed:** 2026-11-05 15:31 UTC (production)

### Features
- search the built-in Vega catalogue from Search & Collect (5e149ff)

## [0.2.18] - 2026-11-05

**Tag:** `v0.2.18` · **Branch:** `main` · **Deployed:** 2026-11-05 15:15 UTC (production)

### Maintenance
- persist the Cloudflare agent setup in the repo kit (b21dabd)

## [0.2.17] - 2026-11-05

**Tag:** `v0.2.17` · **Branch:** `main` · **Deployed:** pending

### Fixes
- regenerate bun.lock at lockfileVersion 1 for bun 1.2.15 (bb3c97d)

### Other Changes
- Add the Vega catalogue scraper pipeline and its generated files (3a3f57d)
- Update project memory for the baked Vega catalogue (9dbc6bf)
- Bake the video catalogue into the build under the Vega source (2778ade)
- Record the in-repo memory policy in project memory (439d7d4)
- Track project memory in the repository (146e00c)

## [0.2.16] - 2026-11-04

**Tag:** `v0.2.16` · **Branch:** `main` · **Deployed:** 2026-11-04 06:46 UTC (production)

### Other Changes
- remove the Remote page and its framing proxy (9fae6c4)

## [0.2.15] - 2026-11-04

**Tag:** `v0.2.15` · **Branch:** `main` · **Deployed:** pending

### Features
- embed an external site full-page via a framing proxy (1541755)

## [0.2.14] - 2026-11-03

**Tag:** `v0.2.14` · **Branch:** `main` · **Deployed:** 2026-11-03 03:09 UTC (production)

### Documentation
- neutralise source naming in the release records (be60e5b)

## [0.2.13] - 2026-11-03

**Tag:** `v0.2.13` · **Branch:** `main` · **Deployed:** 2026-11-03 03:06 UTC (production)

### Refactoring
- neutralise source naming: rename open-source id and its flag to embedhub/EmbedHub (c56687d)

## [0.2.12] - 2026-11-03

**Tag:** `v0.2.12` · **Branch:** `main` · **Deployed:** 2026-11-03 02:48 UTC (production)

### Fixes
- keep Eporner browser-direct; cache partial results (03ae1c1)

## [0.2.11] - 2026-11-03

**Tag:** `v0.2.11` · **Branch:** `main` · **Deployed:** pending

### Features
- cached multi-source search API (D1 + edge + SW) (e439c07)

## [0.2.10] - 2026-11-03

**Tag:** `v0.2.10` · **Branch:** `main` · **Deployed:** 2026-11-03 02:32 UTC (production)

### Features
- hover previews on result cards + alias source names (091fe44)

## [0.2.9] - 2026-11-03

**Tag:** `v0.2.9` · **Branch:** `main` · **Deployed:** 2026-11-03 02:15 UTC (production)

### Features
- add xHamster and RedTube sources via multi-site RapidAPI (b4c945c)

## [0.2.8] - 2026-11-03

**Tag:** `v0.2.8` · **Branch:** `main` · **Deployed:** 2026-11-03 02:08 UTC (production)

### Features
- add Pornhub source via RapidAPI with in-app key (2d10380)

## [0.2.7] - 2026-11-02

**Tag:** `v0.2.7` · **Branch:** `main` · **Deployed:** 2026-11-02 23:26 UTC (production)

### Fixes
- cache and retry RedGifs to survive shared-IP 429s (6444c3d)

## [0.2.6] - 2026-11-02

**Tag:** `v0.2.6` · **Branch:** `main` · **Deployed:** 2026-11-02 23:16 UTC (production)

### Features
- add EmbedHub and RedGifs sources, plus source picker (a7fa8a8)

## [0.2.5] - 2026-11-02

**Tag:** `v0.2.5` · **Branch:** `main` · **Deployed:** 2026-11-02 22:57 UTC (production)

### Features
- add Eporner as a key-free open video source (d028b1f)

### Fixes
- add Eporner to the VideosPage source flag colors (773264e)

## [0.2.4] - 2026-11-02

**Tag:** `v0.2.4` · **Branch:** `main` · **Deployed:** 2026-11-02 22:45 UTC (production)

### Features
- separate listing from the selected video page (3c8f1f6)

## [0.2.3] - 2026-11-02

**Tag:** `v0.2.3` · **Branch:** `main` · **Deployed:** 2026-11-02 19:56 UTC (production)

### Fixes
- only skip generated bookkeeping commits from the changelog (ffd676c)

### Maintenance
- pin version policy and gate 1.0.0 (e5386a6)

## [0.2.2] - 2026-11-02

**Tag:** `v0.2.2` · **Branch:** `main` · **Deployed:** 2026-11-02 19:48 UTC (production)

### Fixes
- regenerate version stamp before recording a deploy (1441835)

## [0.2.1] - 2026-11-02

**Tag:** `v0.2.1` · **Branch:** `main` · **Deployed:** 2026-11-02 19:46 UTC (production)

### Documentation
- require a release and changelog entry on every push (1e4c66f)

## [0.2.0] - 2026-11-02

**Tag:** `v0.2.0` · **Branch:** `main` · **Deployed:** 2026-11-02 19:44 UTC (production)

### Features
- search Archive.org, PeerTube and Dailymotion without sign-in (e803bd4)
- browse all library videos with search, filters and sort (b929be3)
- remove the Recent Activity panel (be3c65c)
- keep sidebar sticky and confine playback to the app (146b9de)
- add Theme & Visual Options panel with Light/Medium/Dark (c791932)

### Fixes
- stop YouTube embeds failing with error 153 (5de76a0)
- stop the embed navigating the app away; review downloads first (d8297aa)

## [0.1.0] - 2026-10-30

**Tag:** `v0.1.0` · **Branch:** `main` · **Deployed:** 2026-10-30 02:08 UTC (production)

### Features
- add semver release + deployment tracking (148a3e3)
- use Google OAuth token only, remove YouTube API key field (f1f7a6b)
- implement gated access and live logging (96b2b68)

### Fixes
- generate version file at build time, do not commit it (6947b56)
- stamp version after commit so DIRTY is false in tagged builds (e985bfa)
- remove simulator mode, use live Cloudflare API only (b626b2f)

### Refactoring
- use live YouTube data end-to-end, remove demo/guest mode (e1ed72a)
- remove mock data from search, settings, and AI services (c533be0)

### Maintenance
- sync generated version file (c06ba03)

