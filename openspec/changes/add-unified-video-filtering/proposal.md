# Proposal

## Why

Search, filtering and sorting exist in exactly one place: the saved-library listing
(`VideosPage`). The other two places that show a list of videos — the **Search &
Collect** results (YouTube plus the open sources) and the baked **catalogue** — only
have their own ad-hoc, weaker controls (a source-flag pill row, a single search box).
The owner wants the same capability everywhere: whichever list of videos is on screen,
they should be able to search it, filter it, sort it and page through it the same way.

## What Changes

- Extract the library listing's search / filter / sort / pagination into one shared
  model (`src/services/videoFilter.ts`) and one shared control (`VideoFilterBar`,
  `VideoPagination`).
- Apply that shared control to **all three** video lists: the saved library, the live
  search results, and the baked catalogue. Each list gains the full set — free-text
  search, source, channel, tag, score, rating, duration, published-from/to, and sort —
  plus pagination.
- Keep each list's list-specific bits: the search results keep the personalized
  ranking toggle (as an extra in the bar's header); the catalogue search keeps reaching
  actors and category, which the common video model does not carry, via an
  `extraSearchText` hook.
- The library listing keeps its bulk actions (select page / select all matching,
  favorite, delete) unchanged.

## Capabilities

### New Capabilities

- `video-browsing`: one search / filter / sort / paginate behaviour shared by every
  list of videos in the app, so the controls and their meaning are identical wherever
  videos are shown.

### Modified Capabilities

_None. There are no existing specs under `openspec/specs/` (`add-pr-template` set
`skip_specs: true`; `add-video-editor` adds its own new capabilities), and no existing
capability's requirements change._

## Impact

- **New code**: `src/services/videoFilter.ts` (filter/sort model and helpers),
  `src/components/VideoFilterBar.tsx`, `src/components/VideoPagination.tsx`.
- **Changed code**: `src/components/views/VideosPage.tsx` (library listing now uses the
  shared control; behaviour preserved), `src/components/views/SearchView.tsx` (full
  filtering over results), `src/components/views/VegaSourceView.tsx` (full filtering
  over the catalogue; pagination added).
- **Tests**: new `tests/videoFilter.test.ts` and `tests/vegaSourceView.test.tsx`, an
  added case in `tests/videosPage.test.tsx`, and a new Playwright check
  (`tests/e2e/catalog.spec.ts` with `tests/harness/catalog.html`).
- **No change** to the Worker API, storage schema, or dependencies.
