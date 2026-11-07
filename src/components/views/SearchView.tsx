import React, { useEffect, useMemo, useState } from 'react';
import { VideoMetadata, TasteProfile, type TasteSignal } from '../../types';
import { Search, Loader2, Sparkles, Zap, TriangleAlert } from 'lucide-react';
import { YouTubeApiClient } from '../../services/youtubeApi';
import { openSourceById, type OpenSourceId } from '../../services/openSourcesApi';
import { searchOpenSourcesCached } from '../../services/searchApi';
import { readEnabledOpenSources, subscribeSearchSources } from '../../services/searchSources';
import { rankCandidates } from '../../services/tasteProfile';
import { ApiErrorCard } from '../ApiErrorCard';
import { SearchResultCard } from '../SearchResultCard';
import { VideoFilterBar } from '../VideoFilterBar';
import { VideoPagination } from '../VideoPagination';
import {
  DEFAULT_VIDEO_FILTERS,
  hasActiveVideoFilters,
  matchesVideoFilters,
  paginate,
  sortVideos,
  type VideoFilterState,
} from '../../services/videoFilter';

interface SearchViewProps {
  /** Saves a result to the library; only the Save button calls this. */
  onIndexVideo: (video: VideoMetadata) => void;
  onExpandChannel: (channelId: string, channelTitle: string) => void;
  /**
   * Opens a result in the full player without saving it. The whole (filtered,
   * sorted) result list is passed as the play queue so the player's prev/next
   * walks the results the user is looking at.
   */
  onPlayVideo: (video: VideoMetadata, queue: VideoMetadata[], label: string) => void;
  indexedVideoIds: Set<string>;
  accessToken?: string | null;
  userEmail?: string | null;
  tasteProfile: TasteProfile;
}

/** Cards per page in the results grid. */
const SEARCH_PAGE_SIZE = 24;

export const SearchView: React.FC<SearchViewProps> = ({
  onIndexVideo,
  onExpandChannel,
  onPlayVideo,
  indexedVideoIds,
  accessToken,
  userEmail,
  tasteProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState('System Design Explained');
  const [isSearching, setIsSearching] = useState(false);
  const [isLiveSearchActive, setIsLiveSearchActive] = useState(false);
  const [filters, setFilters] = useState<VideoFilterState>(DEFAULT_VIDEO_FILTERS);
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<VideoMetadata[]>([]);
  const [openResults, setOpenResults] = useState<VideoMetadata[]>([]);
  const [openSearchErrors, setOpenSearchErrors] = useState<Partial<Record<OpenSourceId, string>>>({});
  // Which open sources to query. This is a user preference set in Settings and
  // persisted, so search reads it here (and re-reads it when Settings saves) but
  // does not offer its own toggles — Settings is the single place to change it.
  const [selectedOpenSources, setSelectedOpenSources] = useState<Set<OpenSourceId>>(
    () => new Set(readEnabledOpenSources())
  );
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Personalized ranking is on by default: removal reasons should change what you see.
  const [personalize, setPersonalize] = useState(true);

  // Quick prompt pills
  const suggestedQueries = [
    'System Design Explained',
    'TypeScript Fundamentals',
    'Web Development Tips',
    'Database Basics',
    'Full-Stack Tutorials',
  ];

  // Reflect changes made in Settings (or another tab) without a reload.
  useEffect(
    () => subscribeSearchSources((ids) => setSelectedOpenSources(new Set(ids))),
    []
  );

  const handleSearch = async (query = searchTerm) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setOpenSearchErrors({});
    // A fresh search starts from a clean filter set and the first page.
    setFilters(DEFAULT_VIDEO_FILTERS);
    setPage(0);

    const openIds = [...selectedOpenSources];

    // Open sources need no sign-in, so they run regardless of YouTube auth.
    const openPromise: Promise<void> =
      openIds.length > 0
        ? searchOpenSourcesCached(openIds, query).then((outcomes) => {
            setOpenResults(outcomes.flatMap((o) => o.videos));
            const errors: Partial<Record<OpenSourceId, string>> = {};
            outcomes.forEach((o) => {
              if (o.error) errors[o.id] = o.error;
            });
            setOpenSearchErrors(errors);
          })
        : Promise.resolve().then(() => {
            setOpenResults([]);
          });

    if (!accessToken) {
      setResults([]);
      setIsLiveSearchActive(false);
      setSearchError('Sign in with Google to search YouTube. CloudTube does not generate placeholder results.');
      await openPromise;
      setIsSearching(false);
      return;
    }

    try {
      const [liveResults] = await Promise.all([
        YouTubeApiClient.searchVideos(accessToken, query),
        openPromise,
      ]);
      setResults(liveResults);
      setIsLiveSearchActive(true);
    } catch (err: any) {
      console.error('Live YouTube search failed:', err);
      setResults([]);
      setIsLiveSearchActive(false);
      setSearchError(err?.message || 'Search failed. Check your Google sign-in and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const combinedResults = useMemo(
    () => [...results, ...openResults],
    [results, openResults]
  );

  // Apply the learned taste profile first: demote penalized tags and mute
  // channels. Falls back to the raw order when personalization is off or
  // nothing has been removed yet.
  const ranked = useMemo(() => {
    if (!personalize || tasteProfile.totalRemovals === 0) {
      return combinedResults.map((video) => ({
        video,
        assessment: { penalty: 0, muted: false, signals: [] as TasteSignal[] },
        adjustedScore: video.personal?.indexScore ?? 50,
      }));
    }
    return rankCandidates(combinedResults, tasteProfile);
  }, [combinedResults, personalize, tasteProfile]);

  // The same filters the library offers apply to every search result.
  const filteredRanked = useMemo(
    () => ranked.filter((r) => matchesVideoFilters(r.video, filters)),
    [ranked, filters]
  );

  const sortedRanked = useMemo(() => {
    if (filters.sort === 'score') {
      // Score sort follows the personalized order: muted last, then best first.
      return filteredRanked
        .slice()
        .sort(
          (a, b) =>
            (a.assessment.muted ? 1 : 0) - (b.assessment.muted ? 1 : 0) ||
            a.adjustedScore - b.adjustedScore
        );
    }
    const order = new Map(
      sortVideos(
        filteredRanked.map((r) => r.video),
        filters.sort
      ).map((video, index) => [video.youtubeId, index])
    );
    return filteredRanked
      .slice()
      .sort((a, b) => (order.get(a.video.youtubeId) ?? 0) - (order.get(b.video.youtubeId) ?? 0));
  }, [filteredRanked, filters.sort]);

  const {
    page: safePage,
    pageCount,
    items: rankedResults,
  } = paginate(sortedRanked, page, SEARCH_PAGE_SIZE);

  const personalizedCount = filteredRanked.filter(
    (r) => r.assessment.penalty > 0 || r.assessment.muted
  ).length;

  // The videos the full player walks with prev/next when a result is opened: the
  // whole filtered, sorted result list, so navigation continues across pages.
  const resultQueue = useMemo(() => sortedRanked.map((r) => r.video), [sortedRanked]);

  const failedSources = (Object.keys(openSearchErrors) as OpenSourceId[]).map(
    (id) => openSourceById(id).name
  );

  const updateFilters = (patch: Partial<VideoFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_VIDEO_FILTERS);
    setPage(0);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Search Form */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-orange-500" />
              Search & Collect
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Search YouTube with your Google sign-in, and the key-free catalogues you enable
              in Settings with no sign-in. Play a result right here, or save it.
            </p>
          </div>

          {accessToken ? (
            <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Connected to YouTube</span>
            </div>
          ) : (
            <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-slate-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sign in to search YouTube</span>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search YouTube videos, topics, or channel URLs..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-orange-600/30 active:scale-95"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </div>

        {/* Which sources a search runs against is a Settings choice, not a
            per-search toggle, so the page only states it. */}
        <p className="text-[11px] text-slate-500">
          Searching the {selectedOpenSources.size} source
          {selectedOpenSources.size === 1 ? '' : 's'} you enabled in Settings — no sign-in needed,
          and results play inside the app. Change them under Settings → Search Sources.
        </p>

        {/* Suggestion Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold shrink-0">
            Popular:
          </span>
          {suggestedQueries.map((q) => (
            <button
              key={q}
              onClick={() => {
                setSearchTerm(q);
                handleSearch(q);
              }}
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white shrink-0 transition text-xs"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* The same search, filter and sort controls the library offers, applied
          to every result — YouTube and open sources alike. */}
      {combinedResults.length > 0 && (
        <VideoFilterBar
          videos={combinedResults}
          filters={filters}
          onChange={updateFilters}
          onClear={clearFilters}
          searchPlaceholder="Filter results by title, channel, description or tag..."
          headerExtra={
            <button
              onClick={() => setPersonalize(!personalize)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition border ${
                personalize
                  ? 'bg-orange-500/15 text-orange-300 border-orange-500/40'
                  : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Use your removal reasons to re-rank and mute results"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {personalize
                ? `Personalized${personalizedCount > 0 ? ` (${personalizedCount})` : ''}`
                : 'Personalized: Off'}
            </button>
          }
        />
      )}

      {/* Results Grid */}
      {isSearching && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-white">Searching YouTube and checking sources...</p>
          <p className="text-xs text-slate-400">This can take a moment</p>
        </div>
      )}

      {!isSearching && failedSources.length > 0 && (
        <p className="text-xs text-amber-300/90 px-1 flex items-center gap-1.5">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
          {failedSources.join(', ')} did not respond — showing results from the other sources.
        </p>
      )}

      {!isSearching && rankedResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rankedResults.map(({ video, assessment, adjustedScore }) => (
            <SearchResultCard
              key={video.youtubeId}
              video={video}
              assessment={assessment}
              adjustedScore={adjustedScore}
              isIndexed={indexedVideoIds.has(video.youtubeId)}
              resultQueue={resultQueue}
              queueLabel="Search results"
              onIndexVideo={onIndexVideo}
              onPlayVideo={onPlayVideo}
              onExpandChannel={onExpandChannel}
            />
          ))}
        </div>
      )}

      {!isSearching && sortedRanked.length > 0 && (
        <VideoPagination page={safePage} pageCount={pageCount} onPage={setPage} />
      )}

      {/* YouTube needs a sign-in; open-source results still show, so only treat
          the YouTube error as blocking when nothing at all came back. */}
      {!isSearching && searchError && combinedResults.length === 0 && (
        <ApiErrorCard message={searchError} title="Search unavailable" />
      )}

      {!isSearching && searchError && combinedResults.length > 0 && (
        <p className="text-xs text-amber-300/90 px-1">
          YouTube search needs a Google sign-in right now — showing results from the open sources.
        </p>
      )}

      {!isSearching && hasSearched && !searchError && sortedRanked.length === 0 && (
        <div className="py-16 text-center space-y-2">
          <p className="text-sm font-semibold text-white">
            {combinedResults.length > 0 && hasActiveVideoFilters(filters)
              ? 'No results match your filters.'
              : 'No results matched your search term.'}
          </p>
          {combinedResults.length > 0 && hasActiveVideoFilters(filters) ? (
            <button
              onClick={clearFilters}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
            >
              Clear filters
            </button>
          ) : (
            <p className="text-xs text-slate-400">
              Try searching for "System Design" or "Web Development".
            </p>
          )}
        </div>
      )}

      {/* Initial state before search */}
      {!hasSearched && (
        <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Search YouTube & Discover Videos Worth Saving</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Search YouTube with your Google sign-in, or the key-free catalogues
            with no sign-in. Type any topic or click a suggested search to find
            videos, score them, play them right here, and save the ones you want.
          </p>
          <button
            onClick={() => handleSearch('System Design Explained')}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition shadow-md"
          >
            Search YouTube
          </button>
        </div>
      )}
    </div>
  );
};
