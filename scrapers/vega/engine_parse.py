#!/usr/bin/env python3
"""Parse scraped search pages from the additional tube sources.

Every parser here returns the same record shape as vega_parse.py / xg_parse.py,
so the catalogue builder treats all sources identically:

    id, title, watchUrl, embedUrl, thumbnail, quality,
    duration, durationSeconds, channel, channelUrl, views, uploadedAgo, publishedDate

The sources fall into a few engine families that share markup:

  kt_kvs    a "kt_player" card: `div.thumb...item` with `a[href]` -> /video/<id>/,
            `div.time`, `div.title`, an optional relative date in the card, and an
            embed at /embed/<id>.
  kvs_alt   the same shape under a different container class (hornyfap / notfans /
            xxbrits / youjizz), `strong.title`, `div.duration` or `span`, embed at
            /embed/<id> (youjizz uses /videos/embed/<id>).
  pornlib   `div.th[data-video_id]`, relative `/video/<slug>-<id>` link, duration
            in `span.by`, embed at /embed/<id>.
  drtuber   `a.th` card, `/video/<id>/<slug>` link, duration in `em.time_thumb`,
            embed at /embed/<id>.
  porngo    `div.thumb.item`, `a.thumb__top[href]` -> /videos/<id>/<slug>, duration
            in `span.thumb__duration`, views in `.thumb__text`, embed at /embed/<id>.
  anysex    `div.item[data-video-id]`, `strong.title`, `div.duration`, views in
            `div.views`, embed at /embed/<id>.

Listing pages rarely carry a date, so the exact `uploadDate` is read from each
video's own page (see engine_dates.py) and merged in here via `publishedDate`.
"""
import re
import sys
from pathlib import Path

DURATION = re.compile(r"(\d+):(\d{2})(?::(\d{2}))?")
AGO = re.compile(r"(\d+\s*(?:minute|hour|day|week|month|year)s?\s*ago)", re.I)
VIEWS = re.compile(r"([\d.,]+\s*[KkMm]?)")
NUM_IN_URL = re.compile(r"(\d{3,})")
UPLOAD_DATE = re.compile(r'"uploadDate"\s*:\s*"([^"]+)"')


def parse_duration_seconds(text: str) -> int | None:
    m = DURATION.search(text or "")
    if not m:
        return None
    h, mnt, sec = m.group(1), m.group(2), m.group(3)
    if sec is not None:
        return int(h) * 3600 + int(mnt) * 60 + int(sec)
    return int(h) * 60 + int(mnt)


def parse_views(text: str) -> int | None:
    """'5.9K', '3.1m views', '144K views' -> an int."""
    m = VIEWS.search((text or "").replace(",", ""))
    if not m:
        return None
    t = m.group(1).strip()
    mult = 1
    if t[-1:] in ("K", "k"):
        mult, t = 1_000, t[:-1]
    elif t[-1:] in ("M", "m"):
        mult, t = 1_000_000, t[:-1]
    try:
        return int(float(t) * mult)
    except ValueError:
        return None


def _text(node) -> str:
    return node.get_text(" ", strip=True) if node else ""


def _first_url(card, pattern: re.Pattern) -> str:
    # The card itself may be the anchor (drtuber's `a.th`).
    if getattr(card, "name", None) == "a":
        href = card.get("href") or ""
        if pattern.search(href):
            return href
    for a in card.select("a[href]"):
        href = a.get("href") or ""
        if pattern.search(href):
            return href
    return ""


def _video_id(url: str) -> str:
    """The source-native id inside a watch URL, across every site's URL shape."""
    m = re.search(r"/videos?/(\d+)(?:/|$)", url)
    if m:
        return m.group(1)
    m = re.search(r"-(\d{3,})\.html", url)          # youjizz
    if m:
        return m.group(1)
    m = re.search(r"-(\d{3,})/?$", url)             # pornlib
    if m:
        return m.group(1)
    return ""


def _abs(url: str, host: str) -> str:
    """Make a URL absolute: `//x` -> https, `/x` -> https://host/x."""
    if not url:
        return url
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return f"https://{host}{url}"
    return url


def _thumb(img, host: str = "") -> str:
    """Best thumbnail on an <img>, skipping lazy-load placeholders."""
    if not img:
        return ""
    for key in ("data-original", "data-webp", "data-jpg", "src"):
        v = img.get(key) or ""
        if v and not v.startswith("data:") and "spacer" not in v and "blank" not in v:
            return _abs(v, host)
    return _abs(img.get("src") or "", host)


def extract_upload_date(html: str) -> str:
    """ISO-8601 upload date from a video page, or "" when absent."""
    m = UPLOAD_DATE.search(html)
    return m.group(1) if m else ""


# ---------------------------------------------------------------------------
# Per-engine card parsers. Each takes a BeautifulSoup card node plus the page
# host and returns a record dict (or None when the card is not a real video).
# ---------------------------------------------------------------------------

def _kt_kvs(card, host: str, dates: dict[str, str]) -> dict | None:
    """justporn / yesporn / alotporn: div.thumb.thumb_rel.item, kt_player."""
    href = _first_url(card, re.compile(r"/video/\d+/"))
    if not href:
        return None
    vid = _video_id(href)
    if not vid:
        return None
    title = _text(card.select_one("div.title")) or (card.select_one("img") or {}).get("alt", "")
    thumb = _thumb(card.select_one("img"), host)
    duration = _text(card.select_one("div.time"))
    quality = _text(card.select_one("span.qualtiy")) or _text(card.select_one("span.item-quality"))
    # views is the first thumb-item (an eye icon), date the .thumb-item-date
    views_text = ""
    for item in card.select(".thumb-item"):
        if "thumb-item-date" in (item.get("class") or []):
            continue
        views_text = _text(item)
        break
    ago = _text(card.select_one(".thumb-item-date"))
    return {
        "id": vid,
        "title": title.strip(),
        "watchUrl": _abs(href, host),
        "embedUrl": f"https://{host}/embed/{vid}",
        "thumbnail": thumb,
        "quality": quality or None,
        "duration": duration,
        "durationSeconds": parse_duration_seconds(duration),
        "channel": "",
        "channelUrl": None,
        "views": parse_views(views_text),
        "uploadedAgo": ago,
        "publishedDate": dates.get(vid, ""),
    }


def _kvs_alt(card, host: str, dates: dict[str, str], *, embed_path: str,
             url_re: str, duration_sel: str, title_sel: str = "strong.title") -> dict | None:
    """hornyfap / notfans / youjizz: div.item / div.video-thumb.

    hornyfap adds `div.added em` (relative date) and `div.views`; notfans shows
    neither; youjizz carries neither on the card either (date comes from the
    detail page).
    """
    href = _first_url(card, re.compile(url_re))
    if not href:
        return None
    vid = _video_id(href)
    if not vid:
        return None
    title = _text(card.select_one(title_sel)) or (card.select_one("img") or {}).get("alt", "")
    thumb = _thumb(card.select_one("img"), host)
    duration = _text(card.select_one(duration_sel))
    quality = _text(card.select_one("span.is-hd")) or _text(card.select_one("span.quality"))
    ago = _text(card.select_one("div.added"))
    if not AGO.search(ago):
        ago = ""
    views_sel = card.select_one("div.views") or card.select_one("span.views")
    return {
        "id": vid,
        "title": title.strip(),
        "watchUrl": _abs(href, host),
        "embedUrl": f"https://{host}{embed_path.format(id=vid)}",
        "thumbnail": thumb,
        "quality": quality or None,
        "duration": duration,
        "durationSeconds": parse_duration_seconds(duration),
        "channel": "",
        "channelUrl": None,
        "views": parse_views(_text(views_sel)) if views_sel else None,
        "uploadedAgo": ago,
        "publishedDate": dates.get(vid, ""),
    }


def _xxbrits(card, host: str, dates: dict[str, str]) -> dict | None:
    """xxbrits: div.th with a card-image link, bottom-panel duration, list boxes."""
    href = _first_url(card, re.compile(r"/videos/\d+/"))
    if not href:
        return None
    vid = _video_id(href)
    if not vid:
        return None
    img = card.select_one("img")
    thumb = _thumb(img, host)
    title = (img or {}).get("alt", "") or _text(card.select_one("a.title"))
    duration = _text(card.select_one("div.bottom-panel div.group div.box span"))
    quality = _text(card.select_one("div.bottom-panel div.group div.box.second span"))
    boxes = [_text(b) for b in card.select("ul.list li.box")]
    ago = next((b for b in boxes if AGO.search(b)), "")
    views_text = next((b for b in boxes if re.search(r"\d", b) and not AGO.search(b)), "")
    return {
        "id": vid,
        "title": title.strip(),
        "watchUrl": _abs(href, host),
        "embedUrl": f"https://{host}/embed/{vid}",
        "thumbnail": thumb,
        "quality": quality or None,
        "duration": duration,
        "durationSeconds": parse_duration_seconds(duration),
        "channel": "",
        "channelUrl": None,
        "views": parse_views(views_text),
        "uploadedAgo": ago,
        "publishedDate": dates.get(vid, ""),
    }


def _pornlib(card, host: str, dates: dict[str, str]) -> dict | None:
    vid = (card.get("data-video_id") or "").strip()
    if not vid:
        return None
    href = _first_url(card, re.compile(r"/video/"))
    if not href:
        return None
    img = card.select_one("img")
    thumb = _thumb(img, host)
    title = _text(card.select_one("span.title")) or (img or {}).get("alt", "")
    duration = _text(card.select_one("span.by"))
    quality = "HD" if card.select_one("span.quality") else None
    return {
        "id": vid,
        "title": title.strip(),
        "watchUrl": _abs(href, host),
        "embedUrl": f"https://{host}/embed/{vid}",
        "thumbnail": thumb,
        "quality": quality,
        "duration": duration,
        "durationSeconds": parse_duration_seconds(duration),
        "channel": "",
        "channelUrl": None,
        "views": None,
        "uploadedAgo": "",
        "publishedDate": dates.get(vid, ""),
    }


def _drtuber(card, host: str, dates: dict[str, str]) -> dict | None:
    href = _first_url(card, re.compile(r"/video/\d+"))
    if not href:
        return None
    vid = (card.get("data-video_id") or "").strip() or _video_id(href)
    if not vid:
        return None
    img = card.select_one("img")
    thumb = _thumb(img, host)
    title = (img or {}).get("alt", "") or _text(card.select_one("span"))
    duration = _text(card.select_one("em.time_thumb"))
    quality = "HD" if card.select_one("i.ico_hd") else None
    return {
        "id": vid,
        "title": title.strip(),
        "watchUrl": _abs(href, host),
        "embedUrl": f"https://{host}/embed/{vid}",
        "thumbnail": thumb,
        "quality": quality,
        "duration": duration,
        "durationSeconds": parse_duration_seconds(duration),
        "channel": "",
        "channelUrl": None,
        "views": None,
        "uploadedAgo": "",
        "publishedDate": dates.get(vid, ""),
    }


def _porngo(card, host: str, dates: dict[str, str]) -> dict | None:
    a = card.select_one("a.thumb__top[href]") or card.select_one("a[href]")
    href = (a.get("href") if a else "") or ""
    if not re.search(r"/videos/\d+/", href):
        return None
    vid = _video_id(href)
    if not vid:
        return None
    img = card.select_one("img")
    thumb = _thumb(img, host)
    title = _text(card.select_one("div.thumb__title")) or (img or {}).get("alt", "")
    duration = _text(card.select_one("span.thumb__duration"))
    quality = _text(card.select_one("span.thumb__bage"))
    views_text = " ".join(_text(b) for b in card.select("span.thumb__text"))
    return {
        "id": vid,
        "title": title.strip(),
        "watchUrl": _abs(href, host),
        "embedUrl": f"https://{host}/embed/{vid}",
        "thumbnail": thumb,
        "quality": quality or None,
        "duration": duration,
        "durationSeconds": parse_duration_seconds(duration),
        "channel": "",
        "channelUrl": None,
        "views": parse_views(views_text),
        "uploadedAgo": "",
        "publishedDate": dates.get(vid, ""),
    }


def _anysex(card, host: str, dates: dict[str, str]) -> dict | None:
    vid = (card.get("data-video-id") or "").strip()
    if not vid:
        return None
    a = card.select_one("a[href]")
    href = (a.get("href") if a else "") or ""
    img = card.select_one("img")
    thumb = _thumb(img, host)
    title = _text(card.select_one("strong.title")) or (img or {}).get("alt", "")
    duration = _text(card.select_one("div.duration"))
    quality = _text(card.select_one("span.item-quality"))
    return {
        "id": vid,
        "title": title.strip(),
        "watchUrl": _abs(href, host) or f"https://{host}/video/{vid}/",
        "embedUrl": f"https://{host}/embed/{vid}",
        "thumbnail": thumb,
        "quality": quality or None,
        "duration": duration,
        "durationSeconds": parse_duration_seconds(duration),
        "channel": "",
        "channelUrl": None,
        "views": parse_views(card.get("data-views") or _text(card.select_one("div.views"))),
        "uploadedAgo": "",
        "publishedDate": dates.get(vid, ""),
    }


# source id -> (card selector, parser)
ENGINES = {
    "justporn": ("div.thumb.thumb_rel.item", lambda c, h, d: _kt_kvs(c, h, d)),
    "yesporn": ("div.thumb.thumb_rel.item", lambda c, h, d: _kt_kvs(c, h, d)),
    "alotporn": ("div.thumb.thumb_rel.item", lambda c, h, d: _kt_kvs(c, h, d)),
    "hornyfap": ("div.item", lambda c, h, d: _kvs_alt(
        c, h, d, embed_path="/embed/{id}", url_re=r"/video/\d+/", duration_sel="div.duration")),
    "notfans": ("div.item", lambda c, h, d: _kvs_alt(
        c, h, d, embed_path="/embed/{id}", url_re=r"/videos/\d+/", duration_sel="div.duration")),
    "xxbrits": ("div.th", lambda c, h, d: _xxbrits(c, h, d)),
    "youjizz": ("div.video-thumb", lambda c, h, d: _kvs_alt(
        c, h, d, embed_path="/videos/embed/{id}", url_re=r"/videos/[^/]+\.html",
        duration_sel="span.time", title_sel="div.video-title")),
    "pornlib": ("div.th[data-video_id]", lambda c, h, d: _pornlib(c, h, d)),
    "drtuber": ("a.th[href*='/video/']", lambda c, h, d: _drtuber(c, h, d)),
    "porngo": ("div.thumb.item", lambda c, h, d: _porngo(c, h, d)),
    "anysex": ("div.item[data-video-id]", lambda c, h, d: _anysex(c, h, d)),
}

# The canonical host for each source, so relative links and embed URLs are built
# against the right domain even when the card carries only a relative href.
HOST_BY_SOURCE = {
    "justporn": "www.justporn.com",
    "yesporn": "yesporn.vip",
    "alotporn": "www.alotporn.com",
    "hornyfap": "hornyfap.tv",
    "notfans": "notfans.com",
    "xxbrits": "www.xxbrits.com",
    "youjizz": "www.youjizz.com",
    "pornlib": "www.pornlib.com",
    "drtuber": "www.drtuber.com",
    "porngo": "www.porngo.com",
    "anysex": "anysex.com",
}

# The results grid, so unrelated cards elsewhere on the page (sidebar "related",
# promos) are not parsed. None means the card selector is already unique.
RESULTS_SELECTOR = {
    "justporn": "#list_videos_videos_list_search_result_items",
    "yesporn": "#list_videos_videos_list_search_result_items",
    "alotporn": "#list_videos_videos_list_search_result_items",
    "hornyfap": "#list_videos_videos_list_search_result_items",
    "notfans": "#list_videos_videos_list_search_result_items",
    "xxbrits": "#list_videos_videos_list_search_result_items",
    "porngo": "#list_videos_videos_list_search_result_items",
    "pornlib": "div.thumbs.result",
    "drtuber": "#search_results",
    "anysex": "#list_videos_custom_videos_search_result_items",
}


def _cards(source_id: str, soup):
    sel, _ = ENGINES[source_id]
    scope = RESULTS_SELECTOR.get(source_id)
    if scope:
        container = soup.select_one(scope)
        if container is not None:
            return container.select(sel)
    return soup.select(sel)


def listing_video_urls(source_id: str, html: str) -> list[str]:
    """Watch URLs of every card on a listing page, in page order."""
    from bs4 import BeautifulSoup

    host = HOST_BY_SOURCE[source_id]
    soup = BeautifulSoup(html, "html.parser")
    urls = []
    for card in _cards(source_id, soup):
        href = _first_url(card, re.compile(r"/(?:video|videos)/"))
        if href:
            urls.append(href if href.startswith("http") else f"https://{host}{href}")
    return urls


def _parse_html(source_id: str, html: str, dates: dict[str, str] | None = None) -> list[dict]:
    from bs4 import BeautifulSoup

    dates = dates or {}
    _, parse = ENGINES[source_id]
    host = HOST_BY_SOURCE[source_id]
    soup = BeautifulSoup(html, "html.parser")
    out = []
    seen = set()
    for card in _cards(source_id, soup):
        rec = parse(card, host, dates)
        if not rec or not rec["title"] or rec["id"] in seen:
            continue
        seen.add(rec["id"])
        out.append(rec)
    return out


def parse_page(source_id: str, path: str | Path, dates: dict[str, str] | None = None) -> list[dict]:
    p = Path(path)
    if not p.exists():
        return []
    return _parse_html(source_id, p.read_text(encoding="utf-8", errors="replace"), dates)


if __name__ == "__main__":
    import json

    sid = sys.argv[1]
    pages = [Path(p) for p in sys.argv[2:-1]]
    out_path = Path(sys.argv[-1])
    videos: list[dict] = []
    seen: set[str] = set()
    for p in pages:
        for v in parse_page(sid, p):
            if v["id"] in seen:
                continue
            seen.add(v["id"])
            videos.append(v)
    json.dump(videos, out_path.open("w"), indent=2)
    print(f"parsed {len(videos)} {sid} videos from {len(pages)} page(s) -> {out_path}")
