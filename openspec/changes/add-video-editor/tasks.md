# Tasks

Phases are ordered by dependency and each is independently shippable as a release
(`AGENTS.md`: every push is a release). Finish a phase, verify it, and land it before
starting the next.

## 1. Editor view and trim + combine (local files)

Delivers `video-editor` (local file, trim, reorder, preview, on-device) and the first
half of `video-export` (export the timeline as one file).

- [x] 1.1 Add the `mediabunny` dependency and verify `bun install` succeeds and `npx tsc --noEmit` still passes
- [x] 1.2 Add `src/services/videoEditor.ts` wrapping Mediabunny: load a local file, read duration/resolution, and assemble trimmed clips into one file; verify with unit tests in `tests/videoEditor.test.ts` that a two-clip timeline yields one file whose duration equals the sum of the trimmed spans
- [x] 1.3 Add the `editor` tab to `PageTab` in `src/components/Sidebar.tsx`, `PERSISTED_TABS` in `src/services/viewState.ts`, and the switch in `src/App.tsx`; verify the tab appears and the view renders after a reload
- [x] 1.4 Build `src/components/views/EditorView.tsx` with `src/components/editor/`: a file picker, a clip list, trim in/out handles that stop before crossing, and drag-to-reorder; verify each interaction with a unit test and a Playwright check
- [x] 1.5 Add an assembled-timeline preview that plays clips in order within their trims and updates after an edit; verify with a Playwright check that a trimmed two-clip timeline plays in order
- [x] 1.6 Reject a file the browser cannot decode with a named error and no clip added; verify with a unit test feeding an unsupported file
- [x] 1.7 Add the export action (single MP4 download) and verify a two-clip export downloads a file whose duration matches the trimmed sum; assert no request to the app's server carries media bytes
- [x] 1.8 Document the editor (what it does, and that iframe sources like YouTube are not editable) in `AGENTS.md`; verify the described steps match the shipped UI

## 2. Export options, progress and failure handling

Completes `video-export` for container/resolution, progress/cancel and failure.

- [ ] 2.1 Add container and resolution controls, defaulting to MP4 at the highest clip resolution; verify a chosen container/resolution appears in the produced file (unit test on the output metadata)
- [ ] 2.2 Show export progress and support cancel, leaving no download and an unchanged timeline; verify with a Playwright check that cancel produces no download
- [ ] 2.3 On export failure, offer no partial file and keep the timeline for retry; verify with a unit test that forces an encode error
- [ ] 2.4 Add unit tests for the empty-timeline export refusal; verify `npm test` passes
- [ ] 2.5 Update the editor docs with the export options; verify the documented options match the UI

## 3. Direct-URL clips and recent exports

Completes `video-editor` (direct media URL) and `video-export` (record recent exports).

- [ ] 3.1 Add a direct media URL input that adds a clip only for a readable media response; verify with unit tests for a media file, an embedded-player page, and a host that blocks reading
- [ ] 3.2 Add the `videoExports` store to `src/services/indexedDB.ts` (v4 → v5) and record completed exports; verify with a unit test that a completed export is listed and existing stores are untouched
- [ ] 3.3 Assert exported media bytes are never written to storage; verify with a unit test that the stored record holds metadata only
- [ ] 3.4 Show recent exports in the editor view; verify with a Playwright check that a completed export appears in the list
- [ ] 3.5 Document direct-URL support and its CORS limit; verify the docs match the behaviour

## 4. Optional: ffmpeg.wasm fallback for exotic formats

Deferred and off by default. Ship only if the Mediabunny path leaves formats the owner
needs. Enabling it requires a COOP/COEP decision (see `design.md` - Risks) and, if it
widens format support, an edit to the `video-editor` spec, because its "reject and
report" requirement would change.

- [ ] 4.1 Decide with the owner whether the fallback is worth the bundle and header cost; record the decision in this change
- [ ] 4.2 If approved, load ffmpeg.wasm lazily for unsupported formats only, and verify the cross-origin iframe embeds still play
- [ ] 4.3 If approved, update the `video-editor` spec for the widened format support before landing

## 5. Integration and release

- [ ] 5.1 Run `npx tsc --noEmit`, `npm test`, `npx vite build` and `npm run e2e` and verify all pass
- [ ] 5.2 Verify the editor on the deployed app (load a clip, trim, export) after the release
- [ ] 5.3 Add the `CHANGELOG.md` entry and cut the release with `npm run release:patch -- --push`, then record the deploy

## Workflow follow-up

- Archive this change with `openspec archive add-video-editor` once every phase that
  ships is complete and its tasks are checked.
