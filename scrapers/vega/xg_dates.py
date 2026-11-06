#!/usr/bin/env python3
"""Fetch the exact upload date for xgroovy videos from their own pages.

xgroovy listing pages carry no upload date, so the date is read from each
video's page (embedded `uploadDate`). Requests are kept at a low concurrency
with a small delay and retried on HTTP 429, because xgroovy rate-limits bursts.

Usage:
    xg_dates.py --out DATES.json [--known CATALOG.jsonc] LISTING.html ...

Reads the watch URLs from the listing pages, skips any id already present in
`--known` (the existing catalogue) or in the output file, fetches the rest, and
writes `{videoId: isoDate}` to --out.
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from xg_parse import extract_upload_date, listing_video_urls  # noqa: E402

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
ID_IN_URL = re.compile(r"/videos/(\d+)/")


def load_known(path: str | None) -> dict[str, str]:
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
        if v.get("sourceId") == "xgroovy" and v.get("publishedDate"):
            out[str(v.get("sourceVideoId"))] = v["publishedDate"]
    return out


def fetch_date(url: str, attempts: int = 4) -> str:
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                html = resp.read().decode("utf-8", "replace")
            date = extract_upload_date(html)
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
    ap.add_argument("--out", required=True)
    ap.add_argument("--known")
    ap.add_argument("--concurrency", type=int, default=2)
    ap.add_argument("--delay", type=float, default=0.15)
    ap.add_argument("listings", nargs="+")
    args = ap.parse_args()

    dates = load_known(args.known)
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
        for url in listing_video_urls(html):
            m = ID_IN_URL.search(url)
            if m and m.group(1) not in dates:
                pending.setdefault(m.group(1), url)

    print(f"{len(dates)} id(s) already dated, {len(pending)} to fetch", file=sys.stderr)

    def work(item):
        vid, url = item
        time.sleep(args.delay)
        return vid, fetch_date(url)

    fetched = 0
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        for vid, date in pool.map(work, pending.items()):
            if date:
                dates[vid] = date
                fetched += 1

    out_path.write_text(json.dumps(dates, indent=2, sort_keys=True) + "\n")
    print(f"dated {fetched} new id(s); {len(dates)} total -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
