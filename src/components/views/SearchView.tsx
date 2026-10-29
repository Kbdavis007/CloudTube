import React, { useState } from 'react';
import {
  VideoMetadata,
  SourceFlag,
  CrawlJob,
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
} from 'lucide-react';
import { YouTubeApiClient } from '../../services/youtubeApi';

interface SearchViewProps {
  onIndexVideo: (video: VideoMetadata) => void;
  onExpandChannel: (channelId: string, channelTitle: string) => void;
  onPlayVideo: (youtubeId: string) => void;
  indexedVideoIds: Set<string>;
  accessToken?: string | null;
  userEmail?: string | null;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onIndexVideo,
  onExpandChannel,
  onPlayVideo,
  indexedVideoIds,
  accessToken,
  userEmail,
}) => {
  const [searchTerm, setSearchTerm] = useState('Cloudflare Workers & D1');
  const [isSearching, setIsSearching] = useState(false);
  const [isLiveSearchActive, setIsLiveSearchActive] = useState(false);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<SourceFlag | 'ALL'>('ALL');
  const [results, setResults] = useState<VideoMetadata[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Quick prompt pills
  const sampleQueries = [
    'Cloudflare Workers & D1',
    'System Design YouTube Architecture',
    'TypeScript Edge Runtimes',
    'Durable Objects & Queues',
    'Full-Stack SQLite at the Edge',
  ];

  const sourceFlagColors: Record<SourceFlag, string> = {
    YouTubeSearch: 'bg-red-500/20 text-red-400 border-red-500/30',
    ChannelUploads: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Google: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Reddit: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
    X: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    LinkedIn: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
    Playlist: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  const handleSearch = async (query = searchTerm) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);

    // 1. If user is signed in with Google, query live YouTube Data API
    if (accessToken) {
      try {
        const liveResults = await YouTubeApiClient.searchVideos(accessToken, query);
        if (liveResults && liveResults.length > 0) {
          setResults(liveResults);
          setIsLiveSearchActive(true);
          setIsSearching(false);
          return;
        }
      } catch (err) {
        console.warn('Live YouTube search failed, falling back to edge crawler simulator:', err);
      }
    }

    setIsLiveSearchActive(false);
    // 2. High-fidelity edge crawler simulator fallback
    setTimeout(() => {
      const mockResults: VideoMetadata[] = [
        {
          id: crypto.randomUUID(),
          youtubeId: 'kJQP7kiw5Fk',
          title: 'Building Full-Stack Edge Apps with Cloudflare D1, Workers & R2',
          description: 'Learn how to architect stateful, low-latency applications at the edge using Cloudflare D1 (serverless SQLite), Workers KV for caching, and R2 object storage.',
          tags: ['Cloudflare', 'D1', 'Workers', 'R2', 'TypeScript'],
          channelId: 'UC_cloudflare_official',
          channelTitle: 'Cloudflare',
          publishedAt: '2026-03-15T14:30:00Z',
          duration: 'PT24M10S',
          durationSeconds: 1450,
          viewCount: 89400,
          likeCount: 4120,
          commentCount: 382,
          thumbnails: {
            default: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
            medium: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
            high: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1280&auto=format&fit=crop&q=80',
          },
          sourceFlags: ['YouTubeSearch', 'Google'],
          indexedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          personal: {
            videoId: 'kJQP7kiw5Fk',
            indexScore: 8,
            userRating: 94,
            userNotes: 'High quality reference on D1 prepared statements and bulk writes.',
            userTags: ['Cloudflare', 'Edge', 'Must-Watch'],
          },
        },
        {
          id: crypto.randomUUID(),
          youtubeId: 'M576WGiDBdQ',
          title: 'Cloudflare Queues & Durable Objects: Stateful Job Orchestration Explained',
          description: 'Deep dive into background job scheduling, rate limiting, and distributed state coordination using Cloudflare Durable Objects and Queues.',
          tags: ['Durable Objects', 'Queues', 'Cloudflare', 'Background Jobs'],
          channelId: 'UC_cloudflare_official',
          channelTitle: 'Cloudflare',
          publishedAt: '2026-04-02T10:15:00Z',
          duration: 'PT18M45S',
          durationSeconds: 1125,
          viewCount: 64200,
          likeCount: 3200,
          commentCount: 195,
          thumbnails: {
            default: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&auto=format&fit=crop&q=80',
            medium: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&auto=format&fit=crop&q=80',
            high: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1280&auto=format&fit=crop&q=80',
          },
          sourceFlags: ['YouTubeSearch', 'Reddit'],
          indexedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          personal: {
            videoId: 'M576WGiDBdQ',
            indexScore: 10,
            userRating: 90,
            userNotes: 'Singleton DO pattern for quota enforcement.',
            userTags: ['Architecture', 'Queues'],
          },
        },
        {
          id: crypto.randomUUID(),
          youtubeId: '7Q1qF2V1Y4w',
          title: 'Cloudflare Hyperdrive: Accelerate Global Database Queries to Single-Digit Milliseconds',
          description: 'How Hyperdrive creates connection pooling and query caching at 300+ data centers across the globe without changing your database connection strings.',
          tags: ['Hyperdrive', 'Postgres', 'Edge', 'Latency'],
          channelId: 'UC_cloudflare_official',
          channelTitle: 'Cloudflare',
          publishedAt: '2026-01-20T12:00:00Z',
          duration: 'PT12M30S',
          durationSeconds: 750,
          viewCount: 41800,
          likeCount: 2190,
          commentCount: 120,
          thumbnails: {
            default: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
            medium: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
            high: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1280&auto=format&fit=crop&q=80',
          },
          sourceFlags: ['YouTubeSearch', 'LinkedIn', 'X'],
          indexedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          personal: {
            videoId: '7Q1qF2V1Y4w',
            indexScore: 15,
            userRating: 88,
            userNotes: 'Examines connection pooling vs serverless cold starts.',
            userTags: ['Hyperdrive', 'Databases'],
          },
        },
        {
          id: crypto.randomUUID(),
          youtubeId: 'bMknfKXIFA8',
          title: 'System Design 101: How YouTube Serves Billions of Videos Daily',
          description: 'Complete YouTube architectural breakdown: CDN edge caching, video transcoding pipelines, metadata database sharding, and real-time recommendation engines.',
          tags: ['YouTube', 'Architecture', 'System Design'],
          channelId: 'UC_bytebytego_sys',
          channelTitle: 'ByteByteGo',
          publishedAt: '2025-11-12T16:00:00Z',
          duration: 'PT15M30S',
          durationSeconds: 930,
          viewCount: 1420000,
          likeCount: 88500,
          commentCount: 2450,
          thumbnails: {
            default: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80',
            medium: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80',
            high: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1280&auto=format&fit=crop&q=80',
          },
          sourceFlags: ['YouTubeSearch', 'Reddit', 'Google'],
          indexedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          personal: {
            videoId: 'bMknfKXIFA8',
            indexScore: 5,
            userRating: 96,
            userNotes: 'Video chunking and CDN delivery fundamentals.',
            userTags: ['System-Design', 'Video-Streaming'],
          },
        },
        {
          id: crypto.randomUUID(),
          youtubeId: 'cuHDQhDhvPE',
          title: 'TypeScript in 100 Seconds + Complete Modern Edge Setup',
          description: 'A rapid overview of TypeScript features, strict mode, generics, and setting up type safety across full-stack edge runtimes.',
          tags: ['TypeScript', 'JavaScript', 'Edge'],
          channelId: 'UC_fireship_dev',
          channelTitle: 'Fireship',
          publishedAt: '2025-08-19T18:00:00Z',
          duration: 'PT02M15S',
          durationSeconds: 135,
          viewCount: 890000,
          likeCount: 67000,
          commentCount: 1420,
          thumbnails: {
            default: 'https://images.unsplash.com/photo-1516116211227-bbc1552a425a?w=600&auto=format&fit=crop&q=80',
            medium: 'https://images.unsplash.com/photo-1516116211227-bbc1552a425a?w=600&auto=format&fit=crop&q=80',
            high: 'https://images.unsplash.com/photo-1516116211227-bbc1552a425a?w=1280&auto=format&fit=crop&q=80',
          },
          sourceFlags: ['YouTubeSearch', 'Playlist'],
          indexedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          personal: {
            videoId: 'cuHDQhDhvPE',
            indexScore: 12,
            userRating: 90,
            userNotes: 'Concise summary of TS benefits in edge workers.',
            userTags: ['TypeScript'],
          },
        },
      ];

      setResults(mockResults);
      setIsSearching(false);
    }, 600);
  };

  const filteredResults =
    selectedSourceFilter === 'ALL'
      ? results
      : results.filter((r) => r.sourceFlags.includes(selectedSourceFilter));

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
              Search & Multi-Source Harvester
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Search YouTube Data API, discover channels, and harvest metadata enriched with source flags
              (YouTube Search, Reddit, X, LinkedIn, Google, Playlists).
            </p>
          </div>

          {accessToken ? (
            <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Live YouTube API Active</span>
            </div>
          ) : (
            <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Edge Crawler Simulator</span>
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
            <span>Harvest Results</span>
          </button>
        </div>

        {/* Suggestion Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold shrink-0">
            Popular:
          </span>
          {sampleQueries.map((q) => (
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

      {/* Filter by Source Flags */}
      {results.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-slate-300">Filter Source Flag:</span>
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
              All Sources ({results.length})
            </button>

            {(['YouTubeSearch', 'Google', 'Reddit', 'X', 'LinkedIn', 'Playlist'] as SourceFlag[]).map((flag) => {
              const count = results.filter((r) => r.sourceFlags.includes(flag)).length;
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
                  {flag} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Grid */}
      {isSearching && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-white">Querying YouTube API & crawling source links...</p>
          <p className="text-xs text-slate-400">Verifying quota limits via QuotaManagerDO</p>
        </div>
      )}

      {!isSearching && filteredResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResults.map((video) => {
            const isIndexed = indexedVideoIds.has(video.youtubeId);

            return (
              <div
                key={video.youtubeId}
                className="flex flex-col rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden hover:border-orange-500/50 transition group shadow-md"
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
                    onClick={() => onPlayVideo(video.youtubeId)}
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

                  {/* Pre-calculated IndexScore */}
                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-orange-600/90 backdrop-blur-xs text-white text-[11px] font-extrabold shadow-md flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    <span>Score: {video.personal?.indexScore ?? 15}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-orange-400/90">{video.channelTitle}</span>
                      <span>{formatViews(video.viewCount)}</span>
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
                        {flag}
                      </span>
                    ))}
                  </div>

                  {/* Actions: Index to D1 & Expand Channel */}
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
                          <Check className="w-3.5 h-3.5" /> Indexed in Library
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" /> Index to D1 & PWA
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onExpandChannel(video.channelId, video.channelTitle)}
                      className="flex items-center gap-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 border border-slate-700"
                      title="Expand discovered channel to retrieve ALL videos"
                    >
                      <Tv className="w-3.5 h-3.5 text-orange-400" />
                      <span>Expand Channel</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isSearching && hasSearched && filteredResults.length === 0 && (
        <div className="py-16 text-center space-y-2">
          <p className="text-sm font-semibold text-white">No results matched your search term.</p>
          <p className="text-xs text-slate-400">Try searching for "Cloudflare Workers" or "System Design".</p>
        </div>
      )}

      {/* Initial state before search */}
      {!hasSearched && (
        <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Ready to Crawl YouTube & Discover High-Quality Videos</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Type any topic or click one of the suggested search buttons above to fetch metadata, calculate
            IndexScores, and catalog items into your local SQLite and Cloudflare edge database.
          </p>
          <button
            onClick={() => handleSearch('Cloudflare Workers & D1')}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition shadow-md"
          >
            Run Demo Search Now
          </button>
        </div>
      )}
    </div>
  );
};
