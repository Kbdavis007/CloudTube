#!/usr/bin/env python3
"""Fetch the exact upload date for a source's videos from their own pages.

Most listings in this pipeline carry no exact date, so the date is read from each
video's page and cached to a `{videoId: isoDate}` file. Ids already dated in the
committed catalogue (or the cache) are skipped, so a daily run only fetches the
few that are new. Requests stay at low concurrency with a small delay and retry
on HTTP 429, because several of these sites rate-limit bursts.

Usage:
    engine_dates.py --source SRC --out DATES.json [--known CATALOG.jsonc] LISTING.html ...

The per-source patterns, tried in order, are:

  uploadDate json     "uploadDate": "2026-06-10T23:20:00+02:00"   (kt/KVS sites)
  datePublished json  "datePublished": "2023-05-17T15:34:02Z"
  published label     "Published on 02.05.2025"  (pornlib, DD.MM.YYYY)
  uploadDate date     "uploadDate": "2019-07-09"  (youjizz, date only)
  relative ago        "1 day ago" -> approximated against the run date
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from engine_parse import listing_video_urls  # noqa: E402

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

JSON_UPLOAD = re.compile(r'"uploadDate"\s*:\s*"([^"]+)"')
JSON_PUBLISHED = re.compile(r'"datePublished"\s*:\s*"([^"]+)"')
PUBLISHED_LABEL = re.compile(r"Published on\s+(\d{1,2})[.](\d{1,2})[.](\d{4})", re.I)
AGO = re.compile(r"(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago", re.I)


def _iso(value: str) -> str:
    """Normalise a date-ish string to an ISO-8601 date (YYYY-MM-DD), or ''."""
    value = (value or "").strip()
    if not value:
        return ""
    m = re.match(r"(\d{4}-\d{2}-\d{2})", value)
    if m:
        return m.group(1)
    return ""


def extract_date(html: str, now: datetime) -> str:
    """The best upload date on a video page, or '' when none is present."""
    for pattern in (JSON_UPLOAD, JSON_PUBLISHED):
        m = pattern.search(html)
        if m:
            iso = _iso(m.group(1))
            if iso:
                return iso
    m = PUBLISHED_LABEL.search(html)
    if m:
        day, month, year = m.group(1), m.group(2), m.group(3)
        try:
            return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
        except ValueError:
            pass
    m = AGO.search(html)
    if m:
        n = int(m.group(1))
        unit = m.group(2).lower()
        delta = {
            "minute": timedelta(minutes=n),
            "hour": timedelta(hours=n),
            "day": timedelta(days=n),
            "week": timedelta(weeks=n),
            "month": timedelta(days=30 * n),
            "year": timedelta(days=365 * n),
        }[unit]
        return (now - delta).date().isoformat()
    return ""


def load_known(path: str | None, source_id: str) -> dict[str, str]:
    """Seed dates from the existing catalogue so repeat runs refetch nothing."""
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        return {}
    text = p.read_text(encoding="utf-8")
    payload = "\n".join(l for l in text.splitlines() if not l.lstrip().startswith("//"))
    try:
        data = json.loads(payload)
    except ValueError:
        return {}
    out = {}
    for v in data.get("videos") or []:
        if v.get("sourceId") == source_id and v.get("publishedDate"):
            out[str(v.get("sourceVideoId"))] = v["publishedDate"]
    return out


def fetch_date(url: str, now: datetime, attempts: int = 4) -> str:
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                html = resp.read().decode("utf-8", "replace")
            date = extract_date(html, now)
            if date:
                return date
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 * (attempt + 1))
                continue
        except Exception:
            pass
        time.sleep(1 + attempt)
    return ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--known")
    ap.add_argument("--concurrency", type=int, default=3)
    ap.add_argument("--delay", type=float, default=0.1)
    ap.add_argument("listings", nargs="+")
    args = ap.parse_args()

    now = datetime.now(timezone.utc)
    dates = load_known(args.known, args.source)
    out_path = Path(args.out)
    if out_path.exists():
        try:
            dates.update(json.loads(out_path.read_text(encoding="utf-8")))
        except ValueError:
            pass

    # Collect the watch URL for every id not already dated.
    pending: dict[str, str] = {}
    for listing in args.listings:
        html = Path(listing).read_text(encoding="utf-8", errors="replace")
        for url in listing_video_urls(args.source, html):
            vid = ""
            m = re.search(r"/videos?/(\d+)", url) or re.search(r"-(\d{3,})(?:\.html)?/?$", url)
            if m:
                vid = m.group(1)
            if vid and vid not in dates:
                pending.setdefault(vid, url)

    print(f"{args.source}: {len(dates)} id(s) already dated, {len(pending)} to fetch", file=sys.stderr)

    def work(item):
        vid, url = item
        time.sleep(args.delay)
        return vid, fetch_date(url, now)

    fetched = 0
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        for vid, date in pool.map(work, pending.items()):
            if date:
                dates[vid] = date
                fetched += 1

    out_path.write_text(json.dumps(dates, indent=2, sort_keys=True) + "\n")
    print(f"{args.source}: dated {fetched} new id(s); {len(dates)} total -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
