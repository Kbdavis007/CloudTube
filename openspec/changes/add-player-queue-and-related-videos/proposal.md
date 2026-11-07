# Proposal

## Why

Watching a video that is not yet in the library leaves the player's **Previous** and
**Next** buttons dead: they walk the saved library, and a search result or catalogue
video the user has not saved is not in it, so the counter reads "Not in Library" and
both buttons are disabled. The owner wants those buttons to walk **the list the video
was played from** — the search results or the catalogue — so watching a run of results
is a click through the list rather than a trip back to the results each time.

The owner also wants a **Related videos** section under the player (about five), so a
video leads on to similar ones without returning to a list.

## What Changes

- Play a video **with its list**: opening a result from search or the catalogue passes
  that (filtered, sorted) list along as a *play queue*. The player's prev/next walk the
  queue, and the counter names it ("Video 2 of 24 in Search results" / "in Catalogue").
  Opening a video from the library keeps walking the library, as before.
- A video reached through the queue — and still unsaved — resolves from the queue, so
  navigation works across a run of unsaved results and saving stays explicit.
- Add a **Related videos** section under the player: up to six videos scored for
  relatedness to the one being watched (shared tag or uploader strongest, same source
  and shared title words next), drawn from the play queue and topped up from the baked
  catalogue, excluding the video itself and its immediate prev/next neighbours. Playing
  one does not save it.
- Add `src/services/relatedVideos.ts` (scoring + selection) and expose the baked
  catalogue mapped once as `VideoMetadata` for use as a fallback pool.

## Capabilities

### New Capabilities

- `video-playback`: what happens while watching a video — navigating to the previous or
  next video in the list it was played from, and being offered related videos.

### Modified Capabilities

_None. No existing spec under `openspec/specs/` states a requirement about the player's
prev/next or about related videos, so nothing existing changes._

## Impact

- **New code**: `src/services/relatedVideos.ts`; `loadBakedCatalogVideos()` in
  `src/services/vegaApi.ts`.
- **Changed code**: `src/App.tsx` (play queue state, queue/related memos, handlers),
  `src/services/playerSelection.ts` (resolve a queued, unsaved video),
  `src/components/views/SelectedVideoPage.tsx` (queue-based prev/next, related section),
  `src/components/views/VideosPage.tsx` (pass the queue/related through),
  `src/components/views/SearchView.tsx` and `VegaSourceView.tsx` (pass their list as the
  queue when playing).
- **Tests**: new `tests/relatedVideos.test.ts`, `tests/e2e/player.spec.ts` and
  `tests/harness/player.html`; added cases in `tests/playerSelection.test.ts` and
  `tests/selectedVideoPage.test.tsx`; `tests/videosPage.test.tsx` updated for the new props.
- **No change** to the Worker API, storage schema, or dependencies.
