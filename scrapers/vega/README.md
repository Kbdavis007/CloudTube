# Vega catalogue pipeline

How the videos baked into the build (`src/data/vegaCatalog.json`) are produced.

The catalogue is a single file that can hold videos from any number of sources.
Each video names its `sourceId`, and the top-level `sources` array maps those ids
to a display name and a CloudTube `SourceFlag` (see `src/types/index.ts`), which
is what the library filters on. Adding another source means adding an entry to
`sources` and emitting records with a matching `sourceId`; nothing else changes.

```
vega_urls.txt ──► firecrawl scrape ──► data/vega_pages/pNN.json
                                            │
                                            ▼
                                      vega_parse.py
                                            │
                                            ▼
                                  vega_build_manifest.py ──► src/data/vegaCatalog.json
                                            │
                                            ▼
                                   vega_to_cloudtube.py ──► data/vega_cloudtube_backup.jsonc
```

## 1. Scrape

`vega_urls.txt` lists the search-result pages to fetch. Scrape each with the
[Firecrawl CLI](https://docs.firecrawl.dev/sdks/cli) and save the JSON under
`data/vega_pages/` (one file per page, `p01.json`, `p02.json`, …):

```bash
bash scrape.sh                       # all URLs -> data/vega_pages/
# or a single page:
firecrawl scrape "$url" -f markdown,links --max-age 0 -o data/vega_pages/p01.json
```

Firecrawl caches to `.firecrawl/` in the working directory — it is git-ignored.

Firecrawl rate-limits requests (10 per minute on the free plan), so `scrape.sh`
paces them and waits out the window between batches. The limit and window can be
overridden with `FIRECRAWL_RATE_LIMIT` / `FIRECRAWL_RATE_WINDOW` if the plan
changes.

### Automated daily refresh

`.github/workflows/refresh-vega-catalogue.yml` runs the whole pipeline once a
day (06:17 UTC) and can be run by hand from the Actions tab. It scrapes, rebuilds
the catalogue, bakes it into `src/data/vegaCatalog.json`, and cuts a patch
release; the release push makes Cloudflare rebuild and redeploy the app.

It needs one repository secret: `FIRECRAWL_API_KEY`
(Settings → Secrets and variables → Actions). If Cloudflare's own git
integration does not rebuild on the push, add a deploy hook URL as the
`CF_DEPLOY_HOOK` secret and the workflow triggers it directly.


## 2. Parse + build the catalogue

```bash
python3 vega_build_manifest.py src/data/vegaCatalog.json data/vega_pages/p*.json
```

Writes `src/data/vegaCatalog.json` (imported by the app, so it ships in the
build) plus a commented `.jsonc` twin. `vega_parse.py` is the listing-card
parser and is imported by the build script.

## 3. Export a CloudTube library backup (optional)

```bash
python3 vega_to_cloudtube.py data/vega_catalog.json data/vega_cloudtube_backup.jsonc
```

Produces a backup in CloudTube's own library format for import through
**Settings → Keep a backup**. The app's catalogue is baked in, so this is only
for carrying the same videos into another CloudTube instance.

## Notes

- **Playback** uses `embedUrl` in an `<iframe>`; the player page sends no
  `X-Frame-Options` and no CSP `frame-ancestors`, so it renders inline. Direct
  media URLs are token-gated and IP-locked, so they are never stored here.
- The listing exposes neither cast nor category, so `actors` and `category` are
  left empty rather than guessed.
- `publishedDate` is approximated from the listing's relative age ("3 days ago").

## Layout

```
vega_urls.txt              search pages to scrape
vega_parse.py              markdown listing-card -> record
vega_build_manifest.py     records -> baked multi-source catalogue
vega_to_cloudtube.py       catalogue -> CloudTube library backup
data/vega_pages/           raw Firecrawl dumps (one per page)
data/vega_catalog.jsonc    generated catalogue (commented twin)
data/vega_cloudtube_backup.jsonc  generated CloudTube backup
data/raw/                  exploratory dumps (home / search / week)
```
