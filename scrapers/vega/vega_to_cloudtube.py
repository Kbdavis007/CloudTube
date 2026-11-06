#!/usr/bin/env python3
"""Export the baked video catalogue as a CloudTube library backup.

The baked catalogue (src/data/vegaCatalog.json) is the app's source of truth and
ships inside the build, so this is only for producing a standalone backup file
that can be imported through CloudTube's Settings screen.

Usage: vega_to_cloudtube.py CATALOG.json OUT.jsonc
Also writes a strict-JSON twin (same path, .json) for direct import.
"""
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

NAMESPACE = uuid.NAMESPACE_URL

# CloudTube SourceFlag per catalogue source id (see src/types/index.ts).
FLAG_BY_SOURCE = {
    "vega": "Vega",
    "xgroovy": "XGroovy",
    "justporn": "JustPorn",
    "hornyfap": "HornyFap",
    "yesporn": "YesPorn",
    "xxbrits": "XXBrits",
    "notfans": "NotFans",
    "pornlib": "PornLib",
    "drtuber": "DrTuber",
    "porngo": "PornGo",
    "youjizz": "YouJizz",
    "anysex": "AnySex",
    "alotporn": "AlotPorn",
}


def to_iso_duration(seconds: int) -> str:
    s = max(0, int(seconds))
    h, m, sec = s // 3600, (s % 3600) // 60, s % 60
    out = "PT"
    if h:
        out += f"{h}H"
    if m or h:
        out += f"{m}M"
    out += f"{sec}S"
    return out


def to_video(v: dict, now: str) -> dict:
    key = f"{v['sourceId']}:{v['sourceVideoId']}"
    uploader = (v.get("uploader") or "").strip()
    return {
        "id": str(uuid.uuid5(NAMESPACE, key)),
        "youtubeId": key,
        "title": v["title"],
        "description": v.get("description") or "",
        "tags": v.get("tags") or [],
        "channelId": f"{v['sourceId']}-uploader:{uploader.lower() or 'unknown'}",
        "channelTitle": uploader or "Unknown uploader",
        "publishedAt": v.get("publishedDate") or now,
        "duration": to_iso_duration(v["durationSeconds"]),
        "durationSeconds": v["durationSeconds"],
        "viewCount": v.get("viewCount") or 0,
        "likeCount": 0,
        "commentCount": 0,
        "thumbnails": {
            "default": v["thumbnail"],
            "medium": v["thumbnail"],
            "high": v["thumbnail"],
        },
        "posterUrl": v.get("previewThumbnail") or v["thumbnail"],
        "sourceVideoId": v["sourceVideoId"],
        "playback": {"embedUrl": v["embedUrl"], "externalUrl": v["pageUrl"]},
        "sourceFlags": [FLAG_BY_SOURCE.get(v["sourceId"], "Vega")],
        "indexedAt": now,
        "lastUpdatedAt": now,
        "personal": {
            "videoId": key,
            "indexScore": 50,
            "userRating": 70,
            "userNotes": "",
            "userTags": [f"{FLAG_BY_SOURCE.get(v['sourceId'], 'Vega')}-Imported"],
        },
    }


def to_channels(videos: list[dict], now: str) -> list[dict]:
    by_uploader: dict[str, dict] = {}
    for v in videos:
        name = (v.get("uploader") or "").strip() or "Unknown uploader"
        ch = by_uploader.setdefault(
            name,
            {
                "channelId": f"{v['sourceId']}-uploader:{name.lower() if v.get('uploader') else 'unknown'}",
                "title": name,
                "description": "",
                "publishedAt": now,
                "thumbnail": v["thumbnail"],
                "subscriberCount": 0,
                "videoCount": 0,
                "viewCount": 0,
                "isExpanded": False,
            },
        )
        ch["videoCount"] += 1
        ch["viewCount"] += v.get("viewCount") or 0
    return sorted(by_uploader.values(), key=lambda c: c["videoCount"], reverse=True)


HEADER = """// CloudTube library backup - exported from the baked video catalogue.
// Generated: {generated}
//
// Import through CloudTube -> Settings -> "Keep a backup". The app's own
// catalogue is baked into the build, so this file is only for carrying the same
// videos into another CloudTube instance.
//
// JSONC NOTE: comments are confined to this header; the payload is plain JSON, so
//   strip the leading // lines to JSON.parse, or import the .json twin directly.
"""


def main() -> None:
    catalog_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    catalog = json.loads(catalog_path.read_text())
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    videos = [to_video(v, now) for v in catalog["videos"]]
    channels = to_channels(catalog["videos"], now)

    backup = {
        "version": "1.1.0",
        "exportedAt": now,
        "targetRuntime": "Cloudflare Free Tier (D1/R2/KV)",
        "stats": {
            "videoCount": len(videos),
            "channelCount": len(channels),
            "commentCount": 0,
            "removalCount": 0,
        },
        "data": {
            "videos": videos,
            "channels": channels,
            "comments": [],
            "crawlJobs": [],
            "removals": [],
        },
    }

    payload = json.dumps(backup, indent=2, ensure_ascii=False)
    out_path.write_text(HEADER.format(generated=now) + payload + "\n")
    out_path.with_suffix(".json").write_text(payload + "\n")
    print(f"wrote {out_path} + .json ({len(videos)} videos, {len(channels)} channels)")


if __name__ == "__main__":
    main()
