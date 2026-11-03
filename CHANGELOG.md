# Changelog

All notable changes to CloudTube are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the release version is injected
into the UI at build time (`npm run version:sync`).

The version shown in the app header comes from the most recent git tag. When the
working tree has uncommitted changes the badge turns amber and shows the
`-dirty` suffix, so what you see running always matches a real commit.










## [0.2.8] - 2026-11-03

**Tag:** `v0.2.8` · **Branch:** `main` · **Deployed:** pending

### Features
- add Pornhub source via RapidAPI with in-app key (2d10380)

## [0.2.7] - 2026-11-02

**Tag:** `v0.2.7` · **Branch:** `main` · **Deployed:** 2026-11-02 23:26 UTC (production)

### Fixes
- cache and retry RedGifs to survive shared-IP 429s (6444c3d)

## [0.2.6] - 2026-11-02

**Tag:** `v0.2.6` · **Branch:** `main` · **Deployed:** 2026-11-02 23:16 UTC (production)

### Features
- add AdultEmbed and RedGifs sources, plus source picker (a7fa8a8)

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

