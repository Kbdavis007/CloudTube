# Design

## Context

See `proposal.md` - Why. The constraints that shape this design:

- CloudTube deploys as a Cloudflare Worker serving static assets (`wrangler.jsonc`,
  `worker/index.ts`) with a small same-origin API. There is no transcode service, so
  editing is client-side only.
- The app plays most media through cross-origin iframes (YouTube, xgroovy, RedGifs).
  Bytes inside an iframe are not readable, so they cannot be editor inputs. Editable
  inputs are a local file the user picks, or a direct media URL the host serves with
  permissive CORS — the Vega/Vortex catalogue already stores `previewUrl` mp4s.
- Navigation is a `PageTab` union in `src/components/Sidebar.tsx`, restored through
  `src/services/viewState.ts` (`PERSISTED_TABS`) and switched in `src/App.tsx`.
- Library data lives in IndexedDB (`CloudTubeDB`, `src/services/indexedDB.ts`, v4) with
  metadata only; media is never stored.
- Verification is `npx tsc --noEmit` + `npm test` + `npx vite build`, with Playwright
  for browser proof. Every push is a release (`AGENTS.md`).

## Goals / Non-Goals

**Goals**

- Trim and combine in the browser with no server work and no upload.
- Keep the cross-origin embeds working — add no response headers that would break them.
- Land each phase as its own release, so value ships before the whole feature is done.
- One engine, one edit model, reused by preview and export so the two cannot drift.

**Non-Goals**

- Editing media inside a cross-origin iframe (YouTube and similar). Not possible in the
  browser; treated as an error, not a feature.
- A multi-track compositor, filters, transitions, text overlays, or keyframes.
- Server-side rendering or any upload endpoint.
- Storing exported media bytes.

## Decisions

- **Mediabunny as the engine.** MPL-2.0, pure TypeScript, tree-shakable, reads/writes
  MP4/WebM in-browser with no ffmpeg and no `SharedArrayBuffer`, so **no COOP/COEP**.
  *Alternatives:* `ffmpeg.wasm` (its multithread build needs COOP/COEP, and adding
  `Cross-Origin-Embedder-Policy` to the Worker would break the third-party iframe embeds
  and popups); WebAV (MIT, WebCodecs, capable but a lower-level SDK we would wrap more
  heavily); Remotion / OpenVideo (tiered "free for individuals, paid above a size
  threshold" licenses — not OSI-open); Etro (GPL-3.0 copyleft).
- **Trim by timestamp at the container level.** In/out points are applied when the
  output is written, so a stream copy is possible for a single un-trimmed clip and
  re-encoding is confined to cases that need it. Frame-exact cutting is a later option,
  not a default.
- **Preview by playing the source clips in sequence, honouring each trim.** The preview
  reuses the timeline model instead of building a second rendering path, so what is
  previewed is what is exported.
- **A `videoExports` IndexedDB store (v4 → v5)** holds export metadata (name, container,
  resolution, size, time). Media bytes are never stored — consistent with the existing
  "metadata only" rule.
- **No Worker or header changes.** Editing runs entirely in the page, which keeps the
  deployed Worker and its iframe embeds untouched.
- **Phases are releases.** Each phase is independently shippable and verifiable; the
  optional ffmpeg.wasm fallback is isolated to the last phase and off by default.

## Risks / Trade-offs

- [Cross-origin direct-URL clips may be unreadable without CORS] → Detect the failure and
  report it (a spec'd scenario); local-file clips always work.
- [Encoding a long timeline can be slow or memory-heavy in the browser] → Show progress
  with cancel; a long edit is a deliberate action with a visible cost.
- [Bundle size grows with the engine] → Mediabunny is tree-shakable; load the editor view
  lazily so the engine is not in the initial bundle.
- [Browser codec coverage varies (WebCodecs/mediarecorder)] → Reject and report on load
  rather than failing mid-export.
- [Adding ffmpeg.wasm later reintroduces the COOP/COEP conflict] → Kept out of the default
  bundle; it stays a deliberate, separately-decided follow-up.

## Migration Plan

Additive only: a new view, a new service, and one IndexedDB version bump (v4 → v5) that
creates the `videoExports` store without touching existing stores. Rollback is removing
the tab and the dependency; existing library data is unaffected.

## Open Questions

- Whether a future export should offer frame-exact cutting (slower, re-encode) — deferred;
  the default is container-level trim.
- Whether the optional ffmpeg.wasm fallback is worth its bundle and header cost — decided
  in the last phase, after Phases 1-3 prove the Mediabunny path.
