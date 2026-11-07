import React, { useState } from 'react';
import {
  Ban,
  Check,
  Expand,
  Play,
  Plus,
  Star,
  StopCircle,
  Tv,
  TrendingDown,
} from 'lucide-react';
import type { TasteAssessment, VideoMetadata } from '../types';
import { sourceFlagLabel } from '../data/sourceLabels';
import { sourceFlagColor } from '../data/sourceFlagColors';
import { hoverPreviewEmbedUrl, inlinePlayerEmbedUrl } from '../services/preview';
import { HoverPreview } from './HoverPreview';

export interface SearchResultCardProps {
  video: VideoMetadata;
  /** Taste-profile assessment used to show the score and a demotion note. */
  assessment: TasteAssessment;
  adjustedScore: number;
  isIndexed: boolean;
  /** The whole (filtered, sorted) result list, passed on when the full player opens. */
  resultQueue: VideoMetadata[];
  queueLabel: string;
  onIndexVideo: (video: VideoMetadata) => void;
  onPlayVideo: (video: VideoMetadata, queue: VideoMetadata[], label: string) => void;
  onExpandChannel: (channelId: string, channelTitle: string) => void;
}

const formatViews = (views: number) => {
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + 'M views';
  if (views >= 1_000) return (views / 1_000).toFixed(1) + 'k views';
  return views + ' views';
};

/**
 * One search result.
 *
 * A card can play its video **in place**: pressing Play swaps the thumbnail for
 * the source's own player, so a result can be previewed without leaving the
 * results. Playback is per-card state, so several results can play at once. The
 * in-place player keeps a "Full page" action for the dedicated player view.
 */
export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  video,
  assessment,
  adjustedScore,
  isIndexed,
  resultQueue,
  queueLabel,
  onIndexVideo,
  onPlayVideo,
  onExpandChannel,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const demoted = assessment.penalty > 0 || assessment.muted;
  // Open-source results carry their own embed and have no YouTube channel to
  // expand, so they play in-app without a sign-in.
  const isOpenSource = !!video.playback;
  const embedUrl = inlinePlayerEmbedUrl(video);
  const openFullPage = () => onPlayVideo(video, resultQueue, queueLabel);

  return (
    <div
      className={`flex flex-col rounded-2xl bg-slate-900/80 border overflow-hidden transition group shadow-md ${
        assessment.muted
          ? 'border-red-900/50 opacity-80 hover:opacity-100'
          : 'border-slate-800 hover:border-orange-500/50'
      }`}
      data-testid="search-result-card"
    >
      {/* Thumbnail Header */}
      <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
        {isPlaying && embedUrl ? (
          <>
            <iframe
              src={embedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
              data-testid="search-inline-player"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
              <button
                onClick={openFullPage}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[10px] font-bold border border-white/15 transition"
                title="Open this video in the full player"
              >
                <Expand className="w-3 h-3" /> Full page
              </button>
              <button
                onClick={() => setIsPlaying(false)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[10px] font-bold border border-white/15 transition"
                title="Stop playing in the card"
              >
                <StopCircle className="w-3 h-3" /> Stop
              </button>
            </div>
          </>
        ) : (
          <>
            <HoverPreview
              poster={video.thumbnails.medium}
              alt={video.title}
              previewUrl={video.playback?.previewUrl}
              previewFrames={video.playback?.previewFrames}
              embedUrl={hoverPreviewEmbedUrl(video)}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 pointer-events-none" />

              {/* Play Overlay: plays the video in this card, not the full page */}
              <button
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition bg-black/40"
                title="Play in this card"
                aria-label={`Play ${video.title} in this card`}
              >
                <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-xl hover:scale-110 transition">
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                </div>
              </button>
            </HoverPreview>

            {/* Duration Badge */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 font-mono text-[11px] font-semibold text-white">
              {video.duration.replace('PT', '').toLowerCase()}
            </div>
          </>
        )}

        {/* Pre-calculated score, adjusted by the taste profile */}
        {!isPlaying && (
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-orange-600/90 backdrop-blur-xs text-white text-[11px] font-extrabold shadow-md flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            <span>Score: {adjustedScore}</span>
            {demoted && (
              <span className="text-[10px] font-bold text-amber-200" title={`Taste penalty -${assessment.penalty}`}>
                (base {video.personal?.indexScore ?? 50})
              </span>
            )}
          </div>
        )}

        {/* Taste profile badges */}
        {assessment.muted && !isPlaying && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-red-600/90 text-white text-[10px] font-extrabold shadow-md flex items-center gap-1">
            <Ban className="w-3 h-3" /> Muted channel
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-orange-400/90">{video.channelTitle}</span>
            <span>{isOpenSource ? '' : formatViews(video.viewCount)}</span>
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
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sourceFlagColor(flag)}`}
            >
              {sourceFlagLabel(flag)}
            </span>
          ))}
        </div>

        {/* Why this video was demoted by the learned taste profile */}
        {demoted && (
          <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-600/30 space-y-1">
            <div className="text-[10px] font-bold text-amber-300 flex items-center gap-1 uppercase tracking-wider">
              <TrendingDown className="w-3 h-3" /> Demoted by your removals
            </div>
            <ul className="space-y-0.5">
              {assessment.signals.slice(0, 3).map((signal, i) => (
                <li key={i} className="text-[10px] text-amber-200/90 flex items-center justify-between gap-2">
                  <span className="truncate">{signal.label}</span>
                  <span className="font-mono shrink-0">-{signal.penalty}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions: save to library, play here, collect channel / open full page */}
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
                <Check className="w-3.5 h-3.5" /> Saved
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" /> Save
              </>
            )}
          </button>

          {isPlaying ? (
            <button
              onClick={openFullPage}
              className="flex items-center gap-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 border border-slate-700"
              title="Open this video in the full player"
            >
              <Expand className="w-3.5 h-3.5 text-orange-400" />
              <span>Full page</span>
            </button>
          ) : isOpenSource ? (
            <button
              onClick={() => setIsPlaying(true)}
              className="flex items-center gap-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 border border-slate-700"
              title="Play this video inside CloudTube"
            >
              <Play className="w-3.5 h-3.5 text-orange-400" />
              <span>Play</span>
            </button>
          ) : (
            <button
              onClick={() => onExpandChannel(video.channelId, video.channelTitle)}
              className="flex items-center gap-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 border border-slate-700"
              title="Collect every video from this channel"
            >
              <Tv className="w-3.5 h-3.5 text-orange-400" />
              <span>Collect Channel</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
