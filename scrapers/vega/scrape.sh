#!/usr/bin/env bash
# Fetch the search pages listed in a URL file into an output directory.
#
#   bash scrapers/vega/scrape.sh [OUTPUT_DIR] [URLS_FILE]
#
# Defaults to the Vega pages (data/vega_pages, vega_urls.txt); pass a different
# pair for another source, e.g. data/xgroovy_pages xgroovy_urls.txt.
#
# Each URL becomes pNN.html. curl is tried first with a browser User-Agent; if a
# page comes back blocked or without any results, it is re-fetched through the
# Firecrawl CLI and the rest of the run switches to Firecrawl too. curl has no
# request limit and needs no key, so it is the default path; Firecrawl's free
# plan allows 10 requests/minute, so requests are paced while that mode is on.
#
# The run fails if a page cannot be fetched by either backend, so a partial
# catalogue is never built from it.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/data/vega_pages}"
URLS="${2:-$HERE/vega_urls.txt}"
ATTEMPTS=3
CURL_GAP=1
FC_RATE_LIMIT="${FIRECRAWL_RATE_LIMIT:-10}"    # requests allowed per window
FC_RATE_WINDOW="${FIRECRAWL_RATE_WINDOW:-60}"  # window length in seconds
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

mkdir -p "$OUT"

# Starts on curl; flips to firecrawl for the rest of the run once curl is unusable.
backend=curl

have_firecrawl() {
  command -v firecrawl >/dev/null 2>&1 && [ -n "${FIRECRAWL_API_KEY:-}" ]
}

# A usable page is a results listing: xvideos uses `div id="video_<eid>"` cards,
# xgroovy uses `data-video-id` attributes. Either marker means the page rendered.
looks_like_results() {
  grep -q -e 'div id="video_' -e 'data-video-id="' "$1" 2>/dev/null
}

curl_fetch() {  # url dest
  local url=$1 dest=$2 code
  if ! code=$(curl -sSL -A "$UA" -H 'Accept-Language: en-US,en;q=0.9' \
        --max-time 45 -o "$dest.tmp" -w '%{http_code}' "$url" 2>/dev/null); then
    echo "  curl: network error for $url" >&2
    rm -f "$dest.tmp"
    return 1
  fi
  if [ "$code" = "200" ] && looks_like_results "$dest.tmp"; then
    mv "$dest.tmp" "$dest"
    return 0
  fi
  echo "  curl: $url -> http $code, $(wc -c <"$dest.tmp" 2>/dev/null || echo 0) bytes, no result cards" >&2
  rm -f "$dest.tmp"
  return 1
}

# Epoch seconds of the Firecrawl requests made in the current window.
fc_recent=()
fc_wait_for_slot() {
  local now t wait kept
  while :; do
    now=$(date +%s)
    kept=()
    for t in ${fc_recent[@]+"${fc_recent[@]}"}; do
      [ $((now - t)) -lt "$FC_RATE_WINDOW" ] && kept+=("$t")
    done
    fc_recent=(${kept[@]+"${kept[@]}"})
    if [ "${#fc_recent[@]}" -lt "$FC_RATE_LIMIT" ]; then
      fc_recent+=("$now")
      return 0
    fi
    t="${fc_recent[0]}"
    wait=$((FC_RATE_WINDOW - (now - t) + 1))
    [ "$wait" -lt 1 ] && wait=1
    echo "  firecrawl: waiting ${wait}s to stay under the rate limit" >&2
    sleep "$wait"
  done
}

firecrawl_fetch() {  # url dest
  local url=$1 dest=$2 err
  err="$(mktemp)"
  fc_wait_for_slot
  if firecrawl scrape "$url" -H --max-age 0 -o "$dest" 2>"$err" && looks_like_results "$dest"; then
    rm -f "$err"
    return 0
  fi
  echo "  firecrawl: $url failed -- $(tail -n 1 "$err" 2>/dev/null || echo 'no output')" >&2
  rm -f "$err"
  return 1
}

count=0
failed=0
while IFS= read -r url; do
  # Skip blank lines and comments.
  [ -z "$url" ] && continue
  case "$url" in \#*) continue ;; esac

  count=$((count + 1))
  dest="$(printf '%s/p%02d.html' "$OUT" "$count")"

  ok=0
  for attempt in $(seq 1 "$ATTEMPTS"); do
    if [ "$backend" = curl ]; then
      if curl_fetch "$url" "$dest"; then ok=1; break; fi
      if have_firecrawl; then
        echo "  curl is not returning results; switching to Firecrawl for the rest of the run" >&2
        backend=firecrawl
      else
        echo "  curl failed and Firecrawl is unavailable (no CLI or FIRECRAWL_API_KEY)" >&2
        sleep $((attempt * CURL_GAP))
        continue
      fi
    fi
    if firecrawl_fetch "$url" "$dest"; then ok=1; break; fi
    sleep $((attempt * 5))
  done

  if [ "$ok" != "1" ]; then
    echo "scrape failed after $ATTEMPTS attempts by both backends: $url" >&2
    failed=$((failed + 1))
    continue
  fi
  echo "scraped ($backend) -> $dest"
done < "$URLS"

if [ "$count" = 0 ]; then
  echo "no URLs to scrape in $URLS" >&2
  exit 1
fi
if [ "$failed" != "0" ]; then
  echo "$failed of $count page(s) could not be fetched; refusing to build a partial catalogue" >&2
  exit 1
fi

echo "scraped $count page(s) into $OUT (last backend: $backend)"
