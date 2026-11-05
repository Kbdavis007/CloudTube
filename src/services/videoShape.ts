import type { SourceFlag, VideoMetadata } from '../types';
import { SOURCE_ALIASES } from '../data/sourceAliases';

/**
 * Shared shape for the open (non-YouTube) search sources.
 *
 * This module is imported by both the browser and the edge Worker, so it must
 * stay free of DOM and Cloudflare APIs. The Worker builds the same
 * `VideoMetadata` objects here, stores them in D1, and hands them back to the
 * client, so a video found through the cache is byte-identical to one found
 * through a direct call.
 */

export type OpenSourceId =
  | 'vega'
  | 'archive'
  | 'peertube'
  | 'dailymotion'
  | 'eporner'
  | 'embedhub'
  | 'redgifs'
  | 'pornhub'
  | 'xhamster'
  | 'redtube';

export interface OpenSourceDefinition {
  id: OpenSourceId;
  name: string;
  tagline: string;
  flag: SourceFlag;
  accent: string;
  /** Needs the user's RapidAPI key; off by default in the picker. */
  requiresKey?: boolean;
}

/**
 * Key-free, CORS-enabled sources CloudTube can search without a sign-in.
 *
 * Each source returns a normalised `VideoMetadata` that carries its own
 * `playback.embedUrl`, so the existing sandboxed player can show it without any
 * player changes: playback stays inside the app and the only way out is the
 * explicit "Go to Source Site" link built from `playback.externalUrl`.
 */
export const OPEN_SOURCES: OpenSourceDefinition[] = [
  {
    id: 'vega',
    name: SOURCE_ALIASES.Vega!,
    tagline: 'Built-in catalogue (searched offline)',
    flag: 'Vega',
    accent: 'bg-sky-700/20 text-orange-300 border-orange-700/40',
  },
  {
    id: 'archive',
    name: 'Archive.org',
    tagline: 'Internet Archive public-domain video',
    flag: 'ArchiveOrg',
    accent: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'peertube',
    name: 'PeerTube',
    tagline: 'Federated PeerTube search (SepiaSearch)',
    flag: 'PeerTube',
    accent: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  {
    id: 'dailymotion',
    name: 'Dailymotion',
    tagline: 'Dailymotion public catalogue',
    flag: 'Dailymotion',
    accent: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  {
    id: 'eporner',
    name: SOURCE_ALIASES.Eporner!,
    tagline: 'Public catalogue',
    flag: 'Eporner',
    accent: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  },
  {
    id: 'embedhub',
    name: SOURCE_ALIASES.EmbedHub!,
    tagline: 'Open video database',
    flag: 'EmbedHub',
    accent: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  {
    id: 'redgifs',
    name: SOURCE_ALIASES.RedGifs!,
    tagline: 'Short clips (via CloudTube proxy)',
    flag: 'RedGifs',
    accent: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
  {
    id: 'pornhub',
    name: SOURCE_ALIASES.Pornhub!,
    tagline: 'Catalogue (needs your RapidAPI key)',
    flag: 'Pornhub',
    accent: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    requiresKey: true,
  },
  {
    id: 'xhamster',
    name: SOURCE_ALIASES.Xhamster!,
    tagline: 'Catalogue (needs your RapidAPI key)',
    flag: 'Xhamster',
    accent: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    requiresKey: true,
  },
  {
    id: 'redtube',
    name: SOURCE_ALIASES.Redtube!,
    tagline: 'Catalogue (needs your RapidAPI key)',
    flag: 'Redtube',
    accent: 'bg-red-600/20 text-red-300 border-red-600/30',
    requiresKey: true,
  },
];

const OPEN_SOURCE_BY_ID = new Map<OpenSourceId, OpenSourceDefinition>(
  OPEN_SOURCES.map((s) => [s.id, s])
);

export const openSourceById = (id: OpenSourceId): OpenSourceDefinition =>
  OPEN_SOURCE_BY_ID.get(id) as OpenSourceDefinition;

export const isOpenSourceId = (value: unknown): value is OpenSourceId =>
  typeof value === 'string' && OPEN_SOURCE_BY_ID.has(value as OpenSourceId);

export const toIsoDuration = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  let out = 'PT';
  if (h) out += `${h}H`;
  if (m || h) out += `${m}M`;
  out += `${sec}S`;
  return out;
};

export interface DraftVideo {
  sourceVideoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  durationSeconds: number;
  thumbnail: string;
  tags: string[];
  embedUrl: string;
  externalUrl: string;
  /** Optional hover-preview media; see `PlaybackTarget`. */
  previewUrl?: string;
  previewFrames?: string[];
}

/** Assemble the VideoMetadata shape the rest of the app already understands. */
export function toVideoMetadata(source: OpenSourceDefinition, draft: DraftVideo): VideoMetadata {
  const now = new Date().toISOString();
  const youtubeId = `${source.id}:${draft.sourceVideoId}`;
  return {
    id: crypto.randomUUID(),
    youtubeId,
    title: draft.title,
    description: draft.description,
    tags: draft.tags,
    channelId: draft.channelId,
    channelTitle: draft.channelTitle,
    publishedAt: draft.publishedAt || now,
    duration: toIsoDuration(draft.durationSeconds),
    durationSeconds: draft.durationSeconds,
    // These sources expose no engagement counts here, so they stay at zero
    // rather than being invented.
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    thumbnails: {
      default: draft.thumbnail,
      medium: draft.thumbnail,
      high: draft.thumbnail,
    },
    posterUrl: draft.thumbnail,
    sourceVideoId: draft.sourceVideoId,
    playback: {
      embedUrl: draft.embedUrl,
      externalUrl: draft.externalUrl,
      ...(draft.previewUrl ? { previewUrl: draft.previewUrl } : {}),
      ...(draft.previewFrames?.length ? { previewFrames: draft.previewFrames } : {}),
    },
    sourceFlags: [source.flag],
    indexedAt: now,
    lastUpdatedAt: now,
    personal: {
      videoId: youtubeId,
      indexScore: 50,
      userRating: 70,
      userNotes: '',
      userTags: [`${source.name}-Imported`],
    },
  };
}
