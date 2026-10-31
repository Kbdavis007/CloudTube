import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { VideoMetadata } from '../../types';
import { idbService } from '../../services/indexedDB';
import {
  XvideosExportRange,
  XvideosRecord,
  extractSlug,
  loadXvideosCatalog,
  searchXvideosCatalog,
  xvideosKey,
  xvideosRecordToVideo,
} from '../../services/xvideosApi';

const CONSENT_STORAGE_KEY = 'cloudtube.xvideos.adultConfirmed';

/** How many review rows to render at once; the filter narrows the rest. */
const REVIEW_PAGE_SIZE = 120;

const recordKey = (record: XvideosRecord): string =>
  xvideosKey(extractSlug(record.pageUrl) || record.videoId);

interface XvideosSourceViewProps {
  onIndexVideo: (video: VideoMetadata) => void;
  /** Indexes the video if needed, then opens it in the player. */
  onPlayVideo: (video: VideoMetadata) => void;
  indexedVideoIds: Set<string>;
}

export const XvideosSourceView: React.FC<XvideosSourceViewProps> = ({
  onIndexVideo,
  onPlayVideo,
  indexedVideoIds,
}) => {
  const [confirmed, setConfirmed] = useState<boolean>(
    () => localStorage.getItem(CONSENT_STORAGE_KEY) === 'true'
  );
  const [catalog, setCatalog] = useState<XvideosRecord[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [range, setRange] = useState<XvideosExportRange>('week');

  // Review-before-import. A download lands here first; nothing is written to the
  // stored catalogue until the user confirms, and rows can be excluded or
  // removed from the list beforehand.
  const [pending, setPending] = useState<XvideosRecord[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [reviewQuery, setReviewQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Load the catalogue from IndexedDB on first render so a returning user does
  // not re-download the export just to search it.
  useEffect(() => {
    if (!confirmed) return;
    let cancelled = false;

    (async () => {
      try {
        const stored = await idbService.getXvideosCatalog();
        if (!cancelled && stored.length > 0) setCatalog(stored);
      } catch (err) {
        console.error('Failed to read stored XVideos catalogue', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [confirmed]);

  const confirmAdult = () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
    setConfirmed(true);
  };

  // A fresh download is held for review instead of being saved immediately.
  const handleRefresh = async () => {
    setIsLoadingCatalog(true);
    setCatalogError(null);
    setLoadProgress(0);

    try {
      const records = await loadXvideosCatalog(range, {
        onProgress: (count) => setLoadProgress(count),
      });
      records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setPending(records);
      setExcluded(new Set());
      setReviewQuery('');
    } catch (err: any) {
      console.error('XVideos catalogue download failed', err);
      setCatalogError(err?.message || 'Failed to download the XVideos catalogue.');
    } finally {
      setIsLoadingCatalog(false);
      setLoadProgress(null);
    }
  };

  const cancelReview = () => {
    setPending(null);
    setExcluded(new Set());
    setReviewQuery('');
  };

  const toggleExcluded = (key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeFromPending = (key: string) => {
    setPending((prev) => (prev ? prev.filter((record) => recordKey(record) !== key) : prev));
    setExcluded((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const importReviewed = async () => {
    if (!pending) return;
    const toImport = pending.filter((record) => !excluded.has(recordKey(record)));
    setIsImporting(true);
    try {
      await idbService.addXvideosRecords(toImport);
      const stored = await idbService.getXvideosCatalog();
      stored.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setCatalog(stored);
      cancelReview();
    } catch (err: any) {
      console.error('XVideos catalogue import failed', err);
      setCatalogError(err?.message || 'Failed to save the reviewed catalogue.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearCatalog = async () => {
    if (!confirm('Remove the downloaded XVideos catalogue from this device?')) return;
    await idbService.clearXvideosCatalog();
    setCatalog([]);
    setAppliedQuery('');
  };

  const results = useMemo(
    () => (appliedQuery ? searchXvideosCatalog(catalog, appliedQuery, 60) : []),
    [catalog, appliedQuery]
  );

  const runSearch = (query = searchTerm) => {
    setSearchTerm(query);
    setAppliedQuery(query.trim());
  };

  // Records still in the review list, after the local filter.
  const reviewRecords = useMemo(() => {
    if (!pending) return [];
    const q = reviewQuery.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter((r) =>
      `${r.title} ${r.uploader} ${r.tags.join(' ')} ${r.actors.join(' ')} ${r.category}`
        .toLowerCase()
        .includes(q)
    );
  }, [pending, reviewQuery]);

  const reviewSelectedCount = useMemo(
    () => (pending ? pending.filter((r) => !excluded.has(recordKey(r))).length : 0),
    [pending, excluded]
  );

  const visibleReviewRecords = reviewRecords.slice(0, REVIEW_PAGE_SIZE);

  if (!confirmed) {
    return (
      <div className="space-y-6 pb-12 max-w-3xl mx-auto">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            XVideos Source
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Import the XVideos webmaster catalogue and search it offline.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-orange-500/30 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-white">Adult content notice</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                This source imports the XVideos catalogue, which contains adult material. It is off
                by default and stays off until you confirm below. Confirm only if you are 18 or older
                and it is legal to view this content where you are.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                The catalogue is an official bulk export published for webmasters at{' '}
                <span className="font-mono text-slate-300">info.xvideos.net/db</span>. Videos play
                through XVideos' own embed player, so playback depends on that site.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={confirmAdult}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition active:scale-95"
            >
              I am 18 or older — enable this source
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pending) {
    const allVisibleSelected =
      visibleReviewRecords.length > 0 &&
      visibleReviewRecords.every((r) => !excluded.has(recordKey(r)));

    return (
      <div className="space-y-5 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-orange-500" />
              Review download before importing
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Nothing has been saved yet. Uncheck or remove anything you do not want, then import
              the rest. Newest videos are listed first.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={cancelReview}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              onClick={importReviewed}
              disabled={isImporting || reviewSelectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition active:scale-95"
            >
              {isImporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>
                {isImporting
                  ? 'Importing…'
                  : `Import ${reviewSelectedCount.toLocaleString()} video${reviewSelectedCount === 1 ? '' : 's'}`}
              </span>
            </button>
          </div>
        </div>

        {/* Summary + selection controls */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>
              Downloaded <span className="font-mono font-bold text-slate-200">{pending.length.toLocaleString()}</span>
            </span>
            <span>
              Selected <span className="font-mono font-bold text-emerald-300">{reviewSelectedCount.toLocaleString()}</span>
            </span>
            <span>
              Excluded <span className="font-mono font-bold text-amber-300">{excluded.size.toLocaleString()}</span>
            </span>
            <span>
              Showing <span className="font-mono font-bold text-slate-200">{visibleReviewRecords.length.toLocaleString()}</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={reviewQuery}
                onChange={(e) => setReviewQuery(e.target.value)}
                placeholder="Filter the downloaded list by title, uploader, tag or category…"
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setExcluded((prev) => {
                    const next = new Set(prev);
                    visibleReviewRecords.forEach((r) => {
                      if (allVisibleSelected) next.add(recordKey(r));
                      else next.delete(recordKey(r));
                    });
                    return next;
                  })
                }
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                {allVisibleSelected ? 'Deselect shown' : 'Select shown'}
              </button>
              <button
                onClick={() => setExcluded(new Set())}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                Select all
              </button>
            </div>
          </div>
        </div>

        {/* Thumbnail rows */}
        <div className="max-h-[32rem] overflow-y-auto pr-1 space-y-2">
          {visibleReviewRecords.map((record) => {
            const key = recordKey(record);
            const isExcluded = excluded.has(key);
            const thumb = record.thumbUrl || record.previewThumbUrl;

            return (
              <div
                key={key}
                className={`flex items-center gap-3 p-2.5 rounded-2xl border transition ${
                  isExcluded
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-55'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!isExcluded}
                  onChange={() => toggleExcluded(key)}
                  className="w-4 h-4 shrink-0 accent-orange-500 cursor-pointer"
                  title={isExcluded ? 'Include this video' : 'Exclude this video'}
                />

                <div className="relative w-24 h-14 rounded-xl overflow-hidden bg-black shrink-0">
                  <img src={thumb} alt={record.title} loading="lazy" className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[9px] font-mono text-white">
                    {Math.floor(record.durationSeconds / 60)}:
                    {String(record.durationSeconds % 60).padStart(2, '0')}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-white truncate">{record.title}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span className="text-orange-400/90 truncate">{record.uploader || 'Unknown uploader'}</span>
                    <span>·</span>
                    <span className="shrink-0">{record.date || 'no date'}</span>
                    {record.quality && (
                      <>
                        <span>·</span>
                        <span className="shrink-0">{record.quality}</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => removeFromPending(key)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-300 border border-slate-700 transition active:scale-95 shrink-0"
                  title="Remove this video from the download"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {visibleReviewRecords.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs text-slate-300">
                {pending.length === 0
                  ? 'You removed every video from this download.'
                  : 'No videos match that filter.'}
              </p>
              {pending.length === 0 ? (
                <button
                  onClick={cancelReview}
                  className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
                >
                  Close review
                </button>
              ) : (
                <button
                  onClick={() => setReviewQuery('')}
                  className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>

        {reviewRecords.length > REVIEW_PAGE_SIZE && (
          <p className="text-[11px] text-slate-400 text-center">
            Showing the first {REVIEW_PAGE_SIZE} of {reviewRecords.length.toLocaleString()} matching
            videos. Use the filter to review the rest. All {reviewSelectedCount.toLocaleString()}{' '}
            selected videos will be imported.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              XVideos Source
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Search the imported XVideos catalogue. {catalog.length > 0
                ? `${catalog.length.toLocaleString()} videos stored offline.`
                : 'No catalogue downloaded yet.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as XvideosExportRange)}
              disabled={isLoadingCatalog}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-orange-500 disabled:opacity-50"
              title="Which export to download"
            >
              <option value="week">Weekly export (~12k videos)</option>
              <option value="full">Full export (~7M videos)</option>
            </select>

            <button
              onClick={handleRefresh}
              disabled={isLoadingCatalog}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition active:scale-95"
            >
              {isLoadingCatalog ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{isLoadingCatalog ? 'Downloading…' : 'Download catalogue'}</span>
            </button>

            {catalog.length > 0 && !isLoadingCatalog && (
              <button
                onClick={handleClearCatalog}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-300 hover:border-red-800/70 transition"
                title="Remove the stored catalogue"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {range === 'full' && (
          <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-600/30 text-[11px] text-amber-200/90 leading-relaxed">
            The full export is ~476 MB compressed and around 7 million rows. Browsers cannot hold
            that in memory, so a full download will not complete. Use the weekly export to build a
            searchable catalogue.
          </div>
        )}

        {isLoadingCatalog && (
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3 text-xs text-slate-300">
            <Download className="w-4 h-4 text-orange-400" />
            <span>
              Downloading and parsing the export
              {loadProgress !== null ? ` — ${loadProgress.toLocaleString()} videos parsed` : '…'}
            </span>
          </div>
        )}

        {catalogError && (
          <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs">
            {catalogError}
          </div>
        )}

        {catalog.length > 0 && (
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
              onClick={() => runSearch()}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition active:scale-95"
            >
              <Search className="w-4 h-4" />
              <span>Search catalogue</span>
            </button>
          </div>
        )}
      </div>

      {catalog.length > 0 && appliedQuery && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            {results.length} result{results.length === 1 ? '' : 's'} for “{appliedQuery}”
          </span>
        </div>
      )}

      {catalog.length > 0 && appliedQuery && results.length === 0 && (
        <div className="py-16 text-center space-y-2">
          <p className="text-sm font-semibold text-white">No videos matched that search.</p>
          <p className="text-xs text-slate-400">Try a single term, or download a newer export.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map(({ record }) => {
            const key = xvideosKey(extractSlug(record.pageUrl) || record.videoId);
            const isIndexed = indexedVideoIds.has(key);

            return (
              <div
                key={key}
                className="flex flex-col rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-orange-500/50 overflow-hidden transition group"
              >
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  <img
                    src={record.thumbUrl || record.previewThumbUrl}
                    alt={record.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                  <button
                    onClick={() => onPlayVideo(xvideosRecordToVideo(record))}
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
                      onClick={() => onIndexVideo(xvideosRecordToVideo(record))}
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
                      title="Open on XVideos"
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

      {catalog.length === 0 && !isLoadingCatalog && !catalogError && (
        <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto">
            <Star className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Download the catalogue to start searching</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The catalogue is fetched through this app's own server so the export CDN's missing CORS
            headers are not an issue, then stored on this device for offline search.
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition shadow-md"
          >
            Download weekly catalogue
          </button>
        </div>
      )}
    </div>
  );
};
