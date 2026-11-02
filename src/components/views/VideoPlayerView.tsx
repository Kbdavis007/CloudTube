import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink,
  Sparkles,
  Save,
  CheckCircle2,
  Brain,
  FileText,
  RefreshCw,
  Loader2,
  Search,
  ListFilter,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { AiAnalysisModal } from '../AiAnalysisModal';
import { ApiErrorCard } from '../ApiErrorCard';
import { MarkdownSummary } from '../MarkdownSummary';
import { GeminiAiService } from '../../services/geminiAi';
import { sourceFlagLabel } from '../../data/sourceLabels';

/** Cards per page in the library browser. */
const LIBRARY_PAGE_SIZE = 24;

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

  // Check whether this video already has a saved summary
  const hasSavedSummary = Boolean(currentVideo.aiSummary && currentVideo.aiSummary.trim().length > 0);

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
      setSummaryFeedback('Summary saved to your notes.');
      setTimeout(() => setSummaryFeedback(null), 3500);
    } catch (err: any) {
      console.error('Failed to generate summary:', err);
      setSummaryFeedback(`Error generating summary: ${err?.message || 'AI service error'}`);
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

  // Only sources that ship their own page (XVideos) can be opened outside the
  // app. YouTube videos have no canonical source-site page in this library, so
  // the button is hidden rather than pointing at a guessed URL.
  const sourceUrl = currentVideo.playback?.externalUrl;

  // Library browser state: search, filters and sort over every video in the
  // library, so a large collection can be narrowed without leaving the player.
  const [libraryQuery, setLibraryQuery] = useState('');
  const [filterSource, setFilterSource] = useState<SourceFlag | 'ALL'>('ALL');
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [filterScore, setFilterScore] = useState<'all' | 'elite' | 'good' | 'low'>('all');
  const [filterRating, setFilterRating] = useState<'all' | 'rated' | 'unrated' | 'favorites'>('all');
  const [filterDuration, setFilterDuration] = useState<'all' | 'short' | 'medium' | 'long'>('all');
  const [filterPublishedFrom, setFilterPublishedFrom] = useState('');
  const [filterPublishedTo, setFilterPublishedTo] = useState('');
  const [filterTag, setFilterTag] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<
    'score' | 'rating' | 'date_desc' | 'date_asc' | 'title' | 'channel' | 'duration'
  >('score');
  const [libraryPage, setLibraryPage] = useState(0);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());

  const channelOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of allVideos) {
      if (!seen.has(v.channelId)) seen.set(v.channelId, v.channelTitle);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allVideos]);

  const sourceOptions = useMemo(() => {
    const counts = new Map<SourceFlag, number>();
    for (const v of allVideos) {
      for (const flag of v.sourceFlags) counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allVideos]);

  // Tags across the library, so a tag filter never hides a value that only
  // appears outside the current page.
  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of allVideos) {
      for (const tag of [...v.tags, ...(v.personal?.userTags ?? [])]) {
        const key = tag.trim();
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [allVideos]);

  const filteredLibrary = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    const from = filterPublishedFrom ? new Date(filterPublishedFrom).getTime() : null;
    const to = filterPublishedTo ? new Date(filterPublishedTo).getTime() : null;

    const matching = allVideos.filter((v) => {
      if (query) {
        const haystack = `${v.title} ${v.channelTitle} ${v.description} ${(v.tags || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filterSource !== 'ALL' && !v.sourceFlags.includes(filterSource)) return false;
      if (filterChannel !== 'ALL' && v.channelId !== filterChannel) return false;

      if (filterTag !== 'ALL') {
        const videoTags = [...(v.tags || []), ...(v.personal?.userTags ?? [])];
        if (!videoTags.some((t) => t.trim() === filterTag)) return false;
      }

      const score = v.personal?.indexScore ?? 50;
      if (filterScore === 'elite' && score > 20) return false;
      if (filterScore === 'good' && score > 50) return false;
      if (filterScore === 'low' && score < 70) return false;

      const rating = v.personal?.userRating ?? 0;
      if (filterRating === 'rated' && rating <= 0) return false;
      if (filterRating === 'unrated' && rating > 0) return false;
      if (filterRating === 'favorites' && !v.personal?.isFavorite) return false;

      const seconds = v.durationSeconds || 0;
      if (filterDuration === 'short' && seconds >= 300) return false;
      if (filterDuration === 'medium' && (seconds < 300 || seconds > 1200)) return false;
      if (filterDuration === 'long' && seconds <= 1200) return false;

      if (from !== null || to !== null) {
        const published = new Date(v.publishedAt).getTime();
        if (from !== null && published < from) return false;
        if (to !== null && published > to) return false;
      }
      return true;
    });

    const sorted = [...matching];
    sorted.sort((a, b) => {
      const aScore = a.personal?.indexScore ?? 50;
      const bScore = b.personal?.indexScore ?? 50;
      switch (sortBy) {
        case 'rating':
          return (b.personal?.userRating ?? 0) - (a.personal?.userRating ?? 0);
        case 'date_desc':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'date_asc':
          return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'channel':
          return a.channelTitle.localeCompare(b.channelTitle);
        case 'duration':
          return (b.durationSeconds || 0) - (a.durationSeconds || 0);
        case 'score':
        default:
          return aScore - bScore;
      }
    });
    return sorted;
  }, [
    allVideos,
    libraryQuery,
    filterSource,
    filterChannel,
    filterScore,
    filterRating,
    filterDuration,
    filterPublishedFrom,
    filterPublishedTo,
    filterTag,
    sortBy,
  ]);

  // Page the filtered list so a large library stays quick to scan.
  const libraryPageCount = Math.max(1, Math.ceil(filteredLibrary.length / LIBRARY_PAGE_SIZE));
  const safeLibraryPage = Math.min(libraryPage, libraryPageCount - 1);
  const visibleLibrary = filteredLibrary.slice(
    safeLibraryPage * LIBRARY_PAGE_SIZE,
    safeLibraryPage * LIBRARY_PAGE_SIZE + LIBRARY_PAGE_SIZE
  );

  const allVisibleLibrarySelected =
    visibleLibrary.length > 0 && visibleLibrary.every((v) => selectedLibraryIds.has(v.youtubeId));

  const toggleLibrarySelected = (youtubeId: string) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      if (next.has(youtubeId)) next.delete(youtubeId);
      else next.add(youtubeId);
      return next;
    });
  };

  const setVisibleLibrarySelected = (selected: boolean) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      visibleLibrary.forEach((v) => {
        if (selected) next.add(v.youtubeId);
        else next.delete(v.youtubeId);
      });
      return next;
    });
  };

  /** Select/deselect every video matching the current filters, not just the page. */
  const setAllMatchingLibrarySelected = (selected: boolean) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      filteredLibrary.forEach((v) => {
        if (selected) next.add(v.youtubeId);
        else next.delete(v.youtubeId);
      });
      return next;
    });
  };

  const removeSelectedFromLibrary = () => {
    const ids = [...selectedLibraryIds];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Remove ${ids.length} video${ids.length === 1 ? '' : 's'} from your library? Each one is recorded as "Not relevant to me" and can be restored later.`
      )
    ) {
      return;
    }
    ids.forEach((id) => onRequestRemoval(id));
    setSelectedLibraryIds(new Set());
  };

  const favoriteSelectedInLibrary = () => {
    const ids = [...selectedLibraryIds];
    if (ids.length === 0) return;
    ids.forEach((id) => void onUpdatePersonal(id, { isFavorite: true }));
    setSelectedLibraryIds(new Set());
  };

  const hasActiveLibraryFilters =
    libraryQuery.trim().length > 0 ||
    filterSource !== 'ALL' ||
    filterChannel !== 'ALL' ||
    filterTag !== 'ALL' ||
    filterScore !== 'all' ||
    filterRating !== 'all' ||
    filterDuration !== 'all' ||
    filterPublishedFrom !== '' ||
    filterPublishedTo !== '' ||
    sortBy !== 'score';

  const clearLibraryFilters = () => {
    setLibraryQuery('');
    setFilterSource('ALL');
    setFilterChannel('ALL');
    setFilterTag('ALL');
    setFilterScore('all');
    setFilterRating('all');
    setFilterDuration('all');
    setFilterPublishedFrom('');
    setFilterPublishedTo('');
    setSortBy('score');
    setLibraryPage(0);
  };

  // Any filter or sort change invalidates the current page number.
  useEffect(() => {
    setLibraryPage(0);
  }, [
    libraryQuery,
    filterSource,
    filterChannel,
    filterTag,
    filterScore,
    filterRating,
    filterDuration,
    filterPublishedFrom,
    filterPublishedTo,
    sortBy,
  ]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

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
    Xvideos: 'bg-orange-700/20 text-orange-300 border-orange-700/40',
    ArchiveOrg: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    PeerTube: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
    Dailymotion: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
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

      {/* Main Grid: Player on Left, Notes & Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Embed & Details (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Responsive embed. Sources that ship their own player URL (XVideos)
              use it directly; YouTube derives the URL from the video id.

              The iframe is sandboxed without `allow-top-navigation`,
              `allow-popups` or `allow-popups-to-escape-sandbox`, so a tap on the
              embed can play/pause/seek but can never navigate this app away or
              open the source site. Leaving the app is only possible through the
              explicit "Go to Source Site" button below.

              The referrer policy must NOT be `no-referrer`: YouTube's player
              needs a Referer to configure itself and returns "Error 153: Video
              player configuration error" without one. `strict-origin-when-cross-origin`
              sends only this site's origin, which is what YouTube expects. */}
          <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black shadow-2xl border border-slate-800">
            <iframe
              src={
                currentVideo.playback?.embedUrl ||
                `https://www.youtube-nocookie.com/embed/${currentVideo.youtubeId}?autoplay=0&rel=0&modestbranding=1`
              }
              title={currentVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
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
                  Score: {indexScore}
                  <span className="text-[10px] opacity-75">(1=best)</span>
                </span>

                {currentVideo.sourceFlags.map((flag) => (
                  <span
                    key={flag}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      sourceFlagColors[flag] || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {sourceFlagLabel(flag)}
                  </span>
                ))}
              </div>

              {/* Favorite & AI Analysis. Playback stays in the app; opening the
                  original page is the only action that leaves it, and it is
                  explicit via "Go to Source Site". */}
              <div className="flex items-center gap-2">
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-[#ff6600] border border-slate-700 text-xs font-semibold transition hover:text-[#ffaa33] hover:border-orange-500/50 active:scale-95"
                    title="Open this video on its original source site"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Go to Source Site</span>
                  </a>
                )}

                <button
                  onClick={() => setShowAiModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
                  title="Get AI insights about this video"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Insights</span>
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
                  <span>Smart Summary</span>
                  {hasSavedSummary ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Summary saved" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400" title="No summary yet - click to create" />
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

              {/* Tab 1: Smart Summary Content */}
              {activeUnderPlayerTab === 'ai_summary' && (
                <div className="space-y-3">
                  {hasSavedSummary ? (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Saved
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
                          title="Create a new summary"
                        >
                          <RefreshCw className={`w-3 h-3 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
                          <span>Regenerate</span>
                        </button>
                      </div>

                      {/* Saved summary, rendered as an AI-overview style card */}
                      <div className="rounded-2xl bg-slate-950/90 border border-orange-500/20 max-h-72 overflow-y-auto selection:bg-orange-500/30">
                        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/80">
                          <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30">
                            <Sparkles className="w-3 h-3" />
                          </span>
                          <span className="text-[11px] font-bold text-white tracking-wide">AI Overview</span>
                          <span className="text-[10px] text-slate-500 truncate">
                            Generated from the video's title and description
                          </span>
                        </div>
                        <MarkdownSummary
                          markdown={currentVideo.aiSummary ?? ''}
                          className="p-4 text-xs text-slate-200 font-sans"
                        />
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                        <span>Saved to your notes — no need to generate it again.</span>
                      </div>
                    </div>
                  ) : (
                    /* No summary yet - create on demand */
                    <div className="p-6 rounded-2xl bg-slate-950/80 border border-dashed border-slate-800 text-center space-y-3.5 animate-fadeIn">
                      <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto border border-orange-500/20">
                        <Brain className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-white">No Summary Available Yet</h4>
                        <p className="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
                          Click below to create a concise summary from this video's title and
                          description, and save it to your notes.
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
                            <span>Creating Summary & Saving...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Create Summary</span>
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
                    <span>{comments.length} saved comments</span>
                    <button
                      onClick={() => onHarvestComments(currentVideo.youtubeId)}
                      className="text-orange-400 hover:text-orange-300 text-xs font-semibold flex items-center gap-1"
                      title="Collect more comments from YouTube"
                    >
                      <Sparkles className="w-3 h-3" /> Collect More
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
                      No comments saved for this video yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Notes & Details */}
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                Notes & Details
              </h2>
              {isSavedRecently && (
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>

            {/* Score (1 = best, 100 = worst) */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-200">Score (1 = Best, 100 = Worst):</span>
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
                  placeholder="Add custom tag (e.g. Must-Watch, Tutorial)..."
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
                Your Notes:
              </label>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={5}
                placeholder="Write your personal insights, timestamps, takeaways..."
                className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-orange-500 resize-none font-mono"
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSavePersonal}
              title="Save your notes, score, rating, and tags"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-md shadow-orange-600/30 active:scale-95"
            >
              <Save className="w-4 h-4" />
              Save Notes
            </button>
          </div>
        </div>
      </div>

      {/* Library Browser: search, filters, sort and the full scrollable list */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-orange-500" />
            All Library Videos
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Showing{' '}
              <span className="font-mono font-bold text-slate-200">{filteredLibrary.length}</span> of{' '}
              <span className="font-mono font-bold text-slate-200">{allVideos.length}</span>
            </span>
            <span className="text-xs text-slate-500">
              Page <span className="font-mono font-bold text-slate-200">{safeLibraryPage + 1}</span>{' '}
              / {libraryPageCount}
            </span>
            {hasActiveLibraryFilters && (
              <button
                onClick={clearLibraryFilters}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition border border-slate-700"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Search + filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              placeholder="Search your library by title, channel, description or tag..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500"
            />
          </div>

          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Source</span>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as SourceFlag | 'ALL')}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
            >
              <option value="ALL">All sources</option>
              {sourceOptions.map(([flag, count]) => (
                <option key={flag} value={flag}>
                  {sourceFlagLabel(flag)} ({count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Channel</span>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
            >
              <option value="ALL">All channels</option>
              {channelOptions.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tag</span>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
            >
              <option value="ALL">All tags</option>
              {tagOptions.map(([tag, count]) => (
                <option key={tag} value={tag}>
                  {tag} ({count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score</span>
            <select
              value={filterScore}
              onChange={(e) => setFilterScore(e.target.value as typeof filterScore)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
            >
              <option value="all">Any score</option>
              <option value="elite">Top tier (≤ 20)</option>
              <option value="good">Good (≤ 50)</option>
              <option value="low">Low priority (≥ 70)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rating</span>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value as typeof filterRating)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
            >
              <option value="all">Any rating</option>
              <option value="rated">Rated</option>
              <option value="unrated">Unrated</option>
              <option value="favorites">Favorites</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duration</span>
            <select
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value as typeof filterDuration)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
            >
              <option value="all">Any length</option>
              <option value="short">Short (&lt; 5 min)</option>
              <option value="medium">Medium (5–20 min)</option>
              <option value="long">Long (&gt; 20 min)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Published from</span>
            <input
              type="date"
              value={filterPublishedFrom}
              onChange={(e) => setFilterPublishedFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Published to</span>
            <input
              type="date"
              value={filterPublishedTo}
              onChange={(e) => setFilterPublishedTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" /> Sort by
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
            >
              <option value="score">Score (best first)</option>
              <option value="rating">Rating (highest)</option>
              <option value="date_desc">Published (newest)</option>
              <option value="date_asc">Published (oldest)</option>
              <option value="title">Title (A–Z)</option>
              <option value="channel">Channel (A–Z)</option>
              <option value="duration">Duration (longest)</option>
            </select>
          </label>
        </div>

        {/* Bulk actions, scoped to the page or to every match */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setVisibleLibrarySelected(!allVisibleLibrarySelected)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            {allVisibleLibrarySelected ? 'Deselect page' : 'Select page'}
          </button>
          <button
            onClick={() => setAllMatchingLibrarySelected(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            Select all {filteredLibrary.length} matching
          </button>
          <button
            onClick={() => setAllMatchingLibrarySelected(false)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            Deselect all matching
          </button>
          <span className="w-px h-5 bg-slate-700 mx-1" />
          <span className="text-xs text-slate-400">
            Selected <span className="font-mono font-bold text-emerald-300">{selectedLibraryIds.size}</span>
          </span>
          <button
            onClick={favoriteSelectedInLibrary}
            disabled={selectedLibraryIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 disabled:opacity-40 text-amber-200 text-xs font-semibold border border-amber-900/60 transition"
          >
            <Star className="w-3.5 h-3.5" /> Add to favorites
          </button>
          <button
            onClick={removeSelectedFromLibrary}
            disabled={selectedLibraryIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 disabled:opacity-40 text-red-200 text-xs font-semibold border border-red-900/60 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete selected
          </button>
        </div>

        {/* Cards for the current page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleLibrary.map((video) => {
            const isCurrent = video.youtubeId === currentVideo.youtubeId;
            const isSelected = selectedLibraryIds.has(video.youtubeId);
            const score = video.personal?.indexScore ?? 50;
            const rating = video.personal?.userRating ?? 0;
            const thumbnail =
              video.thumbnails?.medium || video.posterUrl || video.thumbnails?.default || '';

            return (
              <div
                key={video.youtubeId}
                className={`flex flex-col rounded-2xl border overflow-hidden transition ${
                  isCurrent
                    ? 'bg-orange-500/15 border-orange-500/40'
                    : isSelected
                      ? 'bg-slate-900/80 border-orange-500/30'
                      : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="relative aspect-video bg-black">
                  <button
                    onClick={() => onSelectVideo(video.youtubeId)}
                    className="block w-full h-full"
                    title="Play this video"
                  >
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={video.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Tv className="w-6 h-6" />
                      </div>
                    )}
                  </button>
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                    {formatDuration(video.durationSeconds)}
                  </div>
                  <label className="absolute top-1.5 left-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleLibrarySelected(video.youtubeId)}
                      className="w-4 h-4 accent-orange-500 cursor-pointer"
                      title={isSelected ? 'Deselect this video' : 'Select this video'}
                    />
                    <span className="text-[10px] font-semibold text-white">
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </label>
                  {isCurrent && (
                    <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-2 py-1 rounded-lg bg-orange-600 text-white">
                      Now Playing
                    </span>
                  )}
                </div>

                <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                  <button
                    onClick={() => onSelectVideo(video.youtubeId)}
                    className="text-left"
                  >
                    <h3
                      className={`text-xs font-bold line-clamp-2 leading-snug ${
                        isCurrent ? 'text-orange-300' : 'text-white'
                      }`}
                    >
                      {video.title}
                    </h3>
                  </button>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                    <span className="text-orange-400/90 truncate">{video.channelTitle}</span>
                    <span>·</span>
                    <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
                      Score {score}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {rating}%
                    </span>
                    {video.personal?.isFavorite && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-current" /> Fav
                      </span>
                    )}
                    {video.sourceFlags.slice(0, 2).map((flag) => (
                      <span
                        key={flag}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          sourceFlagColors[flag] || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {sourceFlagLabel(flag)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {visibleLibrary.length === 0 && (
            <div className="col-span-full py-10 text-center space-y-2">
              <p className="text-xs text-slate-300">No videos match your search or filters.</p>
              {hasActiveLibraryFilters && (
                <button
                  onClick={clearLibraryFilters}
                  className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredLibrary.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={() => setLibraryPage(0)}
              disabled={safeLibraryPage === 0}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              « First
            </button>
            <button
              onClick={() => setLibraryPage(safeLibraryPage - 1)}
              disabled={safeLibraryPage === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="px-2 text-xs text-slate-400">
              Page <span className="font-mono font-bold text-slate-200">{safeLibraryPage + 1}</span>{' '}
              of <span className="font-mono font-bold text-slate-200">{libraryPageCount}</span>
            </span>
            <button
              onClick={() => setLibraryPage(safeLibraryPage + 1)}
              disabled={safeLibraryPage >= libraryPageCount - 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLibraryPage(libraryPageCount - 1)}
              disabled={safeLibraryPage >= libraryPageCount - 1}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              Last »
            </button>
          </div>
        )}
      </div>

      {/* Comments for this Video */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-orange-500" />
              Saved Comments ({comments.length})
            </h2>
            <p className="text-xs text-slate-400">
              Collected from YouTube and saved to your library
            </p>
          </div>

          <button
            onClick={() => onHarvestComments(currentVideo.youtubeId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
            title="Collect the top comments from YouTube"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            View Top Comments
          </button>
        </div>

        {comments.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No comments saved for this video yet. Click "View Top Comments" to collect discussion insights.
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

      {/* AI Insights Modal */}
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
