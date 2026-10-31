import React from 'react';
import { ArrowRight, Film, Info } from 'lucide-react';
import { PageTab } from '../Sidebar';
import { SourceCard, VIDEO_SOURCES } from '../VideoSourcesPanel';

interface VideoSourcesViewProps {
  onSelectSource: (tab: PageTab) => void;
  /** Opens the Settings page, where the panel now lives. */
  onOpenSettings?: () => void;
}

/**
 * Legacy standalone source picker. Kept so the `sources` sidebar entry keeps
 * working, but the primary UI is now the Video Sources panel in Settings.
 */
export const VideoSourcesView: React.FC<VideoSourcesViewProps> = ({
  onSelectSource,
  onOpenSettings,
}) => {
  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-orange-500" />
          Video Sources
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Pick a source to browse and save videos from.
        </p>
      </div>

      <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2 text-[11px] text-amber-200/90 leading-relaxed">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span>
            This page is deprecated. Video Sources now live in Settings, with live counters and
            status.
          </span>
        </div>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition active:scale-95 shrink-0"
          >
            <span>Open in Settings</span>
            <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {VIDEO_SOURCES.map((source, index) => (
          <SourceCard key={source.id} source={source} index={index} onOpen={onSelectSource} />
        ))}
      </div>
    </div>
  );
};
