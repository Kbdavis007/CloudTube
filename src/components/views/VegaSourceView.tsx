import React, { useMemo, useState } from 'react';
import { Check, ExternalLink, Play, Plus, Search, ShieldAlert } from 'lucide-react';
import { VideoMetadata } from '../../types';
import { SOURCE_ALIASES } from '../../data/sourceAliases';
import {
  CATALOG_GENERATED_AT,
  CATALOG_SOURCES,
  CatalogVideo,
  catalogKey,
  catalogToVideoMetadata,
  loadBakedCatalog,
  searchCatalog,
} from '../../services/vegaApi';

/** The neutral name this source is shown under; its real name is never rendered. */
const SOURCE_NAME = SOURCE_ALIASES.Vega!;

interface VegaSourceViewProps {
  onIndexVideo: (video: VideoMetadata) => void;
  /** Indexes the video if needed, then opens it in the player. */
  onPlayVideo: (video: VideoMetadata) => void;
  indexedVideoIds: Set<string>;
}

/**
 * Browse the catalogue that ships with the build.
 *
 * The records are a static JSON module (see `vegaApi`), so there is nothing to
 * download: the whole catalogue is available offline the moment the app loads.
 */
export const VegaSourceView: React.FC<VegaSourceViewProps> = ({
  onIndexVideo,
  onPlayVideo,
  indexedVideoIds,
}) => {
  const catalog = useMemo(() => loadBakedCatalog(), []);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [sourceId, setSourceId] = useState('all');

  const scoped = useMemo(
    () => (sourceId === 'all' ? catalog : catalog.filter((v) => v.sourceId === sourceId)),
    [catalog, sourceId]
  );

  const results: CatalogVideo[] = useMemo(
    () =>
      appliedQuery
        ? searchCatalog(scoped, appliedQuery, 120).map((r) => r.record)
        : scoped.slice(0, 120),
    [scoped, appliedQuery]
  );

  const runSearch = () => setAppliedQuery(searchTerm.trim());

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              {SOURCE_NAME} Source
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {catalog.length.toLocaleString()} videos built into this app. No download needed —
              search it and add what you want to your library.
            </p>
          </div>

          {CATALOG_SOURCES.length > 1 && (
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500"
              title="Filter by source"
            >
              <option value="all">All sources</option>
              {CATALOG_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search titles, tags, actors, category, or uploader…"
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
            />
          </div>
          <button
            onClick={runSearch}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition active:scale-95"
          >
            <Search className="w-4 h-4" />
            <span>Search catalogue</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Catalogue generated {CATALOG_GENERATED_AT.slice(0, 10)} ·{' '}
          {results.length.toLocaleString()} shown
          {appliedQuery ? ` for “${appliedQuery}”` : ''}
        </p>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((record) => {
            const key = catalogKey(record);
            const isIndexed = indexedVideoIds.has(key);
            const thumb = record.thumbnail || record.previewThumbnail;

            return (
              <div
                key={key}
                className="flex flex-col rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-orange-500/50 overflow-hidden transition group"
              >
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={record.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Play className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                  <button
                    onClick={() => onPlayVideo(catalogToVideoMetadata(record))}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40"
                    title="Add to library and play"
                  >
                    <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-xl hover:scale-110 transition">
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </div>
                  </button>

                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 font-mono text-[11px] font-semibold text-white">
                    {Math.floor(record.durationSeconds / 60)}:
                    {String(record.durationSeconds % 60).padStart(2, '0')}
                  </div>
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-orange-400/90 truncate">
                        {record.uploader || 'Unknown uploader'}
                      </span>
                      <span className="shrink-0">{record.quality}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-orange-400 transition">
                      {record.title}
                    </h3>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {record.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2 border-t border-slate-800/80">
                    <button
                      onClick={() => onIndexVideo(catalogToVideoMetadata(record))}
                      disabled={isIndexed}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition active:scale-95 ${
                        isIndexed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-orange-600 hover:bg-orange-500 text-white shadow-sm'
                      }`}
                    >
                      {isIndexed ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> In Library
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" /> Add to Library
                        </>
                      )}
                    </button>

                    <a
                      href={record.pageUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      title="Open on the source site"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {results.length === 0 && (
        <div className="py-16 text-center space-y-2">
          <p className="text-sm font-semibold text-white">No videos matched that search.</p>
          <p className="text-xs text-slate-400">Try a single term.</p>
        </div>
      )}
    </div>
  );
};
