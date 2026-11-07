# Tasks

One release. Extract the shared browsing model and control, move the library listing onto
it without changing behaviour, then apply it to the search results and the catalogue.

## 1. Shared model and control

- [x] 1.1 Add `src/services/videoFilter.ts` with `VideoFilterState`, `DEFAULT_VIDEO_FILTERS`, `hasActiveVideoFilters`, `collect{Source,Channel,Tag}Options`, `matchesVideoFilters` (with an `extraSearchText` hook), `filterAndSortVideos`, `sortVideos` and `paginate`; verify with `tests/videoFilter.test.ts`
- [x] 1.2 Add `src/components/VideoFilterBar.tsx` (search + source/channel/tag/score/rating/duration/date + sort, with a `headerExtra` slot) and `src/components/VideoPagination.tsx` (first/prev/next/last, hidden on one page)

## 2. Move the library listing onto the shared control

- [x] 2.1 Replace `VideosPage`'s inline filter state, option collection, filter/sort and pagination with the shared model and components, keeping its bulk actions and page size; verify `tests/videosPage.test.tsx` still passes and the listing renders the shared bar

## 3. Apply the shared control to the other two lists

- [x] 3.1 Apply the shared bar and pagination to `SearchView`, keeping the personalized-ranking toggle as a header extra and resetting filters on a fresh search; verify the results render the shared controls
- [x] 3.2 Apply the shared bar and pagination to `VegaSourceView`, wiring `extraSearchText` so the search still reaches actors and category, and keying cards by canonical page URL; verify with `tests/vegaSourceView.test.tsx`

## 4. Proof and release

- [x] 4.1 Add `tests/harness/catalog.html` and `tests/e2e/catalog.spec.ts` driving search, sort, pagination and clear on the catalogue; verify `npm run e2e` passes
- [x] 4.2 Verify `npx tsc --noEmit`, `npm test` and `npx vite build` all pass; land the change as a release per `AGENTS.md`
