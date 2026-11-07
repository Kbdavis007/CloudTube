import React, { useMemo } from 'react';
import { ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react';
import type { VideoMetadata } from '../types';
import { sourceFlagLabel } from '../data/sourceLabels';
import {
  collectChannelOptions,
  collectSourceOptions,
  collectTagOptions,
  hasActiveVideoFilters,
  type VideoFilterState,
} from '../services/videoFilter';

interface VideoFilterBarProps {
  /** The full set of videos the bar's option lists are derived from. */
  videos: readonly VideoMetadata[];
  filters: VideoFilterState;
  onChange: (patch: Partial<VideoFilterState>) => void;
  onClear: () => void;
  /** Placeholder for the search box; defaults to a library-flavoured hint. */
  searchPlaceholder?: string;
  /** Optional extra control rendered on the header row (e.g. a source-scope select). */
  headerExtra?: React.ReactNode;
}

/**
 * The shared search + filter + sort control used by the library listing, live
 * search results and the baked catalogue, so all three offer the same filtering.
 * The option lists (source, channel, tag) are derived from the videos passed in,
 * so they never offer a value that would match nothing.
 */
export const VideoFilterBar: React.FC<VideoFilterBarProps> = ({
  videos,
  filters,
  onChange,
  onClear,
  searchPlaceholder = 'Search by title, channel, description or tag...',
  headerExtra,
}) => {
  const sourceOptions = useMemo(() => collectSourceOptions(videos), [videos]);
  const tagOptions = useMemo(() => collectTagOptions(videos), [videos]);
  const channelOptions = useMemo(() => {
    const titles = new Map<string, string>();
    for (const video of videos) titles.set(video.channelId, video.channelTitle);
    return collectChannelOptions(videos).map(
      ([id, count]) => [id, titles.get(id) ?? id, count] as [string, string, number]
    );
  }, [videos]);

  const active = hasActiveVideoFilters(filters);
  const fieldClass =
    'w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500';
  const labelClass = 'text-[10px] font-bold uppercase tracking-wider text-slate-400';

  return (
    <div
      className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3"
      data-testid="video-filter-bar"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-semibold text-slate-300">Filter &amp; sort</span>
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          {active && (
            <button
              type="button"
              onClick={onClear}
              data-testid="video-filter-clear"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition border border-slate-700"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2 lg:col-span-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder={searchPlaceholder}
            data-testid="video-filter-search"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500"
          />
        </div>

        <label className="space-y-1">
          <span className={labelClass}>Source</span>
          <select
            value={filters.source}
            onChange={(e) => onChange({ source: e.target.value as VideoFilterState['source'] })}
            data-testid="video-filter-source"
            className={fieldClass}
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
          <span className={labelClass}>Channel</span>
          <select
            value={filters.channel}
            onChange={(e) => onChange({ channel: e.target.value })}
            data-testid="video-filter-channel"
            className={fieldClass}
          >
            <option value="ALL">All channels</option>
            {channelOptions.map(([id, title, count]) => (
              <option key={id} value={id}>
                {title} ({count})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Tag</span>
          <select
            value={filters.tag}
            onChange={(e) => onChange({ tag: e.target.value })}
            data-testid="video-filter-tag"
            className={fieldClass}
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
          <span className={labelClass}>Score</span>
          <select
            value={filters.score}
            onChange={(e) => onChange({ score: e.target.value as VideoFilterState['score'] })}
            data-testid="video-filter-score"
            className={fieldClass}
          >
            <option value="all">Any score</option>
            <option value="elite">Top tier (≤ 20)</option>
            <option value="good">Good (≤ 50)</option>
            <option value="low">Low priority (≥ 70)</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Rating</span>
          <select
            value={filters.rating}
            onChange={(e) => onChange({ rating: e.target.value as VideoFilterState['rating'] })}
            data-testid="video-filter-rating"
            className={fieldClass}
          >
            <option value="all">Any rating</option>
            <option value="rated">Rated</option>
            <option value="unrated">Unrated</option>
            <option value="favorites">Favorites</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Duration</span>
          <select
            value={filters.duration}
            onChange={(e) => onChange({ duration: e.target.value as VideoFilterState['duration'] })}
            data-testid="video-filter-duration"
            className={fieldClass}
          >
            <option value="all">Any length</option>
            <option value="short">Short (&lt; 5 min)</option>
            <option value="medium">Medium (5–20 min)</option>
            <option value="long">Long (&gt; 20 min)</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Published from</span>
          <input
            type="date"
            value={filters.publishedFrom}
            onChange={(e) => onChange({ publishedFrom: e.target.value })}
            data-testid="video-filter-from"
            className={fieldClass}
          />
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Published to</span>
          <input
            type="date"
            value={filters.publishedTo}
            onChange={(e) => onChange({ publishedTo: e.target.value })}
            data-testid="video-filter-to"
            className={fieldClass}
          />
        </label>

        <label className="space-y-1">
          <span className={`${labelClass} flex items-center gap-1`}>
            <ArrowUpDown className="w-3 h-3" /> Sort by
          </span>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value as VideoFilterState['sort'] })}
            data-testid="video-filter-sort"
            className={fieldClass}
          >
            <option value="score">Score (best first)</option>
            <option value="rating">Rating (highest)</option>
            <option value="date_desc">Published (newest)</option>
            <option value="date_asc">Published (oldest)</option>
            <option value="title">Title (A–Z)</option>
            <option value="channel">Channel (A–Z)</option>
            <option value="duration">Duration (longest)</option>
            <option value="views">Views (most)</option>
          </select>
        </label>
      </div>
    </div>
  );
};
