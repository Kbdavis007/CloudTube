import React, { useState, useMemo } from 'react';
import { VideoMetadata, VideoComment, PersonalMetadata, SourceFlag } from '../../types';
import {
  Star,
  Trash2,
  Tv,
  ListFilter,
} from 'lucide-react';
import { sourceFlagLabel } from '../../data/sourceLabels';
import { HoverPreview } from '../HoverPreview';
import { hoverPreviewEmbedUrl } from '../../services/preview';
import { SelectedVideoPage } from './SelectedVideoPage';
import { VideoFilterBar } from '../VideoFilterBar';
import { VideoPagination } from '../VideoPagination';
import {
  DEFAULT_VIDEO_FILTERS,
  filterAndSortVideos,
  hasActiveVideoFilters,
  paginate,
  type VideoFilterState,
} from '../../services/videoFilter';

/** Cards per page in the library browser. */
const LIBRARY_PAGE_SIZE = 24;

interface VideosPageProps {
  selectedVideo: VideoMetadata | null;
  /** Whether `selectedVideo` is saved in the library. */
  isInLibrary: boolean;
  /** Saves the video being watched to the library. */
  onSaveToLibrary: (video: VideoMetadata) => Promise<void>;
  /** The library, used for the listing and for filtering options. */
  allVideos: VideoMetadata[];
  /**
   * The list the player's prev/next walks. The queue the video was played from
   * (search results or catalogue), or the library when it was opened from the
   * listing.
   */
  queue: VideoMetadata[];
  /** What `queue` is, for the "Video N of M in <label>" line. */
  queueLabel: string;
  /** Related videos to show under the player. */
  relatedVideos: VideoMetadata[];
  /** Library video ids, for the listing and the "In Library" marks. */
  indexedVideoIds: Set<string>;
  comments: VideoComment[];
  /** Opens a video from the listing (library order). */
  onSelectVideo: (youtubeId: string) => void;
  /** Moves within the player's queue (prev/next). */
  onNavigateQueue: (youtubeId: string) => void;
  /** Plays a related video shown under the player. */
  onPlayRelated: (video: VideoMetadata) => void;
  onUpdatePersonal: (youtubeId: string, personal: Partial<PersonalMetadata>) => Promise<void>;
  onHarvestComments: (youtubeId: string) => void;
  onUpdateAiSummary: (youtubeId: string, aiSummary: string) => Promise<void>;
  onRequestRemoval: (youtubeId: string) => void;
  onBackToVideos: () => void;
}

/**
 * The Videos page. With no video selected it is the listing only: search,
 * filters, sorting, bulk actions and pagination over every library video. Once
 * a video is selected it hands off to SelectedVideoPage, the dedicated video
 * page that owns the full details and comments.
 */
export const VideosPage: React.FC<VideosPageProps> = ({
  selectedVideo,
  isInLibrary,
  onSaveToLibrary,
  allVideos,
  queue,
  queueLabel,
  relatedVideos,
  indexedVideoIds,
  comments,
  onSelectVideo,
  onNavigateQueue,
  onPlayRelated,
  onUpdatePersonal,
  onHarvestComments,
  onUpdateAiSummary,
  onRequestRemoval,
  onBackToVideos,
}) => {
  const [filters, setFilters] = useState<VideoFilterState>(DEFAULT_VIDEO_FILTERS);
  const [libraryPage, setLibraryPage] = useState(0);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());

  const filteredLibrary = useMemo(
    () => filterAndSortVideos(allVideos, filters),
    [allVideos, filters]
  );

  // Page the filtered list so a large library stays quick to scan.
  const {
    page: safeLibraryPage,
    pageCount: libraryPageCount,
    items: visibleLibrary,
  } = paginate(filteredLibrary, libraryPage, LIBRARY_PAGE_SIZE);

  const allVisibleLibrarySelected =
    visibleLibrary.length > 0 && visibleLibrary.every((v) => selectedLibraryIds.has(v.youtubeId));

  const toggleLibrarySelected = (youtubeId: string) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      if (next.has(youtubeId)) next.delete(youtubeId);
      else next.add(youtubeId);
      return next;
    });
  };

  const setVisibleLibrarySelected = (selected: boolean) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      visibleLibrary.forEach((v) => {
        if (selected) next.add(v.youtubeId);
        else next.delete(v.youtubeId);
      });
      return next;
    });
  };

  /** Select/deselect every video matching the current filters, not just the page. */
  const setAllMatchingLibrarySelected = (selected: boolean) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      filteredLibrary.forEach((v) => {
        if (selected) next.add(v.youtubeId);
        else next.delete(v.youtubeId);
      });
      return next;
    });
  };

  const removeSelectedFromLibrary = () => {
    const ids = [...selectedLibraryIds];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Remove ${ids.length} video${ids.length === 1 ? '' : 's'} from your library? Each one is recorded as "Not relevant to me" and can be restored later.`
      )
    ) {
      return;
    }
    ids.forEach((id) => onRequestRemoval(id));
    setSelectedLibraryIds(new Set());
  };

  const favoriteSelectedInLibrary = () => {
    const ids = [...selectedLibraryIds];
    if (ids.length === 0) return;
    ids.forEach((id) => void onUpdatePersonal(id, { isFavorite: true }));
    setSelectedLibraryIds(new Set());
  };

  const hasActiveLibraryFilters = hasActiveVideoFilters(filters);

  const updateFilters = (patch: Partial<VideoFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setLibraryPage(0);
  };

  const clearLibraryFilters = () => {
    setFilters(DEFAULT_VIDEO_FILTERS);
    setLibraryPage(0);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const sourceFlagColors: Record<SourceFlag, string> = {
    YouTubeSearch: 'bg-red-500/20 text-red-400 border-red-500/30',
    ChannelUploads: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Google: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Reddit: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
    X: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    LinkedIn: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
    Playlist: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Vega: 'bg-sky-700/20 text-orange-300 border-orange-700/40',
    XGroovy: 'bg-violet-600/20 text-violet-300 border-violet-600/40',
    ArchiveOrg: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    PeerTube: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
    Dailymotion: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    Eporner: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    EmbedHub: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    RedGifs: 'bg-red-500/20 text-red-300 border-red-500/30',
    Pornhub: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Xhamster: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    Redtube: 'bg-red-600/20 text-red-300 border-red-600/30',
    JustPorn: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    HornyFap: 'bg-lime-500/20 text-lime-300 border-lime-500/30',
    YesPorn: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    XXBrits: 'bg-green-600/20 text-green-300 border-green-600/30',
    NotFans: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    PornLib: 'bg-blue-700/20 text-blue-300 border-blue-700/40',
    DrTuber: 'bg-indigo-600/20 text-indigo-300 border-indigo-600/40',
    PornGo: 'bg-purple-600/20 text-purple-300 border-purple-600/40',
    YouJizz: 'bg-fuchsia-600/20 text-fuchsia-300 border-fuchsia-600/40',
    AnySex: 'bg-rose-600/20 text-rose-300 border-rose-600/40',
    AlotPorn: 'bg-amber-700/20 text-amber-300 border-amber-700/40',
  };

  if (selectedVideo) {
    return (
      <SelectedVideoPage
        currentVideo={selectedVideo}
        isInLibrary={isInLibrary}
        onSaveToLibrary={onSaveToLibrary}
        queue={queue}
        queueLabel={queueLabel}
        relatedVideos={relatedVideos}
        indexedVideoIds={indexedVideoIds}
        comments={comments.filter((c) => c.videoId === selectedVideo.youtubeId)}
        onNavigateQueue={onNavigateQueue}
        onPlayRelated={onPlayRelated}
        onHarvestComments={onHarvestComments}
        onUpdatePersonal={onUpdatePersonal}
        onUpdateAiSummary={onUpdateAiSummary}
        onRequestRemoval={onRequestRemoval}
        onBack={onBackToVideos}
      />
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Library Browser: search, filters, sort and the full scrollable list */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-orange-500" />
            All Library Videos
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Showing{' '}
              <span className="font-mono font-bold text-slate-200">{filteredLibrary.length}</span> of{' '}
              <span className="font-mono font-bold text-slate-200">{allVideos.length}</span>
            </span>
            <span className="text-xs text-slate-500">
              Page <span className="font-mono font-bold text-slate-200">{safeLibraryPage + 1}</span>{' '}
              / {libraryPageCount}
            </span>
          </div>
        </div>

        <VideoFilterBar
          videos={allVideos}
          filters={filters}
          onChange={updateFilters}
          onClear={clearLibraryFilters}
          searchPlaceholder="Search your library by title, channel, description or tag..."
        />

        {/* Bulk actions, scoped to the page or to every match */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setVisibleLibrarySelected(!allVisibleLibrarySelected)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            {allVisibleLibrarySelected ? 'Deselect page' : 'Select page'}
          </button>
          <button
            onClick={() => setAllMatchingLibrarySelected(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            Select all {filteredLibrary.length} matching
          </button>
          <button
            onClick={() => setAllMatchingLibrarySelected(false)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            Deselect all matching
          </button>
          <span className="w-px h-5 bg-slate-700 mx-1" />
          <span className="text-xs text-slate-400">
            Selected <span className="font-mono font-bold text-emerald-300">{selectedLibraryIds.size}</span>
          </span>
          <button
            onClick={favoriteSelectedInLibrary}
            disabled={selectedLibraryIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 disabled:opacity-40 text-amber-200 text-xs font-semibold border border-amber-900/60 transition"
          >
            <Star className="w-3.5 h-3.5" /> Add to favorites
          </button>
          <button
            onClick={removeSelectedFromLibrary}
            disabled={selectedLibraryIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 disabled:opacity-40 text-red-200 text-xs font-semibold border border-red-900/60 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete selected
          </button>
        </div>

        {/* Cards for the current page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleLibrary.map((video) => {
            const isSelected = selectedLibraryIds.has(video.youtubeId);
            const score = video.personal?.indexScore ?? 50;
            const rating = video.personal?.userRating ?? 0;
            const thumbnail =
              video.thumbnails?.medium || video.posterUrl || video.thumbnails?.default || '';

            return (
              <div
                key={video.youtubeId}
                className={`flex flex-col rounded-2xl border overflow-hidden transition ${
                  isSelected
                    ? 'bg-slate-900/80 border-orange-500/30'
                    : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="relative aspect-video bg-black">
                  {thumbnail ? (
                    <HoverPreview
                      poster={thumbnail}
                      alt={video.title}
                      previewUrl={video.playback?.previewUrl}
                      previewFrames={video.playback?.previewFrames}
                      embedUrl={hoverPreviewEmbedUrl(video)}
                    >
                      {/* The play overlay is a child of the preview (a sibling of
                          the iframe), so hovering it still starts the preview
                          without nesting the iframe inside a button. */}
                      <button
                        onClick={() => onSelectVideo(video.youtubeId)}
                        className="absolute inset-0"
                        title="Play this video"
                        aria-label={`Play ${video.title}`}
                      />
                    </HoverPreview>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Tv className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                    {formatDuration(video.durationSeconds)}
                  </div>
                  <label className="absolute top-1.5 left-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleLibrarySelected(video.youtubeId)}
                      className="w-4 h-4 accent-orange-500 cursor-pointer"
                      title={isSelected ? 'Deselect this video' : 'Select this video'}
                    />
                    <span className="text-[10px] font-semibold text-white">
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </label>

                </div>

                <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                  <button
                    onClick={() => onSelectVideo(video.youtubeId)}
                    className="text-left"
                  >
                    <h3 className="text-xs font-bold line-clamp-2 leading-snug text-white">
                      {video.title}
                    </h3>
                  </button>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                    <span className="text-orange-400/90 truncate">{video.channelTitle}</span>
                    <span>·</span>
                    <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
                      Score {score}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {rating}%
                    </span>
                    {video.personal?.isFavorite && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-current" /> Fav
                      </span>
                    )}
                    {video.sourceFlags.slice(0, 2).map((flag) => (
                      <span
                        key={flag}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          sourceFlagColors[flag] || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {sourceFlagLabel(flag)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {visibleLibrary.length === 0 && (
            <div className="col-span-full py-10 text-center space-y-2">
              <p className="text-xs text-slate-300">No videos match your search or filters.</p>
              {hasActiveLibraryFilters && (
                <button
                  onClick={clearLibraryFilters}
                  className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <VideoPagination
          page={safeLibraryPage}
          pageCount={libraryPageCount}
          onPage={setLibraryPage}
        />
      </div>
    </div>
  );
};
