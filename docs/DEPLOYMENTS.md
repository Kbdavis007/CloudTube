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
| 2026-11-03 03:09 UTC | `v0.2.14` | `1f9247e` | production | https://ct.devmatrix.top | local | docs: neutralise source naming in the release records |
| 2026-11-04 06:46 UTC | `v0.2.16` | `76e93d3` | production | https://ct.devmatrix.top | local | revert the Remote page: Cloudflare Worker egress IP blocked by the embedded site |
| 2026-11-05 15:15 UTC | `v0.2.18` | `6c47a4a` | production | https://ct.devmatrix.top | local | persist the Cloudflare agent setup in .openhands-setup/cloudflare (idempotent restore + MCP manifests) |
| 2026-11-05 15:31 UTC | `v0.2.19` | `353fec0` | production | https://ct.devmatrix.top | local | Search the built-in Vega catalogue from the Search & Collect page |
| 2026-11-05 23:16 UTC | `v0.2.20` | `14d0b11` | production | https://ct.devmatrix.top | local | Daily Vega catalogue refresh workflow |
| 2026-11-05 23:18 UTC | `v0.2.21` | `19270a4` | production | https://ct.devmatrix.top | local | Privacy Policy and Terms of Service pages at /privacy and /tos, linked from the homepage and Settings (Google OAuth verification) |
| 2026-11-05 23:21 UTC | `v0.2.22` | `06edc2f` | production | https://ct.devmatrix.top | local | daily Vega catalogue refresh workflow |
| 2026-11-05 23:28 UTC | `v0.2.23` | `07fabd3` | production | https://ct.devmatrix.top | local | daily refresh workflow + memory notes |
| 2026-11-05 23:30 UTC | `v0.2.24` | `834d5ba` | production | https://ct.devmatrix.top | local | memory notes |
| 2026-11-05 23:33 UTC | `v0.2.25` | `efa6921` | production | https://ct.devmatrix.top | local | Agent-first PR template, OpenSpec scaffold, harness kit pin, Playwright e2e proof |
| 2026-11-06 01:59 UTC | `v0.2.27` | `a84390e` | production | https://ct.devmatrix.top | local | PR template: permanent evidence URLs; e2e no longer dirties the tree |
| 2026-11-06 02:08 UTC | `v0.2.28` | `c1cb914` | production | https://ct.devmatrix.top | local | stop the daily release colliding on the version tag |
| 2026-11-06 02:10 UTC | `v0.2.29` | `24fbf71` | production | https://ct.devmatrix.top | Kbdavis007 | daily Vega catalogue refresh |
| 2026-11-06 02:12 UTC | `v0.2.30` | `fe48740` | production | https://ct.devmatrix.top | local | record v0.2.28 deploy + CI release lessons |
| 2026-11-06 02:43 UTC | `v0.2.32` | `ac92675` | production | https://ct.devmatrix.top | Kbdavis007 | daily Vega catalogue refresh |
| 2026-11-06 02:46 UTC | `v0.2.32` | `8515b1f` | production | https://ct.devmatrix.top | local | curl-first scraper with Firecrawl fallback |
| 2026-11-06 02:47 UTC | `v0.2.33` | `5882571` | production | https://ct.devmatrix.top | local | memory: curl-first scraper notes |
| 2026-11-06 05:11 UTC | `v0.2.34` | `98f421a` | production | https://ct.devmatrix.top | local | Vortex (xgroovy) added as a second baked source; 548 videos |
| 2026-11-06 05:13 UTC | `v0.2.35` | `cde7f13` | production | https://ct.devmatrix.top | local | docs: Vortex (xgroovy) source notes |
| 2026-11-06 05:15 UTC | `v0.2.36` | `3741b05` | production | https://ct.devmatrix.top | Kbdavis007 | daily Vega catalogue refresh |
| 2026-11-06 06:45 UTC | `v0.2.37` | `b7cf73d` | production | https://ct.devmatrix.top | local | docs: source discovery survey |
| 2026-11-06 06:46 UTC | `v0.2.38` | `50545ca` | production | https://ct.devmatrix.top | local | docs: source discovery notes |
| 2026-11-06 07:52 UTC | `v0.2.39` | `ea3b47c` | production | https://ct.devmatrix.top | local | eleven screened sources added to the Vega catalogue (Vega+Vortex+11; 1221 videos) |
| 2026-11-06 07:54 UTC | `v0.2.40` | `438a90d` | production | https://ct.devmatrix.top | local | memory notes for the eleven-source integration |
| 2026-11-06 08:05 UTC | `v0.2.41` | `3ccdf1b` | production | https://ct.devmatrix.top | local | Video editor planned (openspec add-video-editor) |
| 2026-11-06 14:21 UTC | `v0.2.42` | `894439d` | production | https://ct.devmatrix.top | Kbdavis007 | daily Vega catalogue refresh |
| 2026-11-07 02:20 UTC | `v0.2.43` | `be4e86a` | production | https://ct.devmatrix.top | Kbdavis007 | daily Vega catalogue refresh |
| 2026-11-07 02:39 UTC | `v0.2.44` | `dbb6d62` | production | https://ct.devmatrix.top | local | Video Editor (phase 1): trim, reorder, preview and combine local clips into one MP4, fully client-side |
| 2026-11-07 03:01 UTC | `v0.2.45` | `b8f215a` | production | https://ct.devmatrix.top | local | Video editor: add a dropdown of editable saved videos (RedGifs clips with a direct media URL) |
