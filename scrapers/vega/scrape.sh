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
#
# Firecrawl rate-limits requests (10 per minute on the free plan), so requests
# are paced to stay under the limit. Without this, the pages past the tenth are
# rejected outright.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/data/vega_pages}"
URLS="$HERE/vega_urls.txt"
ATTEMPTS=5
RATE_LIMIT="${FIRECRAWL_RATE_LIMIT:-10}"    # requests allowed per window
RATE_WINDOW="${FIRECRAWL_RATE_WINDOW:-60}"  # window length in seconds

if [ -z "${FIRECRAWL_API_KEY:-}" ]; then
  echo "FIRECRAWL_API_KEY is not set" >&2
  exit 1
fi

mkdir -p "$OUT"

# Epoch seconds of the requests made in the current window.
recent=()

# Block until one more request would stay within RATE_LIMIT per RATE_WINDOW.
wait_for_slot() {
  local now t wait kept
  while :; do
    now=$(date +%s)
    kept=()
    for t in ${recent[@]+"${recent[@]}"}; do
      [ $((now - t)) -lt "$RATE_WINDOW" ] && kept+=("$t")
    done
    recent=(${kept[@]+"${kept[@]}"})
    if [ "${#recent[@]}" -lt "$RATE_LIMIT" ]; then
      recent+=("$now")
      return 0
    fi
    t="${recent[0]}"
    wait=$((RATE_WINDOW - (now - t) + 1))
    [ "$wait" -lt 1 ] && wait=1
    echo "  waiting ${wait}s to stay under the Firecrawl rate limit" >&2
    sleep "$wait"
  done
}

count=0
while IFS= read -r url; do
  # Skip blank lines and comments.
  [ -z "$url" ] && continue
  case "$url" in \#*) continue ;; esac

  count=$((count + 1))
  dest="$(printf '%s/p%02d.json' "$OUT" "$count")"
  err="$(mktemp)"

  ok=0
  for attempt in $(seq 1 "$ATTEMPTS"); do
    wait_for_slot
    if firecrawl scrape "$url" -f markdown,links --max-age 0 -o "$dest" 2>"$err"; then
      ok=1
      break
    fi
    msg="$(tail -n 1 "$err" 2>/dev/null || true)"
    echo "  attempt $attempt/$ATTEMPTS failed: $url -- ${msg:-(no output)}" >&2
    # A rate-limit rejection needs a full window to clear; anything else is
    # likely transient and just needs a short pause.
    case "$msg" in
      *[Rr]ate*limit*) sleep "$RATE_WINDOW" ;;
      *) sleep $((attempt * 5)) ;;
    esac
  done
  rm -f "$err"

  if [ "$ok" != "1" ]; then
    echo "scrape failed after $ATTEMPTS attempts: $url" >&2
    exit 1
  fi
  echo "scraped -> $dest"
done < "$URLS"

if [ "$count" = 0 ]; then
  echo "no URLs to scrape in $URLS" >&2
  exit 1
fi

echo "scraped $count page(s) into $OUT"
