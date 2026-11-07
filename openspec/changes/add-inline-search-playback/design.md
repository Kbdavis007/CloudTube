# Design

## Why a separate card component

`SearchView` already owned the results grid, the ranking, the filters and the
pagination. Adding per-card play state to it would put a `useState` inside the
`map`, which React forbids, so the card becomes its own component
(`SearchResultCard`) that owns one `isPlaying` flag. The view stays about
*searching*; the card is about *one result*.

## Why the embed URL differs from the hover preview

`hoverPreviewEmbedUrl` asks for a muted, controls-off, autoplaying preview — right
for a glance on hover, wrong for a real watch. `inlinePlayerEmbedUrl` asks for the
full interactive player (sound on, controls shown, no `mute`/`controls=0`), and
falls back to the source's external page only when a source has no embed at all. A
YouTube result has no `playback`, so its URL is derived from the video id, exactly
as the full player does.

## Why playback is per card

The requirement is that several results can play at once, so play state cannot live
in the view. Each card holds its own `isPlaying`; starting one never touches another.
The trade-off is that a page can hold several players at once — acceptable because
the user asked for it and each is an ordinary sandboxed iframe.

## Sandbox and referrer policy

The in-place iframe uses the same sandbox as the full player
(`allow-scripts allow-same-origin allow-presentation`, no `allow-top-navigation`)
and the same `strict-origin-when-cross-origin` referrer, so an in-place play can
never navigate the app away, and YouTube's player still configures itself.

## Settings is the single source of truth

The enabled-source preference already lived in one module (`searchSources`) with a
change event the search page subscribes to. The only duplication was the on-page
chip row, which called the same `saveEnabledOpenSources`. Removing the row leaves
one writer (Settings) and one reader (search), with no storage change.
