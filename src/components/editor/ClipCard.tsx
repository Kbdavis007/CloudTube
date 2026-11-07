import React from 'react';
import { GripVertical, Trash2, ArrowUp, ArrowDown, Volume2, VolumeX } from 'lucide-react';
import { clampTrimEnd, clampTrimStart, formatTime, trimmedDuration, type EditorClip } from '../../services/videoEditor';

interface ClipCardProps {
  clip: EditorClip;
  index: number;
  total: number;
  onTrimStart: (id: string, value: number) => void;
  onTrimEnd: (id: string, value: number) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  isDragging: boolean;
}

/**
 * One clip on the timeline: its identity, in/out trim handles, and reorder and
 * remove controls. The two range inputs are the trim handles; each clamps so the
 * in point stays before the out point.
 */
export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  index,
  total,
  onTrimStart,
  onTrimEnd,
  onRemove,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}) => {
  const step = Math.max(0.05, clip.duration / 500);

  return (
    <li
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      data-testid="editor-clip"
      className={`rounded-2xl border bg-slate-900/50 p-3 space-y-3 transition ${
        isDragging ? 'border-orange-500/60 opacity-60' : 'border-slate-800/80'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 cursor-grab text-slate-500 active:cursor-grabbing" aria-hidden="true">
          <GripVertical className="w-4 h-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300">
              {index + 1}
            </span>
            <span className="truncate text-xs font-semibold text-slate-200" title={clip.name}>
              {clip.name}
            </span>
            {clip.hasAudio ? (
              <Volume2 className="w-3.5 h-3.5 text-slate-400" aria-label="has audio" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" aria-label="no audio" />
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {clip.width}×{clip.height} · source {formatTime(clip.duration)} · keeps{' '}
            <span className="text-slate-200">{formatTime(trimmedDuration(clip))}</span>
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(clip.id, -1)}
            disabled={index === 0}
            aria-label="Move clip earlier"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(clip.id, 1)}
            disabled={index === total - 1}
            aria-label="Move clip later"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(clip.id)}
            aria-label={`Remove ${clip.name}`}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">In</span>
          <input
            type="range"
            min={0}
            max={clip.duration}
            step={step}
            value={clip.trimStart}
            aria-label="Trim in point"
            onChange={(event) =>
              onTrimStart(clip.id, clampTrimStart(Number(event.target.value), clip.trimEnd, clip.duration))
            }
            className="flex-1 accent-orange-500"
          />
          <span className="w-12 shrink-0 text-right font-mono text-slate-200">{formatTime(clip.trimStart)}</span>
        </label>

        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">Out</span>
          <input
            type="range"
            min={0}
            max={clip.duration}
            step={step}
            value={clip.trimEnd}
            aria-label="Trim out point"
            onChange={(event) =>
              onTrimEnd(clip.id, clampTrimEnd(Number(event.target.value), clip.trimStart, clip.duration))
            }
            className="flex-1 accent-orange-500"
          />
          <span className="w-12 shrink-0 text-right font-mono text-slate-200">{formatTime(clip.trimEnd)}</span>
        </label>
      </div>
    </li>
  );
};
