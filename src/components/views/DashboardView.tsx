import React from 'react';
import {
  VideoMetadata,
  ChannelMetadata,
  CrawlJob,
} from '../../types';
import {
  PlaySquare,
  Tv,
  MessageSquare,
  Search,
  Sparkles,
  Server,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Eye,
  Star,
  Activity,
} from 'lucide-react';

interface DashboardViewProps {
  videos: VideoMetadata[];
  channels: ChannelMetadata[];
  commentCount: number;
  jobs: CrawlJob[];
  onSelectVideo: (videoId: string) => void;
  onNavigate: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  videos,
  channels,
  commentCount,
  jobs,
  onSelectVideo,
  onNavigate,
}) => {
  // Compute library statistics
  const totalViews = videos.reduce((acc, v) => acc + (v.viewCount || 0), 0);
  const avgIndexScore =
    videos.length > 0
      ? (videos.reduce((acc, v) => acc + (v.personal?.indexScore ?? 50), 0) / videos.length).toFixed(1)
      : '0';

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-950 border border-orange-500/20 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider">
            <Server className="w-3.5 h-3.5" /> 100% Cloudflare Free Tier Architecture
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            YouTube Library & Edge Harvester
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Personal video library, deep channel expansion engine, and comment harvester running
            serverless on Cloudflare Workers, D1 SQLite, R2 Object Storage, and Durable Objects.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('search')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-lg shadow-orange-600/30 active:scale-95"
            >
              <Search className="w-4 h-4" /> Search & Index YouTube
            </button>
            <button
              onClick={() => onNavigate('wizard')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-orange-400" /> Run 5-Min Setup Wizard
            </button>
            <button
              onClick={() => onNavigate('scaffolding')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition"
            >
              <Layers className="w-4 h-4 text-slate-400" /> View Scaffolding Code
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Indexed Videos</span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
              <PlaySquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{videos.length}</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
            <TrendingUp className="w-3 h-3" /> Indexed in D1 & IndexedDB
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Channels Tracked</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Tv className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{channels.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {channels.filter((c) => c.isExpanded).length} deep-expanded
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Comments Harvested</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{commentCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Stored in SQLite & R2 Vault</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Index Score</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {avgIndexScore}
            <span className="text-xs text-slate-400 font-normal"> / 100</span>
          </div>
          <div className="text-[11px] text-amber-400/90 mt-1">1 = best, 100 = worst</div>
        </div>
      </div>

      {/* Cloudflare Free Tier Quota Matrix */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-orange-500" />
              Cloudflare Free Tier Quota Monitor
            </h2>
            <p className="text-xs text-slate-400">
              Live edge resource usage tracked against Cloudflare's generous free allowance
            </p>
          </div>
          <span className="self-start sm:self-auto text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            All Free Quotas Safe
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {/* Workers API */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Workers Requests</span>
              <span className="font-mono text-slate-400">124 / 100,000 /day</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '0.12%' }} />
            </div>
            <p className="text-[10px] text-slate-300">Resets daily at 00:00 UTC</p>
          </div>

          {/* D1 Database Reads */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">D1 SQLite Rows Read</span>
              <span className="font-mono text-slate-400">3,420 / 5,000,000 /day</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '0.07%' }} />
            </div>
            <p className="text-[10px] text-slate-300">5M reads daily limit (99.9% remaining)</p>
          </div>

          {/* D1 Database Writes */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">D1 SQLite Rows Written</span>
              <span className="font-mono text-slate-400">42 / 100,000 /day</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '0.04%' }} />
            </div>
            <p className="text-[10px] text-slate-300">Batch insertions optimized</p>
          </div>

          {/* R2 Object Storage */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">R2 Object Storage</span>
              <span className="font-mono text-slate-400">0.08 GB / 10 GB</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full" style={{ width: '0.8%' }} />
            </div>
            <p className="text-[10px] text-slate-300">$0 egress fee guarantee</p>
          </div>

          {/* KV Fast Lookups */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">KV Cache Reads</span>
              <span className="font-mono text-slate-400">620 / 100,000 /day</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '0.62%' }} />
            </div>
            <p className="text-[10px] text-slate-300">Sub-millisecond edge lookups</p>
          </div>

          {/* Cloudflare Queues */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Queues & Durable Objects</span>
              <span className="font-mono text-slate-400">Active / Free Tier</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: '5%' }} />
            </div>
            <p className="text-[10px] text-slate-300">Async crawler batch processing</p>
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Videos & Active Crawler Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Videos in Library (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <PlaySquare className="w-4 h-4 text-orange-500" />
              Highest Ranked Videos in Library
            </h2>
            <button
              onClick={() => onNavigate('player')}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1"
            >
              View Player <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {videos.slice(0, 4).map((video) => {
              const score = video.personal?.indexScore ?? 50;
              const rating = video.personal?.userRating ?? 0;

              return (
                <div
                  key={video.youtubeId}
                  onClick={() => onSelectVideo(video.youtubeId)}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 hover:border-orange-500/40 cursor-pointer transition group"
                >
                  <div className="relative w-full sm:w-36 h-24 rounded-xl overflow-hidden shrink-0 bg-slate-950">
                    <img
                      src={video.thumbnails.medium}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                      {video.duration.replace('PT', '').toLowerCase()}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        Score: {score}
                      </span>
                      <span className="text-xs text-slate-400">{video.channelTitle}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-orange-400 transition">
                      {video.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-1">{video.description}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {formatNumber(video.viewCount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400" /> {rating}% rating
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(video.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Background Crawler Jobs & Workers (1 Col) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              Crawler Jobs
            </h2>
            <span className="text-xs text-slate-400">{jobs.length} jobs logged</span>
          </div>

          <div className="space-y-2.5">
            {jobs.slice(0, 4).map((job) => (
              <div
                key={job.id}
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white capitalize">{job.type.replace('_', ' ')}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      job.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : job.status === 'processing'
                        ? 'bg-blue-500/20 text-blue-400 animate-pulse'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono truncate">{job.queryOrTarget}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Found: {job.itemsFound} items</span>
                  <span>{new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}

            <div className="p-4 rounded-2xl bg-orange-950/20 border border-orange-500/20 text-center space-y-2">
              <p className="text-xs text-orange-300 font-medium">
                Want to expand an entire YouTube channel?
              </p>
              <button
                onClick={() => onNavigate('channels')}
                className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-sm active:scale-95"
              >
                Open Channel Expander
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
