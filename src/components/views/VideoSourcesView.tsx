import React from 'react';
import { ChevronRight, Film, PlaySquare, ShieldAlert } from 'lucide-react';
import { PageTab } from '../Sidebar';

interface VideoSourcesViewProps {
  onSelectSource: (tab: PageTab) => void;
}

interface SourceOption {
  id: PageTab;
  name: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconClass: string;
  badge?: string;
}

const SOURCES: SourceOption[] = [
  {
    id: 'search',
    name: 'YouTube',
    tagline: 'Search & Harvest',
    description:
      'Search the live YouTube Data API, discover channels, and index videos with metadata.',
    icon: PlaySquare,
    accent: 'hover:border-red-500/50',
    iconClass: 'bg-red-500/10 border-red-500/20 text-red-400',
  },
  {
    id: 'xvideos',
    name: 'XVideos',
    tagline: 'Webmaster catalogue',
    description:
      'Import the XVideos webmaster catalogue and search it offline. Adult content — 18+ only.',
    icon: ShieldAlert,
    accent: 'hover:border-orange-500/50',
    iconClass: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    badge: '18+',
  },
];

export const VideoSourcesView: React.FC<VideoSourcesViewProps> = ({ onSelectSource }) => {
  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-orange-500" />
          Video Sources
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Pick a source to browse and index videos from.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SOURCES.map((source, index) => {
          const Icon = source.icon;

          return (
            <button
              key={source.id}
              onClick={() => onSelectSource(source.id)}
              className={`text-left p-5 rounded-3xl bg-slate-900/80 border border-slate-800 ${source.accent} transition group active:scale-[0.99]`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${source.iconClass}`}>
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

              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-orange-400 group-hover:text-orange-300">
                <span>Open source</span>
                <ChevronRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
