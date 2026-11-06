# Source discovery — candidate video sites

A survey of tube sites that could be wired into the app the way Vega (xvideos)
and Vortex (xgroovy) are: a **searchable listing**, an **embeddable player**, and
ideally a **date**.

> **Status:** the eleven "Recommended candidates" below are now wired — each has
> a cryptic alias, a `SourceFlag`, and a parser in `scrapers/vega/engine_parse.py`
> (see `scrapers/vega/README.md`). drtuber and porngo expose no date anywhere, so
> their entries carry a first-seen fallback date. The rest of this document is the
> original reconnaissance that selected them.

Method: for each host, probe a search URL for the query `riding pov`, confirm the
results actually change for a different query (`missionary`), pull a real detail
page, extract the site's own embed URL, and check the embed response for
`X-Frame-Options` / CSP `frame-ancestors` and a real player (`kt_player`,
`<video>`, Video.js). A source only qualifies if the embed is **framable** (no
`X-Frame-Options`, no restrictive `frame-ancestors`) — otherwise the in-app
player cannot show it and the source is useless to us.

Everything below was verified by hand against live responses, not assumed.

## Recommended candidates (framable, query-filtering)

Ordered by how much work the integration would be. All of these returned a
framable embed and genuinely filter by the search query.

| Site | Search URL | Embed URL | Listing date | Notes |
|---|---|---|---|---|
| **justporn.com** | `/search/{q}/` | `/embed/{id}/` | **absolute** (`2026-11-01`) | Best metadata of the batch — the listing itself carries exact dates, so no detail-page pass. 27/page. |
| **hornyfap.tv** | `/search/{q}/` | `/embed/{id}/` | relative only (`2 weeks ago`) | KVS, kt_player. 24/page. |
| **xxbrits.com** | `/search/{q}/` | `/embed/{id}/` | relative only | KVS. Detail page has `uploadDate`. 25/page. |
| **yesporn.vip** | `/search/{q}/` | `/embed/{id}/` | relative only | KVS. 20/page. |
| **notfans.com** | `/search/{q}/` | `/embed/{id}/` | none | KVS, kt_player; 24/page. |
| **pornlib.com** | `/search/{q}/` | `/embed/{id}/` | none | KVS-like, `<video>` player; 44/page. |
| **drtuber.com** | `/search/{q}/` | `/embed/{id}/` | none | Large (70+/page). `<video>` player. |
| **porngo.com** | `/search/{q}/` | `/embed/{id}/` | none | Video.js player; smaller results (10/page). |
| **youjizz.com** | `/search?q={q}` | `/videos/embed/{id}` | none | `<video>`/fluidplayer. Embed path is `/videos/embed/{id}`, not `/embed/{id}`. |
| **anysex.com** | `/search/?q={q}` | `/embed/{id}/` | none | KVS, kt_player; filters correctly. |
| **alotporn.com** | `/search?q={q}` | `/embed/{id}/` | none | fluidplayer. Thin for multi-word queries (2 hits for "riding pov", 60 for "missionary") — a long-tail archive. |

Only **justporn.com** gives an exact date straight off the listing. The others
would need the same detail-page pass that Vortex uses (`xg_dates.py`): fetch each
video page and read its `uploadDate`.

## Works, but weaker

| Site | Why it is second tier |
|---|---|
| **3movs.com** | Framable `kt_player` embed, **but the search ignores the query** — every query returns the same 48 browse items. Only useful if we scrape a category/browse feed, not a search. |
| **nudevista.com** | Framable embed, but it is a **meta-search** — the embed host is a *third party* (`shooshtime.com`), so ids are not ours and results are a mix. Treat as a discovery index, not a source. |
| **hclips.com**, **txxx.com**, **upornia.com**, **voyeurhit.com**, **tubepornclassic.com**, **vjav.com** | KVS family with a search page and dates on the listing, but the `/embed/{id}/` guess did **not** return a player (empty/short body). Their real embed path likely differs (e.g. `/videos/{id}/embed`) and needs a per-site pass on a detail page. Worth a second look. |
| **porn300.com**, **porndig.com**, **ok.xxx**, **thothd.com**, **thothub.to**, **perfectgirls.net**, **pornone.com**, **sunporno.com**, **hqporner.com**, **tnaflix.com**, **pornzog.com**, **pornvee.com** | Search returns real result cards, but no framable embed was resolved from the detail page. Either the embed path is non-obvious or the player is loaded via JS with a token. |
| **spankbang.com**, **porntrex.com**, **beeg.com**, **tube8.com**, **gotporn.com**, **pornhd.com**, **4tube.com**, **fullporn.net**, **pornhat.com**, **pornve.com**, **pornmd.com**, **anon-v.com** | No working search URL from our probes (404, redirect, or blocked). |

## Already wired (for reference)

- **Vega** = xvideos — curl-first scrape of `/search/{q}/` pages, JSONC catalogue.
- **Vortex** = xgroovy — same pipeline, plus a detail-page date resolver.
- **Eporner** — official JSON API, no key, framable `/embed/{id}/`.
- **AdultEmbed** — official JSON API, no key, framable player.
- **RedGifs** — API, but 429s from the Cloudflare Worker egress IP.
- **Pornhub / xHamster / RedTube** — via a key-gated RapidAPI subscription.

## What an integration would take

The Vega/Vortex pipeline already generalises: `scrape.sh [OUT_DIR] [URLS_FILE]`,
a per-source listing parser, an optional date resolver, and
`vega_build_manifest.py --source <id>` merging into the one catalogue. A new
KVS-style source (hornyfap, justporn, xxbrits, yesporn, notfans, pornlib,
drtuber, porngo) is mostly: a URL file, a card parser, and a `SourceFlag` +
cryptic alias in the UI (the alias rule — real host stays only in stored URLs).

Highest-value next steps, in order:

1. **justporn.com** — the only candidate whose listing carries exact dates, so it
   needs no detail-page pass; the cheapest full integration with real dates.
2. **pornlib.com** and **drtuber.com** — big result sets per page (44–70+).
3. **youjizz.com** — large site, but confirm the odd `/videos/embed/{id}` path
   and whether results are newest-first.
4. Re-probe the KVS family (hclips/txxx/upornia/voyeurhit) for their real embed
   path — they are the same engine as xgroovy, so a parser may be reusable.

## Caveats

- Probe results are a snapshot (2026-11-06). Sites change embed paths, add
  `X-Frame-Options`, or block datacenter IPs without notice — every one of these
  must be re-checked from the **Cloudflare Worker** egress before trusting it
  (the RedGifs and xvideos-proxy lessons: the sandbox IP is not the Worker IP).
- "Framable from the sandbox" is necessary but not sufficient. The xvideos
  whole-site proxy worked locally and failed in production because the Worker
  IP was blocked.
- Search-term fit matters: the app's terms are `riding pov` / `missionary`. A
  source that returns 2 results for a multi-word query (alotporn) adds little.
