#!/usr/bin/env bash
# Scrape the search pages listed in vega_urls.txt into data/vega_pages/.
#
#   bash scrapers/vega/scrape.sh [OUTPUT_DIR]
#
# Requires the Firecrawl CLI and FIRECRAWL_API_KEY in the environment. Each URL
# becomes pNN.json, numbered in listing order. Firecrawl's servers do the
# fetching, so the runner's own IP does not matter.
#
# Pages are scraped fresh (--max-age 0) so a run always reflects the live
# listing rather than Firecrawl's cache. A page is retried a few times and the
# run fails if one still cannot be fetched, so a half-scraped catalogue is never
# built from it.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/data/vega_pages}"
URLS="$HERE/vega_urls.txt"
ATTEMPTS=3

if [ -z "${FIRECRAWL_API_KEY:-}" ]; then
  echo "FIRECRAWL_API_KEY is not set" >&2
  exit 1
fi

mkdir -p "$OUT"

count=0
while IFS= read -r url; do
  # Skip blank lines and comments.
  [ -z "$url" ] && continue
  case "$url" in \#*) continue ;; esac

  count=$((count + 1))
  dest="$(printf '%s/p%02d.json' "$OUT" "$count")"

  ok=0
  for attempt in $(seq 1 "$ATTEMPTS"); do
    if firecrawl scrape "$url" -f markdown,links --max-age 0 -o "$dest" >/dev/null 2>&1; then
      ok=1
      break
    fi
    echo "  attempt $attempt/$ATTEMPTS failed: $url" >&2
    sleep $((attempt * 5))
  done

  if [ "$ok" != "1" ]; then
    echo "scrape failed after $ATTEMPTS attempts: $url" >&2
    exit 1
  fi
  echo "scraped -> $dest"
done < "$URLS"

echo "scraped $count page(s) into $OUT"
