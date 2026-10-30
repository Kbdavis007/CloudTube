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
