# Sidebar & Playback Behavior

Two rules the app follows everywhere:

1. The sidebar stays put while you scroll the content.
2. Playing, pausing or seeking a video never leaves the app. Only the
   **Go to Source Site** button opens an external page, and only when you click it.

## Sticky sidebar

The app is a fixed-height shell: the outer container is `h-screen` and the content
area is the only thing that scrolls. The sidebar is pinned inside that frame, so it
stays visible no matter how far the content scrolls.

- `src/App.tsx` — `h-screen` on the shell; the layout row is
  `md:overflow-hidden md:min-h-0` and `<main>` is the scroll container.
- `src/components/Sidebar.tsx` — `md:sticky md:top-0 md:z-[1000] md:self-start
  md:max-h-screen md:overflow-y-auto`.

The `md:` prefix matters. On desktop the sidebar is pinned and scrolls on its own
when the nav list is taller than the viewport. On mobile the sidebar is a horizontal
strip and the whole page scrolls, which is the layout that fits a phone.

## Playback stays local

Video playback happens in an embedded player (`<iframe>`) inside the player view.
Nothing on the play, pause, seek or forward path calls `window.open` or changes the
page location. Videos that ship their own embed URL load it in the same iframe:
XVideos and the open sources (Archive.org, PeerTube, Dailymotion, Eporner,
AdultEmbed, RedGifs, and Pornhub when a RapidAPI key is set) set
`playback.embedUrl`; YouTube videos derive
their embed URL from the video id. Which open sources a search queries is a user
preference, set in **Settings → Search Sources** (persisted in `localStorage`).
Sources that need a key are off by default and marked "key" in the picker.

The iframe is sandboxed without `allow-top-navigation`, `allow-popups` or
`allow-popups-to-escape-sandbox`, so a tap on the embed can play, pause or seek but
can never navigate the app away or open the source site.

## Go to Source Site

The only action that opens an external page is the **Go to Source Site** button in
the video player.

- It appears only when the video has a canonical source page
  (`playback.externalUrl`), which is set for sources like XVideos, Archive.org,
  PeerTube, Dailymotion, Eporner, AdultEmbed, RedGifs and Pornhub, and absent for
  YouTube. No URL is guessed. (AdultEmbed exposes no public watch page, so its exit
  link is the player embed.)
- It opens in a new tab with `rel="noopener noreferrer"`.
- Style: orange label (`#ff6600`), brighter on hover (`#ffaa33`), external-link icon.

## Referrer policy (do not set `no-referrer`)

YouTube's embed player needs a `Referer` header to configure itself. With no
referrer at all it refuses to load and shows **"Error 153: Video player
configuration error"**. Both places therefore use
`strict-origin-when-cross-origin`, which sends only this site's origin:

- `index.html` — `<meta name="referrer" content="strict-origin-when-cross-origin" />`
- `src/components/views/SelectedVideoPage.tsx` — `referrerPolicy` on the `<iframe>`

The iframe attribute wins over the document default for that frame, so setting
either one alone is enough for the player; both are set so the correct policy is
inherited by anything else added later. Verify a change by loading the player in
headless Chromium with the CDP `Network` domain enabled: the request to
`youtube-nocookie.com/embed/...` must carry a `Referer` (an iframe with
`referrerpolicy="no-referrer"` sends none — that is the bug).

## Verifying a change here

- `npx tsc --noEmit` and `npx vite build` must both pass.
- Render `Sidebar` and `SelectedVideoPage` with `react-dom/server`'s
  `renderToStaticMarkup` and assert on the HTML: the sidebar carries
  `md:sticky`/`md:z-[1000]`; a YouTube video has no source button; a video with
  `playback.externalUrl` has one pointing at that exact URL.
- For the sticky check, serve the built CSS and confirm in a browser that the
  sidebar's viewport position is unchanged after scrolling the content area.
- For the Videos split, render `VideosPage` with `selectedVideo={null}` and
  assert the listing HTML has no `<h1>`, no `views`/`likes` counts, no notes and
  no comments, then render `SelectedVideoPage` and assert it has all of them.
