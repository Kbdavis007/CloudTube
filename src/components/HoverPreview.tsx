import React, { useEffect, useRef, useState } from 'react';

interface HoverPreviewProps {
  /** Poster image shown until the preview plays. */
  poster: string;
  alt: string;
  /** Direct muted video to play, when the source exposes one. */
  previewUrl?: string;
  /** Still frames to cycle when there is no direct video. */
  previewFrames?: string[];
  /** Framable embed to fall back to (loaded muted + autoplaying). */
  embedUrl?: string;
  /** Badges/overlays rendered above the preview. */
  children?: React.ReactNode;
}

/** How long the pointer must rest on the card before the preview starts. */
const START_DELAY_MS = 220;
/** Frame interval for the still-image fallback. */
const FRAME_INTERVAL_MS = 600;

/**
 * Plays a small muted preview in place of a result thumbnail while the pointer
 * rests on it. Prefers a direct video URL, then a strip of stills, then the
 * source's own embed. Falls back to the poster when none of those exist, so the
 * grid looks identical when idle.
 */
export const HoverPreview: React.FC<HoverPreviewProps> = ({
  poster,
  alt,
  previewUrl,
  previewFrames,
  embedUrl,
  children,
}) => {
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(0);
  const timerRef = useRef<number | null>(null);

  const frames = previewFrames ?? [];
  const hasMedia = Boolean(previewUrl) || frames.length > 1 || Boolean(embedUrl);

  const start = () => {
    if (!hasMedia) return;
    timerRef.current = window.setTimeout(() => setArmed(true), START_DELAY_MS);
  };
  const stop = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setArmed(false);
    setReady(false);
    setFrame(0);
  };

  useEffect(() => stop, []);

  useEffect(() => {
    if (!armed || previewUrl || frames.length < 2) return;
    const id = window.setInterval(
      () => setFrame((f) => (f + 1) % frames.length),
      FRAME_INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, [armed, previewUrl, frames.length]);

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <img
        src={poster}
        alt={alt}
        className={`w-full h-full object-cover transition duration-300 ${
          armed && ready ? 'opacity-0' : 'opacity-100 group-hover:scale-105'
        }`}
      />

      {armed && previewUrl && (
        <video
          src={previewUrl}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          onPlaying={() => setReady(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {armed && !previewUrl && frames.length > 1 && (
        <img
          src={frames[frame]}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {armed && !previewUrl && frames.length < 2 && embedUrl && (
        <iframe
          src={embedUrl}
          title={alt}
          allow="autoplay; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 w-full h-full border-0"
        />
      )}

      {children}
    </div>
  );
};
