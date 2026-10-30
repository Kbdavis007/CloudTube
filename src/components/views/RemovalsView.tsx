import React, { useMemo, useState } from 'react';
import { VideoRemoval, TasteProfile, RemovalReason } from '../../types';
import { getRemovalReason, REMOVAL_REASONS } from '../../data/removalReasons';
import {
  Trash2,
  RotateCcw,
  Eraser,
  Ban,
  Tag,
  Tv,
  BarChart3,
  Sparkles,
  Brain,
  Eye,
  ThumbsDown,
} from 'lucide-react';

interface RemovalsViewProps {
  removals: VideoRemoval[];
  profile: TasteProfile;
  onRestore: (removalId: string) => Promise<void>;
  onForget: (removalId: string) => Promise<void>;
}

export const RemovalsView: React.FC<RemovalsViewProps> = ({
  removals,
  profile,
  onRestore,
  onForget,
}) => {
  const [reasonFilter, setReasonFilter] = useState<RemovalReason | 'ALL'>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const appliedCount = removals.filter((r) => r.appliedToProfile).length;

  const reasonBreakdown = useMemo(() => {
    const total = removals.length || 1;
    return REMOVAL_REASONS.map((meta) => {
      const count = removals.filter((r) => r.reason === meta.id).length;
      return { ...meta, count, pct: Math.round((count / total) * 100) };
    })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [removals]);

  const filtered = reasonFilter === 'ALL' ? removals : removals.filter((r) => r.reason === reasonFilter);

  const runAction = async (id: string, action: (id: string) => Promise<void>) => {
    setBusyId(id);
    try {
      await action(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Removed Videos &amp; Learned Taste
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Every removal records why. Those reasons rank and filter the videos you discover next.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
            {removals.length} removed
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-xs font-semibold text-orange-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> {appliedCount} teaching the ranker
          </span>
        </div>
      </div>

      {/* Taste profile summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Reason breakdown */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-orange-500" />
            Why videos get removed
          </h2>
          {reasonBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No removals yet. Remove a video from the viewer, dashboard, or ratings view and pick a reason.
            </p>
          ) : (
            <div className="space-y-2.5 pt-1">
              {reasonBreakdown.map((r) => (
                <div key={r.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-semibold">{r.label}</span>
                    <span className="text-slate-400 font-mono">
                      {r.count} · {r.pct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-600 to-red-500" style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What it is doing to future selection */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-orange-500" />
            Active selection signals
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Ban className="w-3 h-3 text-red-400" /> Muted channels
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">{profile.mutedChannelIds.length}</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Tag className="w-3 h-3 text-orange-400" /> Demoted tags
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">{profile.tagPenalties.length}</div>
            </div>
          </div>

          {profile.channelPenalties.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Tv className="w-3 h-3 text-orange-400" /> Channels losing rank
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {profile.channelPenalties.slice(0, 6).map((c) => (
                  <div
                    key={c.channelId}
                    className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800"
                  >
                    <span className="text-slate-300 truncate">{c.channelTitle}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {profile.mutedChannelIds.includes(c.channelId) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                          MUTED
                        </span>
                      )}
                      <span className="font-mono text-orange-300">-{c.penalty}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.tagPenalties.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-orange-400" /> Tags losing rank
              </div>
              <div className="flex flex-wrap gap-1">
                {profile.tagPenalties.slice(0, 12).map((t) => (
                  <span
                    key={t.tag}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950/60 border border-slate-800 text-slate-300"
                  >
                    #{t.tag} <span className="text-orange-300 font-mono">-{t.penalty}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {removals.length === 0 && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Nothing is being demoted yet. Choose "Use this reason to select future videos" when removing.
            </p>
          )}
        </div>
      </div>

      {/* Reason filter */}
      {removals.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <button
            onClick={() => setReasonFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              reasonFilter === 'ALL' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            All ({removals.length})
          </button>
          {reasonBreakdown.map((r) => (
            <button
              key={r.id}
              onClick={() => setReasonFilter(r.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                reasonFilter === r.id ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {r.label} ({r.count})
            </button>
          ))}
        </div>
      )}

      {/* Removal log */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <ThumbsDown className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">
              {removals.length === 0 ? 'No videos removed yet.' : 'No removals with that reason.'}
            </p>
            <p className="text-xs text-slate-400">
              Removing a video with a reason teaches CloudTube what to stop showing you.
            </p>
          </div>
        ) : (
          filtered.map((removal) => {
            const meta = getRemovalReason(removal.reason);
            return (
              <div
                key={removal.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-24 h-16 rounded-xl overflow-hidden bg-black shrink-0">
                      {removal.video.thumbnails?.medium ? (
                        <img
                          src={removal.video.thumbnails.medium}
                          alt={removal.video.title}
                          className="w-full h-full object-cover opacity-70"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-red-400" />
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-bold text-white truncate max-w-lg">{removal.video.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="text-orange-400/90">{removal.video.channelTitle}</span>
                        <span>·</span>
                        <span>{new Date(removal.removedAt).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/15 text-red-300 border border-red-500/30">
                          {meta.label}
                        </span>
                        {removal.appliedToProfile ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> Teaches ranking
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                            Not applied
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => runAction(removal.id, onRestore)}
                      disabled={busyId === removal.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold transition border border-slate-700 active:scale-95"
                      title="Restore this video to the library"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400" /> Restore
                    </button>
                    <button
                      onClick={() => runAction(removal.id, onForget)}
                      disabled={busyId === removal.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-900/40 disabled:opacity-50 text-slate-300 text-xs font-semibold transition border border-slate-700 active:scale-95"
                      title="Delete this removal so it stops influencing future selection"
                    >
                      <Eraser className="w-3.5 h-3.5 text-red-400" /> Forget
                    </button>
                  </div>
                </div>

                {removal.note && (
                  <p className="text-[11px] text-slate-300 italic font-mono pl-1 border-l-2 border-slate-700 pl-3">
                    "{removal.note}"
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {removal.video.viewCount.toLocaleString()} views at removal
                  </span>
                  {(removal.video.tags || []).slice(0, 4).map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-800">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footnote on how reasons feed selection */}
      {removals.length > 0 && (
        <div className="p-4 rounded-2xl bg-orange-950/20 border border-orange-500/25 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
          <span>
            How this works: each reason carries a weight. Channel reasons (like "Dislike this creator") push a
            channel down hard; topic reasons push its tags down. A channel removed at least twice, past a
            penalty threshold, is muted and sorted to the end of search results.
          </span>
        </div>
      )}
    </div>
  );
};
