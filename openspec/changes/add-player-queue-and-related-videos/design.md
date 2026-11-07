# Design

## Context

`App.tsx` holds the library (`videos`) and the "currently watching" selection. A video
being watched without being saved lives in `ephemeralVideo`; `resolvePlayerSelection`
picks the library copy first, then the ephemeral one. The player's prev/next walk
`allVideos`, which is always the library, so an unsaved video has index -1 and both
buttons are disabled.

Search results and the catalogue each keep their own list locally and, when a video is
played, call `onPlayVideo(video)` with the single video. Nothing carries the surrounding
list up to the player.

The baked catalogue (`src/data/vegaCatalog.json`, ~1,400 records) already ships in the
bundle and is the only large pool of videos the app has at runtime.

## Goals / Non-Goals

**Goals:**
- Prev/next walks the list the video was played from; the counter names that list.
- Navigating within a queue works for unsaved videos and never saves them.
- A Related videos section under the player, filled even when a video has no strong
  matches.
- No new dependencies; the catalogue is not loaded twice.

**Non-Goals:**
- Persisting the queue across a reload (the app already forgets the selected video's
  context; keeping the queue in memory matches that).
- A server-side or machine-learned recommender; relatedness is a local heuristic.
- Changing the library listing's own behaviour.

## Decisions

**Carry the queue as explicit state, not derived from the tab.** `handlePlayVideo` takes
the list and a label and stores them in `playerQueue`/`queueLabel`. Opening from the
library (`handleSelectVideo`) clears the queue, so the player falls back to `videos`.
Alternative: remember the last list rendered by each tab — rejected as more state for the
same result, and it would go stale when a filter changes.

**Resolve a queued video in `resolvePlayerSelection`.** Prev/next only changes
`selectedVideoId`; the target may be unsaved and was never held in `ephemeralVideo`, so
the queue is a third source of truth, checked after the library and the ephemeral video.
This keeps saving explicit while making navigation work.

**Score relatedness from existing metadata.** `relatednessScore` weights a shared
uploader (+5) and a shared tag (+3) most, then same source (+1) and shared title words
(+2), with a similar length as a small nudge that only applies once something else
matched. Alternative: use actors/category from the catalogue — rejected because those
fields are empty in the baked catalogue (all 1,409 records have no actors/category), so
they would never match.

**Top up from the same source, and draw the pool from queue + catalogue.** A video with
no shared tags would otherwise show an empty section. `findRelatedVideos` fills to the
limit with same-source videos. The pool is the play queue plus the baked catalogue
(deduplicated), so even a library video gets catalogue neighbours. `loadBakedCatalogVideos`
maps the catalogue to `VideoMetadata` once and caches it, so 1,400 records are not
re-mapped per render.

**Exclude the current video and its prev/next neighbours.** Those are already one click
away, so the section shows videos the nav buttons do not reach.

**Append a played related video to the queue.** So prev/next keeps working after moving
into the related list, instead of stranding the video outside any list.

## Risks / Trade-offs

- **Relatedness is lexical, not semantic.** Shared words like "the" are filtered by a
  length > 2 rule, but generic tags ("riding pov" appears on every catalogue record) can
  make many videos tie. Ties keep input order, so the section is stable, and the
  same-source top-up keeps it full; a richer signal would need catalogue fields the
  build does not yet capture.
- **The queue is lost on reload**, so a reloaded unsaved video shows "Not in Library"
  with the library as its queue. This matches the existing behaviour of forgetting the
  watched video's context.
- **The catalogue is mapped on first related lookup.** It is a one-time cost and the
  data is already in the bundle, so it adds no network or bundle weight.
