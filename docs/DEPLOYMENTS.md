# Deployment Ledger

Every deployment of CloudTube is recorded here. The version shown is the git tag
the build was cut from; the commit is the exact revision that was served.

Add a row automatically with:

```bash
npm run deploy:log -- --env production --url https://your-app.example --notes "what shipped"
```

| Deployed (UTC) | Version | Commit | Environment | URL | Actor | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-30 01:54 | `v0.1.0` | `f1f7a6b` | local | — | local | Versioning + release tracking introduced |
