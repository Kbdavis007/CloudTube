import React, { useMemo, useState } from 'react';
import { Check, ExternalLink, Play, Plus, ShieldAlert } from 'lucide-react';
import { VideoMetadata } from '../../types';
import { SOURCE_ALIASES } from '../../data/sourceAliases';
import { HoverPreview } from '../HoverPreview';
import { hoverPreviewEmbedUrl } from '../../services/preview';
import { VideoFilterBar } from '../VideoFilterBar';
import { VideoPagination } from '../VideoPagination';
import {
  DEFAULT_VIDEO_FILTERS,
  filterAndSortVideos,
  paginate,
  type VideoFilterState,
} from '../../services/videoFilter';
import {
  CATALOG_GENERATED_AT,
  catalogKey,
  catalogToVideoMetadata,
  loadBakedCatalog,
} from '../../services/vegaApi';

/** The neutral name this source is shown under; its real name is never rendered. */
const SOURCE_NAME = SOURCE_ALIASES.Vega!;

/** Cards per page in the catalogue browser. */
const CATALOG_PAGE_SIZE = 24;

interface VegaSourceViewProps {
  onIndexVideo: (video: VideoMetadata) => void;
  /**
   * Opens the video in the player; watching it does not add it to the library.
   * The current (filtered, sorted) catalogue list is passed as the play queue
   * so the player's prev/next walks the catalogue the user is looking at.
   */
  onPlayVideo: (video: VideoMetadata, queue: VideoMetadata[], label: string) => void;
  indexedVideoIds: Set<string>;
}

/**
 * Browse the catalogue that ships with the build.
 *
 * The records are a static JSON module (see `vegaApi`), so there is nothing to
 * download: the whole catalogue is available offline the moment the app loads.
 * It offers the same search, filter, sort and pagination as the library and the
 * live search results.
 */
export const VegaSourceView: React.FC<VegaSourceViewProps> = ({
  onIndexVideo,
  onPlayVideo,
  indexedVideoIds,
}) => {
  const catalog = useMemo(() => loadBakedCatalog(), []);
  const catalogVideos = useMemo(() => catalog.map(catalogToVideoMetadata), [catalog]);
  // The catalogue search also covers actors and category, which the shared video
  // model does not carry, so keep them keyed by the video's store key.
  const extraSearchById = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of catalog) {
      map.set(catalogKey(record), `${record.actors.join(' ')} ${record.category}`);
    }
    return map;
  }, [catalog]);

  const [filters, setFilters] = useState<VideoFilterState>(DEFAULT_VIDEO_FILTERS);
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () =>
      filterAndSortVideos(catalogVideos, filters, {
        extraSearchText: (video) => extraSearchById.get(video.youtubeId),
      }),
    [catalogVideos, filters, extraSearchById]
  );

  const {
    page: safePage,
    pageCount,
    items: visible,
  } = paginate(filtered, page, CATALOG_PAGE_SIZE);

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
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            {SOURCE_NAME} Source
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {catalog.length.toLocaleString()} videos built into this app. No download needed —
            search, filter and add what you want to your library.
          </p>
        </div>
      </div>

      <VideoFilterBar
        videos={catalogVideos}
        filters={filters}
        onChange={updateFilters}
        onClear={clearFilters}
        searchPlaceholder="Search titles, tags, actors, category, or uploader..."
      />

      <p className="text-[11px] text-slate-500">
        Catalogue generated {CATALOG_GENERATED_AT.slice(0, 10)} ·{' '}
        {filtered.length.toLocaleString()} match{filtered.length === 1 ? '' : 'es'}
      </p>

      {visible.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((video) => {
            const key = video.youtubeId;
            // The catalogue can list the same source id under more than one
            // slug, so the store key is not unique. The canonical page URL is,
            // so use it for React's key while the store key still drives the
            // "In Library" lookup.
            const reactKey = video.playback?.externalUrl || key;
            const isIndexed = indexedVideoIds.has(key);
            const thumb = video.thumbnails.medium || video.posterUrl;

            return (
              <div
                key={reactKey}
                className="flex flex-col rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-orange-500/50 overflow-hidden transition group"
              >
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  {thumb ? (
                    <HoverPreview
                      poster={thumb}
                      alt={video.title}
                      embedUrl={hoverPreviewEmbedUrl(video)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 pointer-events-none" />

                      {/* The play overlay is a child of the preview, so resting
                          the pointer here still starts the preview. */}
                      <button
                        onClick={() => onPlayVideo(video, filtered, 'Catalogue')}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40"
                        title="Play without saving"
                      >
                        <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-xl hover:scale-110 transition">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                      </button>
                    </HoverPreview>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Play className="w-6 h-6" />
                    </div>
                  )}

                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 font-mono text-[11px] font-semibold text-white">
                    {Math.floor(video.durationSeconds / 60)}:
                    {String(video.durationSeconds % 60).padStart(2, '0')}
                  </div>
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-orange-400/90 truncate">
                        {video.channelTitle || 'Unknown uploader'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-orange-400 transition">
                      {video.title}
                    </h3>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {video.tags.slice(0, 4).map((tag) => (
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
                          <Check className="w-3.5 h-3.5" /> In Library
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" /> Add to Library
                        </>
                      )}
                    </button>

                    {video.playback?.externalUrl && (
                      <a
                        href={video.playback.externalUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                        title="Open on the source site"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <VideoPagination page={safePage} pageCount={pageCount} onPage={setPage} />

      {filtered.length === 0 && (
        <div className="py-16 text-center space-y-2">
          <p className="text-sm font-semibold text-white">No videos matched that search.</p>
          <p className="text-xs text-slate-400">Try a single term, or clear the filters.</p>
        </div>
      )}
    </div>
  );
};
