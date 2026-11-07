# Tasks

One release. Carry the list a video was played from into the player so prev/next walks
it, then add the Related videos section under the player.

## 1. Carry the play queue into the player

- [x] 1.1 Add a play queue to `App.tsx` (`playerQueue`/`queueLabel` state, `handlePlayVideo(video, queue, label)`, `handleNavigateQueue`) and pass `queue`/`queueLabel` to `VideosPage`
- [x] 1.2 Let `resolvePlayerSelection` resolve a queued, unsaved video (`playerSelection.ts`); verify with `tests/playerSelection.test.ts`
- [x] 1.3 Pass the filtered, sorted list as the queue when playing from `SearchView` and `VegaSourceView`; keep the library path unchanged in `VideosPage`

## 2. Prev/next and the queue counter

- [x] 2.1 Make `SelectedVideoPage` walk `queue` for prev/next and label the counter with `queueLabel`; verify the counter and navigation render in `tests/selectedVideoPage.test.tsx`

## 3. Related videos

- [x] 3.1 Add `src/services/relatedVideos.ts` (`relatednessScore`, `rankRelatedVideos`, `findRelatedVideos`) scoring shared uploader/tag, same source, shared title words, similar length, with a same-source top-up; verify with `tests/relatedVideos.test.ts`
- [x] 3.2 Expose the baked catalogue mapped once as `VideoMetadata` (`loadBakedCatalogVideos` in `vegaApi.ts`) for the fallback pool
- [x] 3.3 Build the related list in `App.tsx` (exclude the current video and its prev/next neighbours) and render a Related videos section in `SelectedVideoPage`, playing a related video without saving it

## 4. Proof and release

- [x] 4.1 Add `tests/harness/player.html` and `tests/e2e/player.spec.ts` proving prev/next walks the queue and a related video opens; verify `npm run e2e` passes
- [x] 4.2 Verify `npx tsc --noEmit`, `npm test` and `npx vite build` all pass; land the change as a release per `AGENTS.md`
