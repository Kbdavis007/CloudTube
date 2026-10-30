# Changelog

All notable changes to CloudTube are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the release version is injected
into the UI at build time (`npm run version:sync`).

The version shown in the app header comes from the most recent git tag. When the
working tree has uncommitted changes the badge turns amber and shows the
`-dirty` suffix, so what you see running always matches a real commit.

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

