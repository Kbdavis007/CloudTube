import React, { useState } from 'react';
import { VideoMetadata, RemovalReason } from '../types';
import { REMOVAL_REASONS, getRemovalReason } from '../data/removalReasons';
import { Trash2, X, Info, Sparkles, CheckCircle2 } from 'lucide-react';

export interface RemovalRequest {
  reason: RemovalReason;
  note: string;
  /** Apply the reason to the taste profile that ranks future videos. */
  applyToProfile: boolean;
}

interface RemoveVideoModalProps {
  video: VideoMetadata;
  onClose: () => void;
  onConfirm: (request: RemovalRequest) => Promise<void>;
}

export const RemoveVideoModal: React.FC<RemoveVideoModalProps> = ({ video, onClose, onConfirm }) => {
  const [reason, setReason] = useState<RemovalReason>('not-relevant');
  const [note, setNote] = useState('');
  const [applyToProfile, setApplyToProfile] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);

  const selected = getRemovalReason(reason);
  const knownTags = Array.from(new Set([...(video.tags || []), ...(video.personal?.userTags || [])]))
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4);

  const handleConfirm = async () => {
    setIsRemoving(true);
    try {
      await onConfirm({ reason, note: note.trim(), applyToProfile });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl animate-fadeIn">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-xl bg-red-500/15 text-red-400 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white">Remove Video</h3>
              <p className="text-[11px] text-slate-400 truncate">{video.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
          <span>
            Tell us <strong className="text-white">why</strong> you are removing this. The reason is saved and
            used to rank and filter the videos you discover later.
          </span>
        </p>

        {/* Reason picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-200">Reason</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
            {REMOVAL_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition ${
                  reason === r.id
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  {reason === r.id && <CheckCircle2 className="w-3 h-3 text-orange-400 shrink-0" />}
                  {r.label}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{r.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Optional note */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-200">
            Note <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Anything specific? e.g. 'thumbnail promised a benchmark it never showed'"
            className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-orange-500 resize-none font-mono"
          />
        </div>

        {/* Apply to future selection */}
        <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={applyToProfile}
            onChange={(e) => setApplyToProfile(e.target.checked)}
            className="mt-0.5 accent-orange-500 w-4 h-4"
          />
          <span className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" /> Use this reason to select future videos
            </span>
            Down-ranks this channel{knownTags.length > 0 ? ` and tags like ${knownTags.map((t) => `#${t}`).join(', ')}` : ''}
            {' '}in search and discovery. Channels removed repeatedly are muted.
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isRemoving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm active:scale-95"
            title={`Remove: ${selected.label}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isRemoving ? 'Removing…' : 'Remove Video'}
          </button>
        </div>
      </div>
    </div>
  );
};
