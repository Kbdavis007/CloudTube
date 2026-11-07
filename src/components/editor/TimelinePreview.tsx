import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { formatTime, timelineDuration, trimmedDuration, type EditorClip } from '../../services/videoEditor';

interface TimelinePreviewProps {
  clips: EditorClip[];
}

/**
 * Plays the assembled timeline: each clip in order, restricted to its trimmed
 * span. Uses one `<video>` element and advances to the next clip when the
 * current one reaches its out point, so the preview matches what an export
 * produces. Any edit resets the preview to the start of the new timeline.
 */
export const TimelinePreview: React.FC<TimelinePreviewProps> = ({ clips }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  // One object URL per clip, keyed by id so trimming never re-creates them.
  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const clip of clips) map.set(clip.id, URL.createObjectURL(clip.file));
    return map;
  }, [clips]);

  useEffect(() => {
    const created = urls;
    return () => {
      for (const url of created.values()) URL.revokeObjectURL(url);
    };
  }, [urls]);

  // Any change to the timeline (add, trim, reorder, remove) restarts the preview.
  const signature = clips.map((clip) => `${clip.id}:${clip.trimStart}:${clip.trimEnd}`).join('|');
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [signature]);

  const current = clips[index];
  const total = timelineDuration(clips);
  const elapsedBefore = clips.slice(0, index).reduce((sum, clip) => sum + trimmedDuration(clip), 0);

  // Keep the element's source and start point in sync with the current clip.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current) return;
    video.currentTime = current.trimStart;
  }, [current, urls]);

  const advance = () => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next >= clips.length) {
        setPlaying(false);
        return 0;
      }
      return next;
    });
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video || !current) return;
    if (playing) {
      video.pause();
      setPlaying(false);
      return;
    }
    video.currentTime = current.trimStart;
    try {
      await video.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const restart = () => {
    const video = videoRef.current;
    setIndex(0);
    if (video && clips[0]) {
      video.currentTime = clips[0].trimStart;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Preview</h3>
        <span className="font-mono text-[11px] text-slate-400" data-testid="preview-total">
          {formatTime(elapsedBefore)} / {formatTime(total)}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-black">
        {current ? (
          <video
            ref={videoRef}
            src={urls.get(current.id)}
            data-testid="editor-preview"
            playsInline
            className="mx-auto max-h-[320px] w-full bg-black"
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime >= current.trimEnd - 0.02) advance();
            }}
            onEnded={advance}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-xs text-slate-500">
            Add a clip to preview the timeline
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!current}
          data-testid="preview-play"
          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400 disabled:opacity-40"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={restart}
          disabled={!current}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restart
        </button>
        {current && (
          <span className="ml-auto truncate text-[11px] text-slate-400">
            Clip {index + 1} of {clips.length}: <span className="text-slate-200">{current.name}</span>
          </span>
        )}
      </div>
    </div>
  );
};
