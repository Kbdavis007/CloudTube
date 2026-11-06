#!/usr/bin/env python3
"""Parse scraped xvideos search pages into video records.

A page is either the raw HTML that `curl` saved (`pNN.html`) or the Firecrawl
JSON that the fallback saved (`pNN.json`). Both carry the same fields; this
module reads whichever it is given and returns the same record shape.

The record shape (consumed by vega_build_manifest.py):
    id, title, watchUrl, embedUrl, thumbnail, quality,
    duration, durationSeconds, channel, channelUrl, views, uploadedAgo
"""
import json
import re
import sys
from pathlib import Path

# --- Raw HTML -----------------------------------------------------------------
# Each result is a `div.thumb-block` whose id encodes the video: `video_<eid>`.

# The listing ships a placeholder in thumbnail URLs and watch paths; the real
# value is any frame number. 1 is stable and always present. The frame segment is
# not part of a video's identity, so watch URLs drop it entirely (see
# vega_build_manifest.canonical_url).
THUMBNUM = re.compile(r"THUMBNUM")
FRAME_SEG = re.compile(r"/THUMBNUM/")
VIDEO_ID = re.compile(r"/video\.([A-Za-z0-9]+)/")
VIDEO_DUR = re.compile(r"(\d+)\s*(min|sec)")


def parse_views(text: str) -> int | None:
    t = text.strip().replace(",", "")
    mult = 1
    if t[-1:] in ("K", "k"):
        mult, t = 1_000, t[:-1]
    elif t[-1:] in ("M", "m"):
        mult, t = 1_000_000, t[:-1]
    try:
        return int(float(t) * mult)
    except ValueError:
        return None


def parse_duration_seconds(text: str) -> int | None:
    m = VIDEO_DUR.search(text or "")
    if not m:
        return None
    return int(m.group(1)) * (60 if m.group(2) == "min" else 1)


def _text(node) -> str:
    return node.get_text(" ", strip=True) if node else ""


def _parse_html(html: str) -> list[dict]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    out = []
    for card in soup.select("div.thumb-block"):
        eid = card.get("data-eid")
        if not eid:
            continue
        link = card.select_one("p.title a")
        title = (link.get("title") if link else None) or _text(link)
        if not title:
            continue
        href = (link.get("href") if link else "") or ""

        thumb_el = card.select_one("img[data-sfwthumb]") or card.select_one("img[data-src]")
        thumb = ""
        if thumb_el:
            thumb = thumb_el.get("data-sfwthumb") or thumb_el.get("data-src") or ""
        thumb = THUMBNUM.sub("1", thumb)

        dur = _text(card.select_one("p.title span.duration"))
        quality = _text(card.select_one("span.video-hd-mark"))
        channel_el = card.select_one("p.metadata a")
        channel = _text(card.select_one("p.metadata span.name"))
        channel_url = (
            f"https://www.xvideos.com{channel_el['href']}" if channel_el and channel_el.get("href") else None
        )

        views = None
        ago = ""
        meta = card.select_one("p.metadata")
        if meta:
            meta_text = meta.get_text(" ", strip=True)
            mv = re.search(r"([\d.,]+[KkMm]?)\s+Views", meta_text)
            if mv:
                views = parse_views(mv.group(1))
            ago_el = meta.select_one("span.text-disabled")
            ago_text = _text(ago_el) if ago_el else meta_text
            ma = re.search(r"([\w\s]+?ago)", ago_text)
            if ma:
                ago = ma.group(1).strip()

        out.append(
            {
                "id": eid,
                "title": title.strip(),
                "watchUrl": f"https://www.xvideos.com{FRAME_SEG.sub('/', href)}",
                "embedUrl": f"https://www.xvideos.com/embedframe/{eid}",
                "thumbnail": thumb,
                "quality": quality or None,
                "duration": dur,
                "durationSeconds": parse_duration_seconds(dur),
                "channel": channel,
                "channelUrl": channel_url,
                "views": views,
                "uploadedAgo": ago,
            }
        )
    return out


# --- Firecrawl markdown -------------------------------------------------------
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


def _parse_markdown(md: str) -> list[dict]:
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


def parse_page(path: str | Path) -> list[dict]:
    """Parse one saved page, raw HTML (`*.html`) or Firecrawl JSON (`*.json`)."""
    p = Path(path)
    if not p.exists():
        return []
    if p.suffix.lower() == ".json":
        data = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(data, dict) and "markdown" in data:
            return _parse_markdown(data["markdown"])
        if isinstance(data, dict):
            return _parse_html(data.get("html") or data.get("rawHtml") or "")
        return []
    return _parse_html(p.read_text(encoding="utf-8", errors="replace"))


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
