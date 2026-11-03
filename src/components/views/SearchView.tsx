import React, { useEffect, useMemo, useState } from 'react';
import {
  VideoMetadata,
  SourceFlag,
  CrawlJob,
  TasteProfile,
} from '../../types';
import {
  Search,
  Filter,
  Check,
  Plus,
  Play,
  Tv,
  Star,
  ExternalLink,
  SlidersHorizontal,
  Loader2,
  Sparkles,
  Zap,
  Ban,
  TrendingDown,
} from 'lucide-react';
import { YouTubeApiClient } from '../../services/youtubeApi';
import {
  OPEN_SOURCES,
  searchAllOpenSources,
  openSourceById,
  type OpenSourceId,
} from '../../services/openSourcesApi';
import {
  readEnabledOpenSources,
  saveEnabledOpenSources,
  subscribeSearchSources,
} from '../../services/searchSources';
import { rankCandidates } from '../../services/tasteProfile';
import { sourceFlagLabel } from '../../data/sourceLabels';
import { ApiErrorCard } from '../ApiErrorCard';

interface SearchViewProps {
  onIndexVideo: (video: VideoMetadata) => void;
  onExpandChannel: (channelId: string, channelTitle: string) => void;
  onPlayVideo: (youtubeId: string) => void;
  indexedVideoIds: Set<string>;
  accessToken?: string | null;
  userEmail?: string | null;
  tasteProfile: TasteProfile;
}

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
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<SourceFlag | 'ALL'>('ALL');
  const [results, setResults] = useState<VideoMetadata[]>([]);
  const [openResults, setOpenResults] = useState<VideoMetadata[]>([]);
  const [openSearchErrors, setOpenSearchErrors] = useState<Partial<Record<OpenSourceId, string>>>({});
  // Which open sources to query. This is a user preference set in Settings and
  // persisted, so the quick toggles here and the Settings checkboxes stay in
  // sync through one source of truth.
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

  // Reflect changes made in Settings (or another tab) without a reload.
  useEffect(
    () => subscribeSearchSources((ids) => setSelectedOpenSources(new Set(ids))),
    []
  );

  const toggleOpenSource = (id: OpenSourceId) => {
    setSelectedOpenSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveEnabledOpenSources([...next]);
      return next;
    });
  };

  const handleSearch = async (query = searchTerm) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setOpenSearchErrors({});

    const openIds = [...selectedOpenSources];

    // Open sources need no sign-in, so they run regardless of YouTube auth.
    const openPromise: Promise<void> =
      openIds.length > 0
        ? searchAllOpenSources(openIds, query).then((outcomes) => {
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

  const filteredResults =
    selectedSourceFilter === 'ALL'
      ? combinedResults
      : combinedResults.filter((r) => r.sourceFlags.includes(selectedSourceFilter));

  // Apply the learned taste profile: demote penalized tags and sort muted
  // channels to the end. Falls back to the raw order when personalization is off
  // or nothing has been removed yet.
  const rankedResults = useMemo(() => {
    if (!personalize || tasteProfile.totalRemovals === 0) {
      return filteredResults.map((video) => ({
        video,
        assessment: { penalty: 0, muted: false, signals: [] },
        adjustedScore: video.personal?.indexScore ?? 50,
      }));
    }
    return rankCandidates(filteredResults, tasteProfile);
  }, [filteredResults, personalize, tasteProfile]);

  const personalizedCount = rankedResults.filter(
    (r) => r.assessment.penalty > 0 || r.assessment.muted
  ).length;

  const formatViews = (views: number) => {
    if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + 'M views';
    if (views >= 1_000) return (views / 1_000).toFixed(1) + 'k views';
    return views + ' views';
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
              in Settings with no sign-in. Save anything worth keeping.
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

        {/* Open sources: key-free plus the key-gated ones the user enables */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 shrink-0">
            Also search:
          </span>
          {OPEN_SOURCES.map((source) => {
            const active = selectedOpenSources.has(source.id);
            const error = openSearchErrors[source.id];
            return (
              <button
                key={source.id}
                onClick={() => toggleOpenSource(source.id)}
                title={error ? `Last search failed: ${error}` : source.tagline}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                  active
                    ? source.accent + ' ring-1 ring-white/10'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {source.name}
                {error ? ' ⚠' : ''}
              </button>
            );
          })}
          <span className="text-[11px] text-slate-500">
            No sign-in needed. Results play inside the app.
          </span>
        </div>

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

      {/* Filter by Source Flags + personalization toggle */}
      {combinedResults.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-slate-300">Source:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedSourceFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                selectedSourceFilter === 'ALL'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Sources ({combinedResults.length})
            </button>

            {(
              [
                'YouTubeSearch',
                'Google',
                'Reddit',
                'X',
                'LinkedIn',
                'Playlist',
                'ArchiveOrg',
                'PeerTube',
                'Dailymotion',
                'Eporner',
                'AdultEmbed',
                'RedGifs',
              ] as SourceFlag[]
            ).map((flag) => {
              const count = combinedResults.filter((r) => r.sourceFlags.includes(flag)).length;
              if (count === 0) return null;
              return (
                <button
                  key={flag}
                  onClick={() => setSelectedSourceFilter(flag)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                    selectedSourceFilter === flag
                      ? sourceFlagColors[flag] + ' ring-1 ring-white/20'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {sourceFlagLabel(flag)} ({count})
                </button>
              );
            })}
          </div>

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
            {personalize ? `Personalized${personalizedCount > 0 ? ` (${personalizedCount})` : ''}` : 'Personalized: Off'}
          </button>
        </div>
      )}

      {/* Results Grid */}
      {isSearching && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-white">Searching YouTube and checking sources...</p>
          <p className="text-xs text-slate-400">This can take a moment</p>
        </div>
      )}

      {!isSearching && rankedResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rankedResults.map(({ video, assessment, adjustedScore }) => {
            const isIndexed = indexedVideoIds.has(video.youtubeId);
            const demoted = assessment.penalty > 0 || assessment.muted;
            // Open-source results carry their own embed and have no YouTube
            // channel to expand, so they play in-app without a sign-in.
            const isOpenSource = !!video.playback;
            const playVideo = () => {
              if (isOpenSource && !isIndexed) onIndexVideo(video);
              onPlayVideo(video.youtubeId);
            };

            return (
              <div
                key={video.youtubeId}
                className={`flex flex-col rounded-2xl bg-slate-900/80 border overflow-hidden transition group shadow-md ${
                  assessment.muted
                    ? 'border-red-900/50 opacity-80 hover:opacity-100'
                    : 'border-slate-800 hover:border-orange-500/50'
                }`}
              >
                {/* Thumbnail Header */}
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  <img
                    src={video.thumbnails.medium}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                  {/* Play Overlay */}
                  <button
                    onClick={playVideo}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40"
                  >
                    <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-xl hover:scale-110 transition">
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </div>
                  </button>

                  {/* Duration Badge */}
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 font-mono text-[11px] font-semibold text-white">
                    {video.duration.replace('PT', '').toLowerCase()}
                  </div>

                  {/* Pre-calculated score, adjusted by the taste profile */}
                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-orange-600/90 backdrop-blur-xs text-white text-[11px] font-extrabold shadow-md flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    <span>Score: {adjustedScore}</span>
                    {demoted && (
                      <span className="text-[10px] font-bold text-amber-200" title={`Taste penalty -${assessment.penalty}`}>
                        (base {video.personal?.indexScore ?? 50})
                      </span>
                    )}
                  </div>

                  {/* Taste profile badges */}
                  {assessment.muted && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-red-600/90 text-white text-[10px] font-extrabold shadow-md flex items-center gap-1">
                      <Ban className="w-3 h-3" /> Muted channel
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-orange-400/90">{video.channelTitle}</span>
                      <span>{isOpenSource ? '' : formatViews(video.viewCount)}</span>
                    </div>

                    <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-orange-400 transition">
                      {video.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2">{video.description}</p>
                  </div>

                  {/* Source Flags */}
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {video.sourceFlags.map((flag) => (
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

                  {/* Why this video was demoted by the learned taste profile */}
                  {demoted && (
                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-600/30 space-y-1">
                      <div className="text-[10px] font-bold text-amber-300 flex items-center gap-1 uppercase tracking-wider">
                        <TrendingDown className="w-3 h-3" /> Demoted by your removals
                      </div>
                      <ul className="space-y-0.5">
                        {assessment.signals.slice(0, 3).map((signal, i) => (
                          <li key={i} className="text-[10px] text-amber-200/90 flex items-center justify-between gap-2">
                            <span className="truncate">{signal.label}</span>
                            <span className="font-mono shrink-0">-{signal.penalty}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions: Save to library & collect channel */}
                  <div className="pt-2 flex items-center gap-2 border-t border-slate-800/80">
                    <button
                      onClick={() => onIndexVideo(video)}
                      disabled={isIndexed}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition active:scale-95 ${
                        isIndexed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-orange-600 hover:bg-orange-500 text-white shadow-sm'
                      }`}
                    >
                      {isIndexed ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Saved
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" /> Save
                        </>
                      )}
                    </button>

                    {isOpenSource ? (
                      <button
                        onClick={playVideo}
                        className="flex items-center gap-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 border border-slate-700"
                        title="Play this video inside CloudTube"
                      >
                        <Play className="w-3.5 h-3.5 text-orange-400" />
                        <span>Play</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onExpandChannel(video.channelId, video.channelTitle)}
                        className="flex items-center gap-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 border border-slate-700"
                        title="Collect every video from this channel"
                      >
                        <Tv className="w-3.5 h-3.5 text-orange-400" />
                        <span>Collect Channel</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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

      {!isSearching && hasSearched && !searchError && rankedResults.length === 0 && (
        <div className="py-16 text-center space-y-2">
          <p className="text-sm font-semibold text-white">No results matched your search term.</p>
          <p className="text-xs text-slate-400">Try searching for "System Design" or "Web Development".</p>
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
            Search YouTube with your Google sign-in, or Archive.org, PeerTube, Dailymotion
            and Eporner with no sign-in. Type any topic or click a suggested search to find
            videos, score them, and save them to your library.
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
