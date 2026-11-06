# Proposal

## Why

CloudTube can surface and play videos from many sources, but it can do nothing with
them beyond playback — there is no way to trim a clip or join several into one file.
The owner asked for trim and combine. Because the app is a Cloudflare Worker serving
static assets (`worker/index.ts`, `wrangler.jsonc`) with no transcode backend, all
editing must run client-side in the browser.

## What Changes

- Add a new **Editor** view ("Video Editor") that assembles an edit from clips: load
  clips, set in/out points, reorder, preview, then export one file.
- Use **Mediabunny** (MPL-2.0, pure TypeScript) as the media engine. It reads, writes
  and converts MP4/WebM in-browser with no ffmpeg and **no COOP/COEP headers**, so it
  does not disturb the app's cross-origin iframe embeds.
- Deliver in **phases** (see `tasks.md`), each independently shippable as a release:
  1. **Trim + combine** — local files, in/out trim, reorder, export one MP4.
  2. **Export options** — container/resolution choice, progress, cancel.
  3. **Sources + library** — direct-URL clips, recent-export records.
  4. **Optional fallback** — opt-in ffmpeg.wasm for formats Mediabunny cannot handle
     (explicitly out of the default bundle).
- Media bytes never leave the device; no upload endpoint is added.

## Capabilities

### New Capabilities

- `video-editor`: the client-side edit model — adding clips from a local file or a
  direct media URL, trimming with in/out points, reordering, previewing the assembled
  timeline, and refusing work the browser cannot do.
- `video-export`: turning the assembled timeline into a single downloadable file —
  choosing container/resolution, encoding with progress and cancel, downloading the
  result, and recording recent exports.

### Modified Capabilities

_None. There are no existing specs under `openspec/specs/` (the only prior change,
`add-pr-template`, set `skip_specs: true`), and no existing capability's requirements
change._

## Impact

- **New code**: `src/components/views/EditorView.tsx`, editor components under
  `src/components/editor/`, and `src/services/videoEditor.ts` (Mediabunny wrapper).
- **Navigation**: a new sidebar tab in `src/components/Sidebar.tsx` and
  `src/services/viewState.ts` (`PERSISTED_TABS`), wired in `src/App.tsx`.
- **Storage**: `src/services/indexedDB.ts` gains a `videoExports` store (DB v4 → v5).
  Metadata only — never media bytes.
- **Dependencies**: adds `mediabunny` to `dependencies` (and updates `bun.lock`).
- **Docs / delivery**: `AGENTS.md` editor note, `CHANGELOG.md` entry, openspec change
  and Playwright proof, per the repo's release-on-push rule.
- **No change** to the Worker API surface or the deployed Worker's headers.
