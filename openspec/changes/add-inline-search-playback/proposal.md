# Proposal

## Why

Two things about search are redundant or missing now that the shared browsing
controls have landed:

1. The **Search & Collect** page still shows an **"Also search:"** row of source
   chips (Vega, Archive.org, PeerTube, Dailymotion, Aurora, Ember, ...) that
   duplicate the **Settings → Search Sources** picker. They edit the same stored
   preference, so two places set one thing and they can drift in the user's head.
   Search should simply use whatever is enabled in Settings.

2. Every result is behind the **full player page**: to see whether a result is
   worth anything you must open it, then come back. The owner wants to **preview a
   result in place** — press Play on a card and it plays right there in the
   results, with several cards able to play at once — so a run of results can be
   skimmed without leaving the page. The full player stays one click away for a
   proper watch.

## What Changes

- **Remove the per-search source toggles.** The **"Also search:"** chip row goes
  away. Search reads the enabled sources from Settings (it already does, and
  re-reads on change) and shows a short line naming how many it will use and
  where to change them. A failed source is still surfaced, now as a single
  non-blocking note.
- **Play a result in place.** Each result card gets a Play control that swaps the
  thumbnail for the source's own player (a YouTube result uses its embed) inside
  that card. Playback is per-card state, so **more than one result can play at
  once**.
- **Keep the full player reachable.** A card that is playing, and the action row,
  offer **Full page**, which opens the result in the dedicated player exactly as
  before (carrying the whole result list as the play queue). Playing in a card
  never saves; only **Save** does.
- Extract the result card into `src/components/SearchResultCard.tsx`, add
  `inlinePlayerEmbedUrl` to `src/services/preview.ts`, and move the source-flag
  badge colours into one shared `src/data/sourceFlagColors.ts`.

## Capabilities

### New Capabilities

- `video-search`: how a search runs (against the sources enabled in Settings) and
  how a result can be played in place in its card before opening the full player.

### Modified Capabilities

_None. The browsing controls are unchanged; this adds an inline player and drops a
duplicate source toggle. No requirement under `openspec/specs/` describes the
search source toggles or inline playback, so nothing existing changes._

## Impact

- **New code**: `src/components/SearchResultCard.tsx`,
  `src/data/sourceFlagColors.ts`, `inlinePlayerEmbedUrl` in `src/services/preview.ts`.
- **Changed code**: `src/components/views/SearchView.tsx` (drop the chip row, render
  the shared card, surface source failures as a note).
- **Tests**: new `tests/searchResultCard.test.tsx`, `tests/searchView.test.tsx`,
  `tests/e2e/search.spec.ts` and `tests/harness/search.html`; added cases in
  `tests/preview.test.ts`.
- **No change** to the Worker API, storage schema, or dependencies. The enabled-source
  preference and its storage format are unchanged; only the on-page editor is removed.
