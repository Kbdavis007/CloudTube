import type { VideoMetadata } from '../types';

/**
 * Hover-preview URLs for result cards.
 *
 * Lives in a plain module (no React, no DOM) so the rules are unit-testable and
 * every result card uses the same logic.
 */

/** Add muted-autoplay hints to a source embed so a hover preview starts itself. */
export const withAutoplay = (embedUrl?: string): string | undefined => {
  if (!embedUrl) return undefined;
  const join = embedUrl.includes('?') ? '&' : '?';
  return `${embedUrl}${join}autoplay=1&mute=1`;
};

/** YouTube thumbnails expose no direct video, so the embed is the only preview. */
export const youtubeEmbedUrl = (youtubeId: string): string =>
  `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0`;

/**
 * The framable embed a hover preview should load for a video, or undefined when
 * none is known. Prefers the source's own embed; a YouTube video has no
 * `playback`, so its URL is derived from the id.
 */
export function hoverPreviewEmbedUrl(video: VideoMetadata): string | undefined {
  if (video.playback?.embedUrl) return withAutoplay(video.playback.embedUrl);
  if (video.playback) return withAutoplay(video.playback.externalUrl);
  return youtubeEmbedUrl(video.youtubeId);
}
