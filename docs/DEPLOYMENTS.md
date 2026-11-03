# Deployment Ledger

Every deployment of CloudTube is recorded here. The version shown is the git tag
the build was cut from; the commit is the exact revision that was served.

Add a row automatically with:

```bash
npm run deploy:log -- --env production --url https://your-app.example --notes "what shipped"
```

| Deployed (UTC) | Version | Commit | Environment | URL | Actor | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-30 02:08 UTC | `v0.1.0` | `c3c5eea` | production | https://work-1-rqotlvzedjcalkcx.prod-runtime.all-hands.dev | local | Semver + deployment tracking; CF 405 proxy fix |
| 2026-10-30 02:34 UTC | `v0.1.0` | `4a670a1` | production | https://ct.devmatrix.top | local | Edge Worker serves SPA + /api/cloudflare/proxy (fixes 405) |
| 2026-11-02 19:44 UTC | `v0.2.0` | `8e3bfce` | production | https://ct.devmatrix.top | local | multi-source search, library browser, sidebar, error 153 fix |
| 2026-11-02 19:46 UTC | `v0.2.1` | `71144f7` | production | https://ct.devmatrix.top | local | changelog-on-every-push policy |
| 2026-11-02 19:48 UTC | `v0.2.2` | `435aecb` | production | https://ct.devmatrix.top | local | release tooling: version stamp regenerated before deploy log |
| 2026-11-02 19:56 UTC | `v0.2.3` | `d4d806f` | production | https://ct.devmatrix.top | local | version policy: patch bumps only, 1.0.0 gated |
| 2026-11-02 22:45 UTC | `v0.2.4` | `bc9fa5d` | production | https://ct.devmatrix.top | local | Videos page shows the listing only; selecting a video opens a dedicated details+comments page |
| 2026-11-02 22:57 UTC | `v0.2.5` | `bd27e2d` | production | https://ct.devmatrix.top | local | Add Eporner as a key-free open video source on the Search page |
| 2026-11-02 23:16 UTC | `v0.2.6` | `9b63a4d` | production | https://ct.devmatrix.top | local | EmbedHub + RedGifs search sources; Settings source picker |
| 2026-11-02 23:26 UTC | `v0.2.7` | `483ea5d` | production | https://ct.devmatrix.top | local | RedGifs edge cache + retry for shared-IP 429s |
| 2026-11-03 02:08 UTC | `v0.2.8` | `3f4d17e` | production | https://ct.devmatrix.top | local | Pornhub source via RapidAPI with in-app key |
| 2026-11-03 02:15 UTC | `v0.2.9` | `055e5ad` | production | https://ct.devmatrix.top | local | xHamster and RedTube sources via multi-site RapidAPI |
| 2026-11-03 02:32 UTC | `v0.2.10` | `caed445` | production | https://ct.devmatrix.top | local | Hover previews on search result thumbnails; source names aliased (Vista/Aurora/Ember/Flicker/Nova/Comet/Crimson); key-gated sources added to filter chips |
| 2026-11-03 02:48 UTC | `v0.2.12` | `2a1a2e4` | production | https://ct.devmatrix.top | local | cached multi-source search API (D1 + edge + SW), Eporner browser-direct |
| 2026-11-03 03:06 UTC | `v0.2.13` | `e5cfab5` | production | https://ct.devmatrix.top | local | neutralise source naming: rename open-source id and flag to embedhub/EmbedHub; aliases constant renamed; prose updated |
