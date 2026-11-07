import type { SourceFlag } from '../types';

/**
 * Badge colours for each source flag, in one place so every card that renders a
 * source badge looks the same. Exhaustive over `SourceFlag`, so adding a flag is
 * a compile error here rather than a silently unstyled badge.
 */
export const SOURCE_FLAG_COLORS: Record<SourceFlag, string> = {
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

/** Badge classes for a flag, with a neutral fallback for an unknown value. */
export const sourceFlagColor = (flag: SourceFlag): string =>
  SOURCE_FLAG_COLORS[flag] || 'bg-slate-800 text-slate-300';
