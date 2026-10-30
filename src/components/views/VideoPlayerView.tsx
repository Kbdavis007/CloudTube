import React, { useState, useEffect } from 'react';
import {
  VideoMetadata,
  VideoComment,
  PersonalMetadata,
  SourceFlag,
} from '../../types';
import {
  Star,
  Bookmark,
  Share2,
  Tv,
  MessageSquare,
  ThumbsUp,
  Eye,
  Calendar,
  Tag,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Save,
  CheckCircle2,
  Brain,
  FileText,
  Database,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { AiAnalysisModal } from '../AiAnalysisModal';
import { ApiErrorCard } from '../ApiErrorCard';
import { GeminiAiService } from '../../services/geminiAi';

interface VideoPlayerViewProps {
  currentVideo: VideoMetadata | null;
  allVideos: VideoMetadata[];
  comments: VideoComment[];
  onSelectVideo: (youtubeId: string) => void;
  onUpdatePersonal: (youtubeId: string, personal: Partial<PersonalMetadata>) => Promise<void>;
  onHarvestComments: (youtubeId: string) => void;
  onUpdateAiSummary: (youtubeId: string, aiSummary: string) => Promise<void>;
  onRequestRemoval: (youtubeId: string) => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  currentVideo,
  allVideos,
  comments,
  onSelectVideo,
  onUpdatePersonal,
  onHarvestComments,
  onUpdateAiSummary,
  onRequestRemoval,
}) => {
  if (!currentVideo) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-base text-slate-300">No video selected in library.</p>
        <p className="text-xs text-slate-400">Select a video from the Dashboard or Search view to play.</p>
      </div>
    );
  }

  // Personal metadata local state for editing
  const [indexScore, setIndexScore] = useState<number>(currentVideo.personal?.indexScore ?? 50);
  const [userRating, setUserRating] = useState<number>(currentVideo.personal?.userRating ?? 85);
  const [userNotes, setUserNotes] = useState<string>(currentVideo.personal?.userNotes ?? '');
  const [userTags, setUserTags] = useState<string[]>(currentVideo.personal?.userTags ?? []);
  const [newTagInput, setNewTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState<boolean>(currentVideo.personal?.isFavorite ?? false);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Dedicated Under-Player Tabs state & AI Summary Generation state
  const [activeUnderPlayerTab, setActiveUnderPlayerTab] = useState<'ai_summary' | 'description' | 'comments'>('ai_summary');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryFeedback, setSummaryFeedback] = useState<string | null>(null);

  // Check if AI Summary already exists in the video's database metadata
  const hasDatabaseAiSummary = Boolean(currentVideo.aiSummary && currentVideo.aiSummary.trim().length > 0);

  const handleGenerateAiSummary = async () => {
    setIsGeneratingSummary(true);
    setSummaryFeedback(null);
    try {
      const summaryText = await GeminiAiService.generateConciseSummary(
        currentVideo.title,
        currentVideo.description
      );
      await onUpdateAiSummary(currentVideo.youtubeId, summaryText);
      currentVideo.aiSummary = summaryText;
      currentVideo.aiSummaryGeneratedAt = new Date().toISOString();
      setSummaryFeedback('AI Summary saved to database metadata.');
      setTimeout(() => setSummaryFeedback(null), 3500);
    } catch (err: any) {
      console.error('Failed to generate summary with Gemini:', err);
      setSummaryFeedback(`Error generating summary: ${err?.message || 'Gemini API error'}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Sync state when current video changes
  useEffect(() => {
    setIndexScore(currentVideo.personal?.indexScore ?? 50);
    setUserRating(currentVideo.personal?.userRating ?? 85);
    setUserNotes(currentVideo.personal?.userNotes ?? '');
    setUserTags(currentVideo.personal?.userTags ?? []);
    setIsFavorite(currentVideo.personal?.isFavorite ?? false);
  }, [currentVideo.youtubeId]);

  // Current video index in playlist
  const currentIndex = allVideos.findIndex((v) => v.youtubeId === currentVideo.youtubeId);
  const prevVideo = currentIndex > 0 ? allVideos[currentIndex - 1] : null;
  const nextVideo = currentIndex < allVideos.length - 1 ? allVideos[currentIndex + 1] : null;

  const handleSavePersonal = async () => {
    await onUpdatePersonal(currentVideo.youtubeId, {
      indexScore,
      userRating,
      userNotes,
      userTags,
      isFavorite,
      lastViewedAt: new Date().toISOString(),
    });

    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2000);
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !userTags.includes(trimmed)) {
      const updated = [...userTags, trimmed];
      setUserTags(updated);
      setNewTagInput('');
      onUpdatePersonal(currentVideo.youtubeId, { userTags: updated });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = userTags.filter((t) => t !== tagToRemove);
    setUserTags(updated);
    onUpdatePersonal(currentVideo.youtubeId, { userTags: updated });
  };

  const toggleFavorite = () => {
    const updated = !isFavorite;
    setIsFavorite(updated);
    onUpdatePersonal(currentVideo.youtubeId, { isFavorite: updated });
  };

  const sourceFlagColors: Record<SourceFlag, string> = {
    YouTubeSearch: 'bg-red-500/20 text-red-400 border-red-500/30',
    ChannelUploads: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Google: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Reddit: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
    X: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    LinkedIn: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
    Playlist: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Navigation Bar between videos */}
      <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-slate-900/60 border border-slate-800">
        <button
          onClick={() => prevVideo && onSelectVideo(prevVideo.youtubeId)}
          disabled={!prevVideo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous Video</span>
        </button>

        <span className="text-xs text-slate-400 font-mono">
          Video {currentIndex + 1} of {allVideos.length} in Library
        </span>

        <button
          onClick={() => nextVideo && onSelectVideo(nextVideo.youtubeId)}
          disabled={!nextVideo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold transition"
        >
          <span className="hidden sm:inline">Next Video</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Grid: Player on Left, Personal Metadata Studio on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Embed & Metadata (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* YouTube Responsive Embed Container */}
          <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black shadow-2xl border border-slate-800">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${currentVideo.youtubeId}?autoplay=0&rel=0&modestbranding=1`}
              title={currentVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>

          {/* Video Title & Actions */}
          <div className="space-y-3 p-5 rounded-3xl bg-slate-900/70 border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-orange-600/90 text-white text-xs font-extrabold shadow-sm flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  IndexScore: {indexScore}
                  <span className="text-[10px] opacity-75">(1=best)</span>
                </span>

                {currentVideo.sourceFlags.map((flag) => (
                  <span
                    key={flag}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      sourceFlagColors[flag] || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {flag}
                  </span>
                ))}
              </div>

              {/* Favorite & AI Analysis */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAiModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
                  title="Analyze video with Google AI (Gemini)"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Google AI Analysis</span>
                </button>

                <button
                  onClick={toggleFavorite}
                  className={`p-2 rounded-xl border transition ${
                    isFavorite
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title={isFavorite ? 'Favorited' : 'Add to Favorites'}
                >
                  <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={() => onRequestRemoval(currentVideo.youtubeId)}
                  className="p-2 rounded-xl border bg-slate-800 text-slate-400 border-slate-700 hover:text-red-300 hover:border-red-800/70 hover:bg-red-900/30 transition"
                  title="Remove this video and record why it should not be recommended again"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-white leading-snug">
              {currentVideo.title}
            </h1>

            {/* Channel Info & Video Stats */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-xs">
                  {currentVideo.channelTitle.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-white">{currentVideo.channelTitle}</div>
                  <div className="text-[10px] text-slate-500">ID: {currentVideo.channelId}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  {currentVideo.viewCount.toLocaleString()} views
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-slate-400" />
                  {currentVideo.likeCount.toLocaleString()} likes
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(currentVideo.publishedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Dedicated Tabs Under Video Player */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setActiveUnderPlayerTab('ai_summary')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    activeUnderPlayerTab === 'ai_summary'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5 text-orange-400" />
                  <span>AI Summary (Gemini)</span>
                  {hasDatabaseAiSummary ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Cached in database" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400" title="Missing from database - Click to generate" />
                  )}
                </button>

                <button
                  onClick={() => setActiveUnderPlayerTab('description')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    activeUnderPlayerTab === 'description'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Full Description</span>
                </button>

                <button
                  onClick={() => setActiveUnderPlayerTab('comments')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    activeUnderPlayerTab === 'comments'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Comments ({comments.length})</span>
                </button>
              </div>

              {/* Tab 1: AI Summary Content (Database-First Check) */}
              {activeUnderPlayerTab === 'ai_summary' && (
                <div className="space-y-3">
                  {hasDatabaseAiSummary ? (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/30">
                            <Database className="w-3 h-3 text-emerald-400" /> Cached in Database (D1 / IndexedDB)
                          </span>
                          {currentVideo.aiSummaryGeneratedAt && (
                            <span className="text-[11px] text-slate-400">
                              Saved: {new Date(currentVideo.aiSummaryGeneratedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={handleGenerateAiSummary}
                          disabled={isGeneratingSummary}
                          className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 disabled:opacity-50 transition"
                          title="Regenerate summary with Gemini API"
                        >
                          <RefreshCw className={`w-3 h-3 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
                          <span>Regenerate</span>
                        </button>
                      </div>

                      {/* Display Cached AI Summary */}
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-orange-500/20 text-xs text-slate-200 leading-relaxed max-h-72 overflow-y-auto space-y-2.5 font-sans selection:bg-orange-500/30">
                        {currentVideo.aiSummary?.split('\n\n').map((paragraph, idx) => (
                          <div key={idx} className="whitespace-pre-line leading-relaxed">
                            {paragraph}
                          </div>
                        ))}
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                        <span>Retrieved from local video database metadata (zero unnecessary API calls).</span>
                        <span className="text-orange-400/80 font-mono">Gemini API Engine</span>
                      </div>
                    </div>
                  ) : (
                    /* Missing from Database - Generate on Demand */
                    <div className="p-6 rounded-2xl bg-slate-950/80 border border-dashed border-slate-800 text-center space-y-3.5 animate-fadeIn">
                      <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto border border-orange-500/20">
                        <Brain className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-white">No AI Summary in Database Yet</h4>
                        <p className="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
                          Database check: No cached AI summary exists in this video's metadata. Click below
                          to invoke the Gemini API, generate a concise summary from the title and description,
                          and persist it to your Cloudflare D1 & IndexedDB metadata store.
                        </p>
                      </div>

                      <button
                        onClick={handleGenerateAiSummary}
                        disabled={isGeneratingSummary}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-orange-600/30 active:scale-95"
                      >
                        {isGeneratingSummary ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Generating with Gemini & Saving to Database...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Generate AI Summary with Gemini</span>
                          </>
                        )}
                      </button>

                      {summaryFeedback &&
                        (summaryFeedback.startsWith('Error') ? (
                          <div className="pt-1">
                            <ApiErrorCard message={summaryFeedback} />
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-400 font-semibold pt-1">
                            {summaryFeedback}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Full Description */}
              {activeUnderPlayerTab === 'description' && (
                <div className="pt-1">
                  <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto pr-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60 font-mono text-[11px]">
                    {currentVideo.description || 'No description provided by uploader.'}
                  </div>
                </div>
              )}

              {/* Tab 3: Comments Quick Preview */}
              {activeUnderPlayerTab === 'comments' && (
                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                    <span>{comments.length} harvested comments in library</span>
                    <button
                      onClick={() => onHarvestComments(currentVideo.youtubeId)}
                      className="text-orange-400 hover:text-orange-300 text-xs font-semibold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Harvest More Comments
                    </button>
                  </div>
                  {comments.slice(0, 3).map((c) => (
                    <div key={c.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70 text-xs text-slate-300 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-white">{c.authorName}</span>
                        <span>{c.likes} likes</span>
                      </div>
                      <p className="line-clamp-2">{c.text}</p>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <div className="py-4 text-center text-xs text-slate-500">
                      No comments harvested for this video yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Personal Metadata Studio & Notes */}
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                Personal Curation Studio
              </h2>
              {isSavedRecently && (
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved to D1
                </span>
              )}
            </div>

            {/* IndexScore (1 = best, 100 = worst) */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-200">IndexScore (1 = Best, 100 = Worst):</span>
                <span className="font-mono font-bold text-orange-400 text-sm">{indexScore}</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={indexScore}
                onChange={(e) => setIndexScore(Number(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>1 (Masterpiece / Essential)</span>
                <span>50</span>
                <span>100 (Low Priority)</span>
              </div>
            </div>

            {/* User Rating (0 - 100 & 5-Star) */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-200">User Rating:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">{userRating} / 100</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={userRating}
                  onChange={(e) => setUserRating(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-center gap-1 pt-1">
                {[20, 40, 60, 80, 100].map((threshold, idx) => (
                  <button
                    key={threshold}
                    onClick={() => setUserRating(threshold)}
                    className="p-1 hover:scale-110 transition"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        userRating >= threshold ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs text-slate-400 ml-2">({(userRating / 20).toFixed(1)} / 5 stars)</span>
              </div>
            </div>

            {/* User Tags */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-orange-400" />
                Personal Tags:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {userTags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-medium"
                  >
                    #{t}
                    <button
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-red-400 text-orange-400 ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add custom tag (e.g. Edge, Must-Watch)..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500"
                />
                <button
                  onClick={handleAddTag}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Personal Study Notes */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200">
                Personal Study Notes (Stored in IndexedDB & D1):
              </label>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={5}
                placeholder="Write your personal insights, timestamps, architecture takeaways..."
                className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-orange-500 resize-none font-mono"
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSavePersonal}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-md shadow-orange-600/30 active:scale-95"
            >
              <Save className="w-4 h-4" />
              Save Curation Metadata
            </button>
          </div>
        </div>
      </div>

      {/* Harvested Comments Section for this Video */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-orange-500" />
              Harvested Comments ({comments.length})
            </h2>
            <p className="text-xs text-slate-400">
              Extracted from YouTube Data API and indexed into SQLite & R2 archive vault
            </p>
          </div>

          <button
            onClick={() => onHarvestComments(currentVideo.youtubeId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            Harvest Top Comments
          </button>
        </div>

        {comments.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No comments harvested for this video yet. Click "Harvest Top Comments" to retrieve discussion insights.
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={comment.authorAvatar}
                      alt={comment.authorName}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">{comment.authorName}</div>
                      <div className="text-[10px] text-slate-500">{comment.authorChannelId}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <ThumbsUp className="w-3 h-3 text-orange-400" /> {comment.likes}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(comment.publishedAt).toLocaleDateString()}
                    </span>
                    {comment.sentiment && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          comment.sentiment === 'positive'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {comment.sentiment}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pl-9">{comment.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google AI Analysis Modal */}
      {showAiModal && (
        <AiAnalysisModal
          video={currentVideo}
          onClose={() => setShowAiModal(false)}
          onApplyPersonal={async (personal) => {
            await onUpdatePersonal(currentVideo.youtubeId, personal);
          }}
        />
      )}
    </div>
  );
};
