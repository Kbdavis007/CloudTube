#!/usr/bin/env python3
"""Build the baked video catalogue (src/data/vegaCatalog.json) from scraped pages.

The catalogue is a single file that can hold videos from any number of sources.
Each video names its `sourceId`, and the top-level `sources` array maps those ids
to a display name and the CloudTube `SourceFlag` used for filtering.

Usage: vega_build_manifest.py OUT.jsonc PAGES...
Also writes a strict-JSON twin (same path, .json) for direct import.
"""
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from vega_parse import parse_page  # noqa: E402

AGO = re.compile(r"(?:(\d+)\s*(minute|hour|day|week|month)s?|a\s+(minute|hour|day|week|month))")

# One entry per source that contributes videos. `flag` must be a SourceFlag in
# CloudTube's src/types/index.ts so the library can filter by source.
SOURCES = [
    {"id": "vega", "name": "Vega", "flag": "Vega", "tagline": "Web catalogue"},
]


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


def to_catalog_video(v: dict, now: datetime) -> dict:
    uploader = (v.get("channel") or "").strip()
    quality = v.get("quality") or ""
    return {
        "sourceId": "vega",
        "sourceVideoId": v["id"],
        "title": v["title"],
        "description": " · ".join(p for p in [quality, uploader] if p),
        "tags": ["riding pov"],
        # The listing exposes neither cast nor category; left empty rather than guessed.
        "actors": [],
        "category": "",
        "quality": quality,
        "durationSeconds": v["durationSeconds"],
        "thumbnail": v["thumbnail"],
        "previewThumbnail": v["thumbnail"],
        "embedUrl": v["embedUrl"],
        "pageUrl": v["watchUrl"],
        "uploader": uploader,
        "publishedDate": approx_date(v["uploadedAgo"], now),
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


def main() -> None:
    out = Path(sys.argv[1])
    pages = [Path(p) for p in sys.argv[2:]]
    now = datetime.now(timezone.utc)

    videos: list[dict] = []
    seen: set[str] = set()
    for p in pages:
        for v in parse_page(p):
            if v["id"] in seen:
                continue
            seen.add(v["id"])
            videos.append(to_catalog_video(v, now))

    videos.sort(key=lambda v: v["publishedDate"], reverse=True)

    catalog = {
        "schemaVersion": 1,
        "generatedAt": now.isoformat(timespec="seconds"),
        "sources": SOURCES,
        "videos": videos,
    }

    payload = json.dumps(catalog, indent=2, ensure_ascii=False)
    out.write_text(
        HEADER.format(generated=now.isoformat(timespec="seconds")) + payload + "\n"
    )
    out.with_suffix(".json").write_text(payload + "\n")
    print(f"wrote {out} + .json ({len(videos)} videos, {len(SOURCES)} source(s))")


if __name__ == "__main__":
    main()
