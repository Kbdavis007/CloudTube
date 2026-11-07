import React, { useRef, useState } from 'react';
import { Scissors, Film, Loader2, Download, AlertCircle, CheckCircle2, Plus, Info } from 'lucide-react';
import type { VideoMetadata } from '../../types';
import {
  EditorError,
  assembleTimeline,
  formatTime,
  readClip,
  readClipFromUrl,
  timelineDuration,
  type EditorClip,
} from '../../services/videoEditor';
import { ClipCard } from '../editor/ClipCard';
import { TimelinePreview } from '../editor/TimelinePreview';
import { LibraryClipPicker } from '../editor/LibraryClipPicker';

interface EditorViewProps {
  /** The saved library; videos with a direct media URL can be added as clips. */
  videos?: VideoMetadata[];
}

/**
 * The Video Editor view.
 *
 * Builds one video from local clips: add files (or a saved video from the
 * library), trim each to the wanted span, reorder, preview, then export a single
 * MP4. Everything runs on the device — no media is uploaded. Media inside a
 * cross-origin embed (YouTube and similar) cannot be read by the page, so only
 * local files and saved videos with a direct media URL are editable here.
 */
export const EditorView: React.FC<EditorViewProps> = ({ videos = [] }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);

  const [clips, setClips] = useState<EditorClip[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastExport, setLastExport] = useState<{ name: string; duration: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const total = timelineDuration(clips);

  // Reads each source into a clip, adding what it can and reporting what it
  // cannot, so one bad source does not block the others.
  const addSources = async (
    sources: ReadonlyArray<{ name: string; load: () => Promise<EditorClip> }>
  ) => {
    if (sources.length === 0) return;
    setAdding(true);
    setError(null);
    setNotice(null);

    const added: EditorClip[] = [];
    const failures: string[] = [];
    for (const source of sources) {
      try {
        added.push(await source.load());
      } catch (err) {
        failures.push(err instanceof EditorError ? err.message : `"${source.name}" could not be read.`);
      }
    }

    if (added.length > 0) setClips((prev) => [...prev, ...added]);
    if (failures.length > 0) setError(failures.join(' '));
    setAdding(false);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await addSources(
      Array.from(files).map((file) => ({ name: file.name, load: () => readClip(file, file.name) }))
    );
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addLibraryClip = async (url: string, title: string) => {
    await addSources([{ name: title, load: () => readClipFromUrl(url, title) }]);
  };

  const updateClip = (id: string, patch: Partial<EditorClip>) => {
    setClips((prev) => prev.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip)));
  };

  const removeClip = (id: string) => {
    setClips((prev) => prev.filter((clip) => clip.id !== id));
    setLastExport(null);
  };

  const moveClip = (id: string, direction: -1 | 1) => {
    setClips((prev) => {
      const from = prev.findIndex((clip) => clip.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setLastExport(null);
  };

  const handleDragOver = (overIndex: number) => {
    const from = dragIndex.current;
    if (from === null || from === overIndex) return;
    setClips((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
    dragIndex.current = overIndex;
  };

  const handleDrop = () => {
    dragIndex.current = null;
  };

  const handleExport = async () => {
    if (clips.length === 0 || exporting) return;
    setExporting(true);
    setError(null);
    setNotice(null);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await assembleTimeline(clips, {
        signal: controller.signal,
        onProgress: (value) => setProgress(value),
      });

      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      setLastExport({ name: result.filename, duration: result.duration });
      setNotice(`Exported ${result.filename} (${formatTime(result.duration)}).`);
    } catch (err) {
      if (err instanceof EditorError && err.code === 'canceled') {
        setNotice('Export canceled.');
      } else {
        setError(err instanceof Error ? err.message : 'Export failed.');
      }
    } finally {
      setExporting(false);
      setProgress(0);
      abortRef.current = null;
    }
  };

  const cancelExport = () => abortRef.current?.abort();

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
          <Scissors className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-100">Video Editor</h1>
          <p className="text-xs text-slate-400">
            Trim and combine local clips into one file. Everything runs on this device — nothing is
            uploaded.
          </p>
        </div>
      </header>

      <div className="flex items-start gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3 text-[11px] text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
        <p>
          Add clips from a local video file, a built-in sample, or a saved video with a direct media
          URL. Videos played from a source embed (YouTube and similar) cannot be read by the page, so
          they are not editable here.
        </p>
      </div>

      <LibraryClipPicker videos={videos} onAdd={addLibraryClip} busy={adding} />

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            data-testid="editor-file-input"
            onChange={(event) => addFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={adding}
            data-testid="editor-add"
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-400 disabled:opacity-40"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {adding ? 'Reading…' : 'Add clips'}
          </button>
          <span className="text-[11px] text-slate-400">
            {clips.length === 0
              ? 'No clips yet'
              : `${clips.length} clip${clips.length === 1 ? '' : 's'} · ${formatTime(total)} total`}
          </span>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          data-testid="editor-error"
          className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          data-testid="editor-notice"
          className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Timeline</h2>
          {clips.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-800 text-slate-500">
              <Film className="h-6 w-6" />
              <p className="text-xs">Add local video clips to start an edit.</p>
            </div>
          ) : (
            <ul className="space-y-3" data-testid="editor-timeline">
              {clips.map((clip, index) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  index={index}
                  total={clips.length}
                  isDragging={dragIndex.current === index}
                  onTrimStart={(id, value) => updateClip(id, { trimStart: value })}
                  onTrimEnd={(id, value) => updateClip(id, { trimEnd: value })}
                  onRemove={removeClip}
                  onMove={moveClip}
                  onDragStart={(from) => {
                    dragIndex.current = from;
                  }}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <TimelinePreview clips={clips} />

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Export</h3>
              <span className="font-mono text-[11px] text-slate-400">{formatTime(total)}</span>
            </div>

            {exporting && (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-[width]"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                    data-testid="editor-progress"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Encoding… {Math.round(progress * 100)}%</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              {exporting ? (
                <button
                  type="button"
                  onClick={cancelExport}
                  data-testid="editor-cancel"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={clips.length === 0}
                  data-testid="editor-export"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-400 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export MP4
                </button>
              )}
              {lastExport && !exporting && (
                <span className="truncate text-[11px] text-slate-400" data-testid="editor-last-export">
                  Last: {lastExport.name}
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
