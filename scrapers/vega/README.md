# Vega catalogue pipeline

How the videos baked into the build (`src/data/vegaCatalog.json`) are produced.

The catalogue is a single file that can hold videos from any number of sources.
Each video names its `sourceId`, and the top-level `sources` array maps those ids
to a display name and a CloudTube `SourceFlag` (see `src/types/index.ts`), which
is what the library filters on. Adding another source means adding an entry to
`sources` and emitting records with a matching `sourceId`; nothing else changes.

Two sources were the originals: **Vega** (xvideos) and **Vortex** (xgroovy).
Eleven more were added from the [source discovery survey](../../docs/SOURCE_DISCOVERY.md),
each with its own cryptic alias and CloudTube `SourceFlag`:

| sourceId | Alias | Flag | Engine | Listing date? |
|---|---|---|---|---|
| `vega` | Vega | Vega | `vega_parse.py` | relative ("3 days ago") |
| `xgroovy` | Vortex | XGroovy | `xg_parse.py` | detail page (`xg_dates.py`) |
| `justporn` | Quasar | JustPorn | `engine_parse.py` (`_kt_kvs`) | detail page |
| `hornyfap` | Nebula | HornyFap | `engine_parse.py` (`_kvs_alt`) | detail page |
| `yesporn` | Zenith | YesPorn | `engine_parse.py` (`_kt_kvs`) | detail page |
| `xxbrits` | Pulsar | XXBrits | `engine_parse.py` (`_xxbrits`) | detail page |
| `notfans` | Onyx | NotFans | `engine_parse.py` (`_kvs_alt`) | detail page |
| `pornlib` | Atlas | PornLib | `engine_parse.py` (`_pornlib`) | detail page |
| `drtuber` | Halo | DrTuber | `engine_parse.py` (`_drtuber`) | none — first-seen fallback |
| `porngo` | Prism | PornGo | `engine_parse.py` (`_porngo`) | none — first-seen fallback |
| `youjizz` | Orbit | YouJizz | `engine_parse.py` (`_kvs_alt`) | detail page |
| `anysex` | Lumen | AnySex | `engine_parse.py` (KVS) | detail page |
| `alotporn` | Cinder | AlotPorn | `engine_parse.py` (`_kt_kvs`) | detail page |

Every source is scraped the same way — `scrape.sh` with a per-source URL file —
and every parser emits the same record shape, so the builder treats them
identically. Only the real playback host is stored (in each record's `embedUrl`
and `pageUrl`); the UI never renders it.

```
vega_urls.txt     ──► curl (Firecrawl fallback) ──► data/vega_pages/pNN.html     ──► vega_parse.py
xgroovy_urls.txt  ──► curl (Firecrawl fallback) ──► data/xgroovy_pages/pNN.html  ──► xg_parse.py
<source>_urls.txt ──► curl (Firecrawl fallback) ──► data/<source>_pages/pNN.html ──► engine_parse.py
                                                          │  (engine_dates.py fills upload dates)
                                                          ▼
                                  vega_build_manifest.py ──► src/data/vegaCatalog.json
                                                          │
                                                          ▼
                                   vega_to_cloudtube.py ──► data/vega_cloudtube_backup.jsonc
```

## 1. Scrape

Each source has a URL file listing the search-result pages to fetch. `scrape.sh`
takes an output directory and a URL file (defaulting to the Vega pair):

```bash
bash scrape.sh                                  # Vega -> data/vega_pages/
bash scrape.sh data/xgroovy_pages xgroovy_urls.txt   # Vortex -> data/xgroovy_pages/
bash scrape.sh data/justporn_pages justporn_urls.txt # Quasar -> data/justporn_pages/
```

It fetches each page with `curl` and a browser User-Agent and saves the raw HTML
as `p01.html`, `p02.html`, … The listing is fetched directly; the raw HTML carries
every field the catalogue needs, so no rendering service is involved. The pages
are intermediates and are git-ignored — only the built catalogue is committed.

If `curl` comes back blocked or without result cards, `scrape.sh` re-fetches
through the [Firecrawl CLI](https://docs.firecrawl.dev/sdks/cli) and switches to
it for the rest of the run. Firecrawl's free plan allows 10 requests/minute, so
that mode is paced (`FIRECRAWL_RATE_LIMIT` / `FIRECRAWL_RATE_WINDOW` override the
window). Firecrawl caches to `.firecrawl/`, which is also git-ignored. The
fallback needs the `FIRECRAWL_API_KEY` environment variable; without it only the
curl path runs.

### Upload dates

Most listings carry no upload date, so `engine_dates.py` reads the exact
`uploadDate` from each video's own page and writes a `{id: isoDate}` map. Ids
already dated in the committed catalogue are skipped, so a daily run only fetches
the new ones. It is deliberately gentle (low concurrency, a short delay, retries
on HTTP 429) because several of these sites rate-limit bursts:

```bash
python3 engine_dates.py --source justporn --out data/justporn_dates.json \
  --known data/vega_catalog.jsonc data/justporn_pages/p*.html
```

`drtuber` and `porngo` expose no date anywhere, so they are left out; their
entries fall back to the day they were first catalogued (and keep it, because the
builder carries the date forward from the committed catalogue).

Vega is the exception: its listing carries a relative age ("3 days ago"), which
`vega_build_manifest.py` approximates against the run date. Vortex uses its own
`xg_dates.py`, which is the same idea as `engine_dates.py` for the one source
that predates it.

### Automated daily refresh

`.github/workflows/refresh-vega-catalogue.yml` runs the whole pipeline once a
day (06:17 UTC) and can be run by hand from the Actions tab. It scrapes every
source, resolves dates, rebuilds the catalogue, bakes it into
`src/data/vegaCatalog.json`, and cuts a patch release; the release push makes
Cloudflare rebuild and redeploy the app. A source that fails to fetch is skipped
(its videos are carried forward), so one flaky site cannot block the refresh.

It needs no secret for the normal path. Add `FIRECRAWL_API_KEY`
(Settings → Secrets and variables → Actions). If Cloudflare's own git
integration does not rebuild on the push, add a deploy hook URL as the
`CF_DEPLOY_HOOK` secret and the workflow triggers it directly.


## 2. Parse + build the catalogue

```bash
python3 vega_build_manifest.py src/data/vegaCatalog.json --source justporn \
  --dates data/justporn_dates.json data/justporn_pages/p*.html
```

Writes `src/data/vegaCatalog.json` (imported by the app, so it ships in the
build) plus a commented `.jsonc` twin. `--source` selects the parser: `vega` and
`xgroovy` use their own modules, every other id goes through `engine_parse.py`.
Run it once per source; each run merges into the one catalogue. The committed
catalogue lives at `data/vega_catalog.jsonc`.

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
- `publishedDate` comes from the video page where the source exposes one, is
  approximated from the listing's relative age for Vega, and falls back to the
  first-seen date for drtuber and porngo.
- New scrapes are appended to the existing catalogue and deduped by canonical
  `pageUrl` (the `/video.<id>/<frame>/<slug>` frame segment is dropped), so a
  video re-listed under a different id is not stored twice and older entries are
  carried forward rather than dropped.

## Layout

```
vega_urls.txt              Vega search pages to scrape
xgroovy_urls.txt           Vortex search pages to scrape
<source>_urls.txt          the eleven other sources' search pages (justporn, hornyfap, ...)
vega_parse.py              Vega listing card (HTML or Firecrawl markdown) -> record
xg_parse.py                Vortex listing card (HTML) -> record
engine_parse.py            shared listing-card parsers for the eleven added sources
xg_dates.py                Vortex video page -> {id: uploadDate} map
engine_dates.py            any source's video page -> {id: uploadDate} map
vega_build_manifest.py     records -> baked multi-source catalogue (--source selects parser)
vega_to_cloudtube.py       catalogue -> CloudTube library backup
data/vega_pages/           Vega raw scrape dumps (git-ignored)
data/xgroovy_pages/        Vortex raw scrape dumps (git-ignored)
data/<source>_pages/       the added sources' raw scrape dumps (git-ignored)
data/xgroovy_dates.json    Vortex upload-date cache (git-ignored)
data/<source>_dates.json   added sources' upload-date caches (git-ignored)
data/vega_catalog.jsonc    generated catalogue (commented twin)
data/vega_cloudtube_backup.jsonc  generated CloudTube backup
data/raw/                  exploratory dumps (home / search / week)
```
