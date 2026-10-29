import React, { useState } from 'react';
import { VideoMetadata, PersonalMetadata } from '../../types';
import {
  Star,
  FileText,
  Tag,
  Sliders,
  Filter,
  Play,
  Bookmark,
  Sparkles,
  Save,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

interface RatingsNotesViewProps {
  videos: VideoMetadata[];
  onSelectVideo: (youtubeId: string) => void;
  onUpdatePersonal: (youtubeId: string, personal: Partial<PersonalMetadata>) => Promise<void>;
}

export const RatingsNotesView: React.FC<RatingsNotesViewProps> = ({
  videos,
  onSelectVideo,
  onUpdatePersonal,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'needs_rating' | 'has_notes' | 'elite' | 'favorites'>('all');
  const [editingVideo, setEditingVideo] = useState<VideoMetadata | null>(null);

  // Quick edit state
  const [editScore, setEditScore] = useState(50);
  const [editRating, setEditRating] = useState(80);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);

  const openQuickEdit = (video: VideoMetadata) => {
    setEditingVideo(video);
    setEditScore(video.personal?.indexScore ?? 50);
    setEditRating(video.personal?.userRating ?? 80);
    setEditNotes(video.personal?.userNotes ?? '');
    setEditTags(video.personal?.userTags ?? []);
  };

  const handleSaveQuickEdit = async () => {
    if (!editingVideo) return;
    await onUpdatePersonal(editingVideo.youtubeId, {
      indexScore: editScore,
      userRating: editRating,
      userNotes: editNotes,
      userTags: editTags,
    });
    setEditingVideo(null);
  };

  const filteredVideos = videos.filter((v) => {
    const score = v.personal?.indexScore ?? 50;
    const rating = v.personal?.userRating ?? 0;
    const notes = v.personal?.userNotes ?? '';
    const isFav = v.personal?.isFavorite ?? false;

    if (filterType === 'needs_rating') return rating === 0;
    if (filterType === 'has_notes') return notes.trim().length > 0;
    if (filterType === 'elite') return score <= 20;
    if (filterType === 'favorites') return isFav;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
            Ratings & Personal Notes Editor
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Curation workbench for managing IndexScores (1=best, 100=worst), star ratings, tags, and study notes.
          </p>
        </div>

        <button
          onClick={() => setShowFormulaInfo(!showFormulaInfo)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition"
        >
          <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
          <span>IndexScore Formula</span>
        </button>
      </div>

      {/* Formula Explanation Callout */}
      {showFormulaInfo && (
        <div className="p-4 rounded-2xl bg-orange-950/20 border border-orange-500/30 text-xs text-slate-300 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-bold text-orange-400">How IndexScore (1 to 100) is Determined:</span>
            <button onClick={() => setShowFormulaInfo(false)} className="text-slate-400 hover:text-white">&times;</button>
          </div>
          <p className="leading-relaxed text-slate-300">
            IndexScore ranks the essential utility of a video. <strong>1 is the ultimate masterpiece</strong>,
            while 100 is low-priority archive. It combines:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] text-orange-200">
            <div className="p-2 rounded bg-black/30">1. Like-to-View Ratio (Engagement Quality)</div>
            <div className="p-2 rounded bg-black/30">2. User Star Rating (Direct Personal Vote)</div>
            <div className="p-2 rounded bg-black/30">3. Multi-Source Verified Flags (Google, Reddit)</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/60 border border-slate-800">
        {[
          { id: 'all', label: `All Videos (${videos.length})` },
          { id: 'elite', label: 'Top Tier (Score ≤ 20)' },
          { id: 'has_notes', label: 'Has Study Notes' },
          { id: 'favorites', label: 'Favorites' },
          { id: 'needs_rating', label: 'Unrated' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === tab.id
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Curation Table / Cards */}
      <div className="space-y-3">
        {filteredVideos.map((video) => {
          const score = video.personal?.indexScore ?? 50;
          const rating = video.personal?.userRating ?? 0;
          const notes = video.personal?.userNotes || '';
          const tags = video.personal?.userTags || [];

          return (
            <div
              key={video.youtubeId}
              className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => onSelectVideo(video.youtubeId)}
                    className="relative w-24 h-16 rounded-xl overflow-hidden bg-black shrink-0 cursor-pointer group"
                  >
                    <img
                      src={video.thumbnails.medium}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h3
                      onClick={() => onSelectVideo(video.youtubeId)}
                      className="text-sm font-bold text-white hover:text-orange-400 cursor-pointer truncate max-w-lg transition"
                    >
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="text-orange-400/90">{video.channelTitle}</span>
                      <span>·</span>
                      <span>{video.duration.replace('PT', '').toLowerCase()}</span>
                    </div>
                  </div>
                </div>

                {/* IndexScore & Rating Badges + Quick Edit Trigger */}
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Score</span>
                      <span className="px-2 py-0.5 rounded-lg bg-orange-600/90 text-white font-mono font-extrabold text-xs">
                        {score}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-amber-400 mt-1">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{rating}% ({((rating / 20) || 0).toFixed(1)}/5)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => openQuickEdit(video)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 active:scale-95"
                  >
                    Edit Notes & Score
                  </button>
                </div>
              </div>

              {/* Personal Notes Preview & Tags */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex-1 text-slate-300 italic truncate font-mono text-[11px]">
                  {notes ? `"${notes}"` : <span className="text-slate-500 not-italic">No personal notes yet.</span>}
                </div>

                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Edit Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-orange-500" />
                Edit Ratings & Notes
              </h3>
              <button
                onClick={() => setEditingVideo(null)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-300 line-clamp-1">{editingVideo.title}</p>

            {/* IndexScore slider */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-200 font-semibold">IndexScore (1=best, 100=worst):</span>
                <span className="font-mono font-bold text-orange-400">{editScore}</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={editScore}
                onChange={(e) => setEditScore(Number(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer"
              />
            </div>

            {/* UserRating slider */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-200 font-semibold">Personal Rating (0-100):</span>
                <span className="font-mono font-bold text-amber-400">{editRating}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={editRating}
                onChange={(e) => setEditRating(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Personal Notes:</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500 font-mono"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Personal Tags:</label>
              <div className="flex flex-wrap gap-1">
                {editTags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-xs"
                  >
                    #{t}
                    <button
                      onClick={() => setEditTags(editTags.filter((x) => x !== t))}
                      className="text-orange-400 hover:text-white"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="New tag..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <button
                  onClick={() => {
                    if (tagInput.trim() && !editTags.includes(tagInput.trim())) {
                      setEditTags([...editTags, tagInput.trim()]);
                      setTagInput('');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-semibold text-white"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuickEdit}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
