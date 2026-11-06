#!/usr/bin/env python3
"""Build the baked video catalogue (src/data/vegaCatalog.json) from scraped pages.

The catalogue is a single file that can hold videos from any number of sources.
Each video names its `sourceId`, and the top-level `sources` array maps those ids
to a display name and the CloudTube `SourceFlag` used for filtering.

Usage: vega_build_manifest.py OUT.jsonc PAGES... [--source SOURCE_ID] [--dates DATES.json]

Also writes a strict-JSON twin (same path, .json) for direct import.

Pages are appended to whatever is already in OUT, so running once per source
merges every source into the one file. Dedupe is by canonical page URL.
"""
import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

AGO = re.compile(r"(?:(\d+)\s*(minute|hour|day|week|month)s?|a\s+(minute|hour|day|week|month))")

# One entry per source that contributes videos. `flag` must be a SourceFlag in
# CloudTube's src/types/index.ts so the library can filter by source.
SOURCES = [
    {"id": "vega", "name": "Vega", "flag": "Vega", "tagline": "Web catalogue"},
    {"id": "xgroovy", "name": "Vortex", "flag": "XGroovy", "tagline": "Web catalogue"},
]

# How each source's pages are parsed. Both parsers return the same record shape,
# so everything downstream is source-agnostic.
def _parse_source(source_id: str, path, dates: dict | None = None) -> list[dict]:
    if source_id == "xgroovy":
        from xg_parse import parse_page as parse_xg

        return parse_xg(path, dates)
    from vega_parse import parse_page as parse_vega

    return parse_vega(path)


def canonical_url(url: str) -> str:
    """Drop the frame segment from a watch URL so the same video dedupes.

    xvideos serves `/video.<id>/<frame>/<slug>`, where <frame> is a thumbnail
    frame that varies between scrapes (the raw listing has the literal
    `THUMBNUM` placeholder, Firecrawl resolves it to a number). It is not part of
    the video's identity, so it is removed; `/video.<id>/<slug>` is canonical and
    resolves 200.
    """
    return re.sub(r"(/video\.[A-Za-z0-9]+)/[^/]+/", r"\1/", url)


def approx_date(ago: str, now: datetime) -> str:
    m = AGO.search(ago.lower())
    if not m:
        return ""
    n = int(m.group(1)) if m.group(1) else 1
    unit = m.group(2) or m.group(3)
    delta = {
        "minute": timedelta(minutes=n),
        "hour": timedelta(hours=n),
        "day": timedelta(days=n),
        "week": timedelta(weeks=n),
        "month": timedelta(days=30 * n),
    }[unit]
    return (now - delta).date().isoformat()


def to_catalog_video(v: dict, now: datetime, source_id: str) -> dict:
    uploader = (v.get("channel") or "").strip()
    quality = v.get("quality") or ""
    # xgroovy carries an exact ISO date from the video page; vega only a relative
    # age ("3 days ago"), which is approximated.
    published = v.get("publishedDate") or approx_date(v.get("uploadedAgo") or "", now)
    return {
        "sourceId": source_id,
        "sourceVideoId": v["id"],
        "title": v["title"],
        "description": " · ".join(p for p in [quality, uploader] if p),
        "tags": ["riding pov"],
        # The listings expose neither cast nor category; left empty rather than guessed.
        "actors": [],
        "category": "",
        "quality": quality,
        "durationSeconds": v["durationSeconds"],
        "thumbnail": v["thumbnail"],
        "previewThumbnail": v["thumbnail"],
        "embedUrl": v["embedUrl"],
        "pageUrl": canonical_url(v["watchUrl"]),
        "uploader": uploader,
        "publishedDate": published,
        "viewCount": v.get("views") or 0,
        "isPremium": False,
    }


HEADER = """// Baked video catalogue - committed to the repo, bundled into the build.
// Generated: {generated}
//
// One file holds videos from any number of sources; each video names its
// `sourceId`, and `sources` maps ids to a display name and SourceFlag.
//
// Regenerate with: vega_build_manifest.py <this-file> <page-json>...
//
// FIELDS
//   schemaVersion      catalogue schema revision
//   generatedAt        ISO-8601 build time
//   sources[]          {{ id, name, flag, tagline }} - `flag` is a CloudTube SourceFlag
//   videos[]           {{ sourceId, sourceVideoId, title, description, tags, actors,
//                       category, quality, durationSeconds, thumbnail, previewThumbnail,
//                       embedUrl, pageUrl, uploader, publishedDate, viewCount, isPremium }}
//
// PLAYBACK: load `embedUrl` in an <iframe>. The player page sends no
//   X-Frame-Options and no CSP frame-ancestors, so it renders inline. Direct
//   media URLs are token-gated and IP-locked, so they are never stored here.
//
// JSONC NOTE: comments are confined to this header; the payload is plain JSON, so
//   strip the leading // lines to JSON.parse, or import the .json twin directly.
"""


def load_existing(path: Path) -> list[dict]:
    """Existing catalogue videos, or [] when there is nothing to carry forward."""
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8")
    # The catalogue path is the .jsonc, whose leading `//` header is not valid
    # JSON; strip comment lines before parsing.
    payload = "\n".join(l for l in text.splitlines() if not l.lstrip().startswith("//"))
    try:
        data = json.loads(payload)
    except ValueError:
        return []
    videos = data.get("videos") or []
    # Older catalogues stored the thumbnail-frame segment in pageUrl; drop it so
    # those entries dedupe against freshly scraped ones.
    for v in videos:
        if v.get("pageUrl"):
            v["pageUrl"] = canonical_url(v["pageUrl"])
    return videos


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("pages", nargs="+")
    ap.add_argument("--source", default="vega", help="which parser to use for the pages")
    ap.add_argument("--dates", help="xgroovy {id: isoDate} map to merge in")
    args = ap.parse_args()

    out = Path(args.out)
    pages = [Path(p) for p in args.pages]
    now = datetime.now(timezone.utc)
    existing = load_existing(out)
    existing_keys = {(e.get("pageUrl") or e.get("sourceVideoId")) for e in existing}

    dates = {}
    if args.dates:
        from xg_parse import load_dates

        dates = load_dates(args.dates)

    # New scrapes first, then the videos already in the catalogue, so the fresh
    # listing wins any field that changed and older entries are carried forward
    # rather than dropped.
    fresh: list[dict] = []
    for p in pages:
        for v in _parse_source(args.source, p, dates):
            fresh.append(to_catalog_video(v, now, args.source))

    merged: list[dict] = []
    seen: set[str] = set()
    for v in fresh + existing:
        # Dedupe on the canonical URL, not the id: the same video can be served
        # under more than one id, and its URL is what actually identifies it.
        key = v.get("pageUrl") or v.get("sourceVideoId")
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(v)

    merged.sort(key=lambda v: (v.get("publishedDate") or ""), reverse=True)
    fresh_keys = {(v.get("pageUrl") or v.get("sourceVideoId")) for v in fresh}
    new_count = len(fresh_keys - existing_keys)
    carried = len(existing_keys - fresh_keys)

    catalog = {
        "schemaVersion": 1,
        "generatedAt": now.isoformat(timespec="seconds"),
        "sources": SOURCES,
        "videos": merged,
    }

    payload = json.dumps(catalog, indent=2, ensure_ascii=False)
    out.write_text(
        HEADER.format(generated=now.isoformat(timespec="seconds")) + payload + "\n"
    )
    out.with_suffix(".json").write_text(payload + "\n")
    print(
        f"wrote {out} + .json ({len(merged)} videos, {len(SOURCES)} source(s); "
        f"{new_count} new, {carried} carried forward)"
    )


if __name__ == "__main__":
    main()
