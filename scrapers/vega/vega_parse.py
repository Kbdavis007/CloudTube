#!/usr/bin/env python3
"""Parse Firecrawl markdown dumps of xvideos search pages into a JSONC manifest."""
import json
import re
import sys
from pathlib import Path

# One video card looks like (markdown, line-based):
#   [![](THUMB)QUALITY](WATCH_URL)
#   [TITLE DURATION](WATCH_URL "TITLE")
#   DURATION[CHANNEL](CHANNEL_URL) \-  N Views \-  AGO \-
CARD = re.compile(
    r"\[!\[\]\((?P<thumb>[^)]+)\)(?P<quality>\d{3,4}p)?(?P<cc>CC)?\]\((?P<watch>https://www\.xvideos\.com/video\.[^)]+)\)"
    r".*?"
    r"\[(?P<title>.+?)\s+(?P<dur>\d+\s*(?:min|sec))\]\((?P=watch)[^)]*\)"
    r".*?"
    r"(?P=dur)\[(?P<channel>[^\]]+)\]\((?P<channel_url>https://www\.xvideos\.com/[^)]+)\)"
    r"\s*\\?-\s*(?P<views>[\d.,]+[KkMm]?)\s*Views\s*\\?-\s*(?P<ago>[^\\]+?)\s*\\?-",
    re.DOTALL,
)

VIDEO_ID = re.compile(r"/video\.([A-Za-z0-9]+)/")


def parse_views(text: str) -> int | None:
    t = text.strip().replace(",", "")
    mult = 1
    if t[-1] in "Kk":
        mult, t = 1_000, t[:-1]
    elif t[-1] in "Mm":
        mult, t = 1_000_000, t[:-1]
    try:
        return int(float(t) * mult)
    except ValueError:
        return None


def parse_duration_seconds(text: str) -> int:
    n, unit = text.split()
    return int(n) * (60 if unit == "min" else 1)


def parse_page(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    md = data["markdown"]
    out = []
    for m in CARD.finditer(md):
        watch = m.group("watch")
        vid = VIDEO_ID.search(watch)
        if not vid:
            continue
        dur = m.group("dur")
        out.append(
            {
                "id": vid.group(1),
                "title": m.group("title").strip().replace("\\|", "|"),
                "watchUrl": watch,
                "embedUrl": f"https://www.xvideos.com/embedframe/{vid.group(1)}",
                "thumbnail": m.group("thumb"),
                "quality": m.group("quality"),
                "duration": dur,
                "durationSeconds": parse_duration_seconds(dur),
                "channel": m.group("channel"),
                "channelUrl": m.group("channel_url"),
                "views": parse_views(m.group("views")),
                "uploadedAgo": m.group("ago").strip(),
            }
        )
    return out


def main() -> None:
    pages = [Path(p) for p in sys.argv[1:-1]]
    out_path = Path(sys.argv[-1])
    videos: list[dict] = []
    seen: set[str] = set()
    for p in pages:
        for v in parse_page(p):
            if v["id"] in seen:
                continue
            seen.add(v["id"])
            videos.append(v)
    json.dump(videos, out_path.open("w"), indent=2)
    print(f"parsed {len(videos)} unique videos from {len(pages)} page(s) -> {out_path}")


if __name__ == "__main__":
    main()
