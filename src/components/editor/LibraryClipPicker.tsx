import React, { useMemo, useState } from 'react';
import { ListVideo, Plus, Loader2 } from 'lucide-react';
import type { VideoMetadata } from '../../types';
import { editableLibraryVideos, formatTime } from '../../services/videoEditor';
import { SAMPLE_CLIPS } from '../../data/sampleClips';

interface LibraryClipPickerProps {
  /** The saved library; only videos with a direct media URL are offered. */
  videos: readonly VideoMetadata[];
  onAdd: (url: string, title: string) => void;
  busy?: boolean;
}

/**
 * A dropdown to add a clip without leaving the page. It lists the built-in
 * samples first, then the saved videos that have a direct media URL. A video
 * with only an embed URL is a cross-origin iframe the page cannot read, so it is
 * not offered.
 */
export const LibraryClipPicker: React.FC<LibraryClipPickerProps> = ({ videos, onAdd, busy = false }) => {
  const editable = useMemo(() => editableLibraryVideos(videos), [videos]);
  const [selected, setSelected] = useState('');

  const add = () => {
    const sample = SAMPLE_CLIPS.find((clip) => `sample:${clip.id}` === selected);
    if (sample) {
      onAdd(sample.url, sample.title);
      setSelected('');
      return;
    }
    const video = editable.find((item) => `video:${item.id}` === selected);
    const url = video?.playback?.previewUrl;
    if (!video || !url) return;
    onAdd(url, video.title);
    setSelected('');
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <ListVideo className="h-3.5 w-3.5" />
        Add a clip
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={busy}
          data-testid="editor-library-select"
          aria-label="Pick a sample or saved video to add"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
        >
          <option value="">Pick a sample or saved video…</option>
          <optgroup label="Samples (built in)">
            {SAMPLE_CLIPS.map((clip) => (
              <option key={clip.id} value={`sample:${clip.id}`}>
                {clip.title} — {formatTime(clip.durationSeconds)}
              </option>
            ))}
          </optgroup>
          {editable.length > 0 && (
            <optgroup label="Your library">
              {editable.map((video) => (
                <option key={video.id} value={`video:${video.id}`}>
                  {video.title}
                  {video.durationSeconds > 0 ? ` — ${formatTime(video.durationSeconds)}` : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!selected || busy}
          data-testid="editor-library-add"
          className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </button>
      </div>

      <p className="text-[11px] text-slate-500" data-testid="editor-library-hint">
        {editable.length > 0
          ? 'Samples work offline. Saved videos must have a direct media URL; YouTube and catalogue embeds cannot be read by the page.'
          : 'Samples are built in. Your saved YouTube and catalogue videos are embeds, whose bytes the page cannot read, so they are not listed here.'}
      </p>
    </div>
  );
};
