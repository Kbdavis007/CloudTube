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
