# Design

## Context

See `proposal.md` — Why. The constraints that shape this design:

- Three views list videos: `VideosPage` (saved library, the richest controls today),
  `SearchView` (YouTube + open sources, with a source-flag pill row and a personalized
  ranking toggle), and `VegaSourceView` (the baked catalogue, with a single search box).
- The three lists already share the `VideoMetadata` model, so one filter model can serve
  all of them. The catalogue additionally carries `actors` and `category`, which
  `VideoMetadata` does not expose.
- `VegaSourceView` renders catalogue records; the store key is `sourceId:sourceVideoId`
  and can repeat (the same video is listed under more than one slug; the catalogue is
  deduped by canonical page URL, not by id).
- Verification is `npx tsc --noEmit` + `npm test` + `npx vite build`, with Playwright
  for browser proof. Every push is a release (`AGENTS.md`).

## Goals / Non-Goals

**Goals**

- One filter/sort model and one control, used by all three lists, so they cannot drift.
- Preserve each list's existing behaviour: the library's bulk actions, the search
  results' personalized ranking, the catalogue's actors/category search.
- Keep the change a pure refactor-plus-wiring: no Worker, storage, or dependency changes.

**Non-Goals**

- Changing the personalization algorithm, scoring, or taste profile.
- A saved/persisted filter state across reloads (filters reset per list, per visit).
- Virtualized rendering; pagination already bounds the rendered card count.

## Decisions

- **One `VideoFilterState` and one `filterAndSortVideos` in `src/services/videoFilter.ts`.**
  The library listing already had this logic inline; extracting it makes the other two
  lists behave identically for free. *Alternatives:* duplicate the logic per view (drifts,
  and is what produced the inconsistency); a hook returning filtered rows (harder to unit
  test the pure logic).
- **`extraSearchText` option on the matcher.** The catalogue's actors/category search is
  the one list-specific extra. A per-video callback keeps the shared matcher pure and lets
  the catalogue pass the fields its records carry, instead of widening `VideoMetadata`.
- **Shared `VideoFilterBar` with a `headerExtra` slot.** The search view keeps its
  personalized-ranking toggle by rendering it into the bar's header, rather than the bar
  knowing about ranking.
- **Free-text search matches every term** (AND across whitespace-separated tokens). This
  is what the catalogue search already did and is the more useful default; the library's
  old whole-string `includes` was strictly weaker.
- **React key uses the canonical page URL** in the catalogue, because the store key can
  repeat. The store key still drives the "In Library" lookup.
- **Pagination is a plain slice** (`paginate`) with a clamped page, shared by all three
  lists; the library keeps its 24-per-page size, the catalogue and search results adopt it.

## Risks / Trade-offs

- **Behaviour change on the library listing:** search now ANDs terms instead of matching
  the whole string. This is a small, deliberate improvement; a single-term search is
  unaffected.
- **More controls on the search and catalogue views.** Acceptable: they are the same
  controls the library already shows, and they collapse behind the same layout.
