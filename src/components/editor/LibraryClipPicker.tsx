import React, { useMemo, useState } from 'react';
import { ListVideo, Plus, Loader2 } from 'lucide-react';
import type { VideoMetadata } from '../../types';
import { editableLibraryVideos, formatTime } from '../../services/videoEditor';

interface LibraryClipPickerProps {
  /** The saved library; only videos with a direct media URL are offered. */
  videos: readonly VideoMetadata[];
  onAdd: (url: string, title: string) => void;
  busy?: boolean;
}

/**
 * A dropdown of saved videos that can be edited here. Only videos with a direct
 * media URL are listed — an embed-only video (a cross-origin iframe) cannot be
 * read as bytes, so it is not an editor source.
 */
export const LibraryClipPicker: React.FC<LibraryClipPickerProps> = ({ videos, onAdd, busy = false }) => {
  const editable = useMemo(() => editableLibraryVideos(videos), [videos]);
  const [selectedId, setSelectedId] = useState('');

  const selected = editable.find((video) => video.id === selectedId) ?? null;

  const add = () => {
    const url = selected?.playback?.previewUrl;
    if (!url) return;
    onAdd(url, selected.title);
    setSelectedId('');
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <ListVideo className="h-3.5 w-3.5" />
        Add from your library
      </div>

      {editable.length === 0 ? (
        <p className="text-[11px] text-slate-500" data-testid="editor-library-empty">
          No saved videos can be edited here yet. Saved RedGifs clips can be edited; YouTube and
          catalogue videos are embeds, whose bytes the page cannot read.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={busy}
            data-testid="editor-library-select"
            aria-label="Pick a saved video to add"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
          >
            <option value="">Pick a saved video…</option>
            {editable.map((video) => (
              <option key={video.id} value={video.id}>
                {video.title}
                {video.durationSeconds > 0 ? ` — ${formatTime(video.durationSeconds)}` : ''}
              </option>
            ))}
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
      )}
    </div>
  );
};
