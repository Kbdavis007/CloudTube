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
firecrawl scrape "$url" -o data/vega_pages/p01.json
```

Firecrawl caches to `.firecrawl/` in the working directory — it is git-ignored.

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
