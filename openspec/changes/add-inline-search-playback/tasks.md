# Tasks

One release. Drop the duplicate source toggles from search, then let a result play
in place in its card while keeping the full player one click away.

## 1. Search uses the Settings source selection

- [x] 1.1 Remove the "Also search:" source chip row from `SearchView` and stop writing the selection from the page; keep reading it and re-reading on change (`searchSources`)
- [x] 1.2 Replace the chip row with a short line naming how many sources will be used and where to change them; surface failed sources as one non-blocking note

## 2. In-place playback on result cards

- [x] 2.1 Add `inlinePlayerEmbedUrl` to `src/services/preview.ts` (source embed, else the full YouTube player); verify with `tests/preview.test.ts`
- [x] 2.2 Extract the result card into `src/components/SearchResultCard.tsx` with per-card play state, a Stop control, and a "Full page" action that opens the full player with the result queue; verify with `tests/searchResultCard.test.tsx`
- [x] 2.3 Move the source-flag badge colours into `src/data/sourceFlagColors.ts` and use them in the card

## 3. Wire and prove

- [x] 3.1 Render the shared card from `SearchView`, passing the queue and label; verify with `tests/searchView.test.tsx`
- [x] 3.2 Add `tests/harness/search.html` and `tests/e2e/search.spec.ts` proving a result plays in place, two play at once, and Full page still opens the player
- [x] 3.3 Verify `npx tsc --noEmit`, `npm test`, `npx vite build` and `npm run e2e` all pass; land the change as a release per `AGENTS.md`
