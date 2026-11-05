import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Film,
  Loader2,
  PlaySquare,
  RefreshCw,
  Settings,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { PageTab } from './Sidebar';
import type { SourceFlag } from '../types';
import { SOURCE_ALIASES } from '../data/sourceAliases';
import { idbService } from '../services/indexedDB';
import { countBakedCatalog } from '../services/vegaApi';

export interface VideoSourceDefinition {
  /** Doubles as the tab the source opens. */
  id: PageTab;
  name: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconClass: string;
  badge?: string;
}

/** The sources CloudTube can browse. Shared by Settings and the legacy page. */
export const VIDEO_SOURCES: VideoSourceDefinition[] = [
  {
    id: 'search',
    name: 'YouTube',
    tagline: 'Search & Collect',
    description:
      'Search YouTube, discover channels, and save videos to your library with their details.',
    icon: PlaySquare,
    accent: 'hover:border-red-500/50',
    iconClass: 'bg-red-500/10 border-red-500/20 text-red-400',
  },
  {
    id: 'vega',
    name: SOURCE_ALIASES.Vega!,
    tagline: 'Built-in catalogue',
    description: 'Browse the catalogue that ships with the app and search it offline.',
    icon: ShieldAlert,
    accent: 'hover:border-orange-500/50',
    iconClass: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  },
];

export interface VideoSourceStats {
  /** Videos saved from this source. */
  videoCount: number;
  /** Whether the source is connected and ready to use. */
  connected: boolean;
  /** Optional extra detail, e.g. catalogue size. */
  detail?: string;
}

type SourceStatsMap = Partial<Record<PageTab, VideoSourceStats>>;

interface SourceCardProps {
  source: VideoSourceDefinition;
  index: number;
  onOpen: (tab: PageTab) => void;
  /** Extra row rendered under the description, used for status + counters. */
  footer?: React.ReactNode;
}

/** One source tile. Shared so the Settings panel and legacy page cannot drift. */
export const SourceCard: React.FC<SourceCardProps> = ({ source, index, onOpen, footer }) => {
  const Icon = source.icon;

  return (
    <button
      onClick={() => onOpen(source.id)}
      className={`text-left p-5 rounded-3xl bg-slate-900/80 border border-slate-800 ${source.accent} transition group active:scale-[0.99]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${source.iconClass}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-mono text-slate-500">#{index + 1}</span>
      </div>

      <div className="mt-4 space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white">{source.name}</h2>
          {source.badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
              {source.badge}
            </span>
          )}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {source.tagline}
        </p>
        <p className="text-xs text-slate-400 leading-relaxed pt-1">{source.description}</p>
      </div>

      {footer && <div className="mt-3 pt-3 border-t border-slate-800/70">{footer}</div>}

      <div className="mt-4 flex items-center gap-1 text-xs font-bold text-orange-400 group-hover:text-orange-300">
        <span>Browse</span>
        <ChevronRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </button>
  );
};

const SOURCE_STATUS_POLL_MS = 15000;

/**
 * Live per-source counters read straight from IndexedDB, so the panel shows
 * real numbers instead of estimates. Refreshes on focus and on an interval
 * while visible, so videos added elsewhere are reflected without a reload.
 */
const useSourceStats = (isYouTubeConnected: boolean) => {
  const [stats, setStats] = useState<SourceStatsMap>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const videos = await idbService.getAllVideos();
      const catalogCount = countBakedCatalog();
      const countByFlag = (flag: SourceFlag) =>
        videos.filter((v) => (v.sourceFlags || []).includes(flag)).length;

      setStats({
        search: { videoCount: countByFlag('YouTubeSearch'), connected: isYouTubeConnected },
        vega: {
          videoCount: countByFlag('Vega'),
          connected: catalogCount > 0,
          detail: `${catalogCount.toLocaleString()} in catalogue`,
        },
      });
    } catch (err) {
      console.error('Failed to read video source stats', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isYouTubeConnected]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, SOURCE_STATUS_POLL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { stats, isRefreshing, refresh };
};

interface VideoSourcesPanelProps {
  /** Opens a source page (or any tab, e.g. the Settings page's own navigate). */
  onSelectSource: (tab: PageTab) => void;
  /** Whether the Google account is connected, used for the YouTube status. */
  isYouTubeConnected?: boolean;
  /** Starts expanded; collapsed by default so Settings stays scannable. */
  defaultExpanded?: boolean;
}

/**
 * Collapsible Video Sources panel for the Settings page. Holds the same source
 * tiles, counters, and status indicators that used to live on the sidebar page.
 */
export const VideoSourcesPanel: React.FC<VideoSourcesPanelProps> = ({
  onSelectSource,
  isYouTubeConnected = false,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { stats, isRefreshing, refresh } = useSourceStats(isYouTubeConnected);

  const connectedCount = VIDEO_SOURCES.filter((s) => stats[s.id]?.connected).length;

  return (
    <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-white">Video Sources</h2>
          <span className="text-[10px] font-mono text-slate-500">
            {connectedCount}/{VIDEO_SOURCES.length} connected
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed border border-slate-700 text-slate-200 text-[11px] font-semibold transition active:scale-95"
          >
            {isRefreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
            )}
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition active:scale-95"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Manage Sources</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        Browse and save videos from each source. Counters show how many videos you have saved and
        whether each source is ready to use.
      </p>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {VIDEO_SOURCES.map((source, index) => {
            const stat = stats[source.id];

            return (
              <SourceCard
                key={source.id}
                source={source}
                index={index}
                onOpen={onSelectSource}
                footer={
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`flex items-center gap-1 font-semibold ${
                        stat?.connected ? 'text-emerald-300' : 'text-slate-500'
                      }`}
                    >
                      {stat?.connected ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {stat?.connected ? 'Connected' : 'Not connected'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-slate-400">
                      {stat ? stat.videoCount.toLocaleString() : '—'} saved
                    </span>
                    {stat?.detail && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-500">{stat.detail}</span>
                      </>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
