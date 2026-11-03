import React, { useState, useEffect, useMemo } from 'react';
import { VideoMetadata, VideoComment, PersonalMetadata, SourceFlag } from '../../types';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Trash2,
  Tv,
  Search,
  ListFilter,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { sourceFlagLabel } from '../../data/sourceLabels';
import { SelectedVideoPage } from './SelectedVideoPage';

/** Cards per page in the library browser. */
const LIBRARY_PAGE_SIZE = 24;

interface VideosPageProps {
  selectedVideo: VideoMetadata | null;
  allVideos: VideoMetadata[];
  comments: VideoComment[];
  onSelectVideo: (youtubeId: string) => void;
  onUpdatePersonal: (youtubeId: string, personal: Partial<PersonalMetadata>) => Promise<void>;
  onHarvestComments: (youtubeId: string) => void;
  onUpdateAiSummary: (youtubeId: string, aiSummary: string) => Promise<void>;
  onRequestRemoval: (youtubeId: string) => void;
  onBackToVideos: () => void;
}

/**
 * The Videos page. With no video selected it is the listing only: search,
 * filters, sorting, bulk actions and pagination over every library video. Once
 * a video is selected it hands off to SelectedVideoPage, the dedicated video
 * page that owns the full details and comments.
 */
export const VideosPage: React.FC<VideosPageProps> = ({
  selectedVideo,
  allVideos,
  comments,
  onSelectVideo,
  onUpdatePersonal,
  onHarvestComments,
  onUpdateAiSummary,
  onRequestRemoval,
  onBackToVideos,
}) => {
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
    Eporner: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    AdultEmbed: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    RedGifs: 'bg-red-500/20 text-red-300 border-red-500/30',
    Pornhub: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Xhamster: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    Redtube: 'bg-red-600/20 text-red-300 border-red-600/30',
  };

  if (selectedVideo) {
    return (
      <SelectedVideoPage
        currentVideo={selectedVideo}
        allVideos={allVideos}
        comments={comments.filter((c) => c.videoId === selectedVideo.youtubeId)}
        onSelectVideo={onSelectVideo}
        onHarvestComments={onHarvestComments}
        onUpdatePersonal={onUpdatePersonal}
        onUpdateAiSummary={onUpdateAiSummary}
        onRequestRemoval={onRequestRemoval}
        onBack={onBackToVideos}
      />
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
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
            const isSelected = selectedLibraryIds.has(video.youtubeId);
            const score = video.personal?.indexScore ?? 50;
            const rating = video.personal?.userRating ?? 0;
            const thumbnail =
              video.thumbnails?.medium || video.posterUrl || video.thumbnails?.default || '';

            return (
              <div
                key={video.youtubeId}
                className={`flex flex-col rounded-2xl border overflow-hidden transition ${
                  isSelected
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

                </div>

                <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                  <button
                    onClick={() => onSelectVideo(video.youtubeId)}
                    className="text-left"
                  >
                    <h3 className="text-xs font-bold line-clamp-2 leading-snug text-white">
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
    </div>
  );
};
