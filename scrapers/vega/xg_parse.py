#!/usr/bin/env python3
"""Parse scraped xgroovy search pages into video records.

xgroovy is a KVS site: each result on a listing page is a `div.item` carrying the
video id in `data-video-id`, with the title, quality, author, views and duration
as child elements. The listing has no upload date, so the exact `uploadDate` is
read from the video's own page (see xg_dates.py) and merged in here.

The record shape matches vega_parse.py's, so the catalogue builder treats both
sources the same:
    id, title, watchUrl, embedUrl, thumbnail, quality,
    duration, durationSeconds, channel, channelUrl, views, uploadedAgo, publishedDate
"""
import json
import re
import sys
from pathlib import Path

VIDEO_URL = re.compile(r"https://xgroovy\.com/videos/(\d+)/")
UPLOAD_DATE = re.compile(r'"uploadDate":\s*"([^"]+)"')
DURATION = re.compile(r"(\d+)\s*(min|sec)")
VIEWS = re.compile(r"([\d.,]+[KkMm]?)")
ID_IN_URL = re.compile(r"/videos/(\d+)/")


def parse_views(text: str) -> int | None:
    m = VIEWS.search((text or "").replace(",", ""))
    if not m:
        return None
    t = m.group(1)
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
    m = DURATION.search(text or "")
    if not m:
        return None
    return int(m.group(1)) * (60 if m.group(2) == "min" else 1)


def _text(node) -> str:
    return node.get_text(" ", strip=True) if node else ""


def extract_upload_date(html: str) -> str:
    """ISO-8601 upload date from a video page, or "" when absent."""
    m = UPLOAD_DATE.search(html)
    return m.group(1) if m else ""


def listing_video_urls(html: str) -> list[str]:
    """Watch URLs of every card on a listing page, in page order."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    urls = []
    for card in soup.select("div.item[data-video-id]"):
        link = card.select_one("a[href]")
        href = (link.get("href") if link else "") or ""
        if VIDEO_URL.match(href):
            urls.append(href)
    return urls


def _parse_html(html: str, dates: dict[str, str] | None = None) -> list[dict]:
    from bs4 import BeautifulSoup

    dates = dates or {}
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for card in soup.select("div.item[data-video-id]"):
        vid = (card.get("data-video-id") or "").strip()
        if not vid:
            continue
        link = card.select_one("a[href]")
        href = (link.get("href") if link else "") or ""
        if not VIDEO_URL.match(href):
            continue
        title = _text(card.select_one("strong.title")) or (card.select_one("img") or {}).get("alt", "")
        if not title:
            continue

        img = card.select_one("img.thumb") or card.select_one("img")
        thumb = ""
        if img:
            thumb = img.get("data-jpg") or img.get("src") or ""

        quality = _text(card.select_one("span.item-quality"))
        duration = _text(card.select_one("div.duration"))
        author_el = card.select_one("div.author-link a")
        channel = _text(author_el)
        channel_url = author_el.get("href") if author_el and author_el.get("href") else None

        out.append(
            {
                "id": vid,
                "title": title.strip(),
                "watchUrl": f"https://xgroovy.com/videos/{vid}/{href.rstrip('/').rsplit('/', 1)[-1]}/",
                "embedUrl": f"https://xgroovy.com/embed/{vid}",
                "thumbnail": thumb,
                "quality": quality or None,
                "duration": duration,
                "durationSeconds": parse_duration_seconds(duration),
                "channel": channel,
                "channelUrl": channel_url,
                "views": parse_views(_text(card.select_one("div.views"))),
                "uploadedAgo": "",
                "publishedDate": dates.get(vid, ""),
            }
        )
    return out


def parse_page(path: str | Path, dates: dict[str, str] | None = None) -> list[dict]:
    """Parse one saved listing page (raw HTML)."""
    p = Path(path)
    if not p.exists():
        return []
    return _parse_html(p.read_text(encoding="utf-8", errors="replace"), dates)


def load_dates(path: str | Path) -> dict[str, str]:
    """The `{videoId: isoDate}` map written by xg_dates.py, or {} if absent."""
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except ValueError:
        return {}


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
