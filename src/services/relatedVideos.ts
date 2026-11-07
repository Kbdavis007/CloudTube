import type { VideoMetadata } from '../types';

/**
 * Pick videos related to the one being watched.
 *
 * Relatedness is scored from the metadata every list already carries, so the
 * same helper works for the library, search results and the baked catalogue:
 * a shared tag or the same uploader counts strongly, the same source and shared
 * title words count less, and a similar length is a small tie-breaker. The pool
 * is whatever list the caller has to hand (the current queue, or the catalogue).
 *
 * The current video and anything already in the queue are excluded, so the
 * result never repeats something the prev/next buttons already reach.
 */

/** A candidate pool plus the video to find relatives for. */
export interface RelatedOptions {
  /** Videos to choose from; the current video is ignored if present. */
  pool: VideoMetadata[];
  /** Videos already reachable by prev/next, excluded from the result. */
  exclude?: VideoMetadata[];
  /** How many to return. */
  limit?: number;
}

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

const durationSeconds = (video: VideoMetadata): number => video.durationSeconds ?? 0;

/** How related `candidate` is to `video`; 0 means unrelated. */
export function relatednessScore(video: VideoMetadata, candidate: VideoMetadata): number {
  let score = 0;

  if (candidate.channelId && candidate.channelId === video.channelId) score += 5;
  if (candidate.sourceFlags.some((flag) => video.sourceFlags.includes(flag))) score += 1;

  const tags = new Set(video.tags.map((tag) => tag.toLowerCase()));
  for (const tag of candidate.tags) {
    if (tags.has(tag.toLowerCase())) score += 3;
  }

  const words = new Set(tokenize(video.title));
  for (const word of new Set(tokenize(candidate.title))) {
    if (words.has(word)) score += 2;
  }

  // A similar length only sharpens an existing match; on its own it is noise,
  // since two unrelated videos can easily run the same length.
  if (score > 0) {
    const a = durationSeconds(video);
    const b = durationSeconds(candidate);
    if (a > 0 && b > 0) {
      const ratio = Math.min(a, b) / Math.max(a, b);
      if (ratio > 0.5) score += 1;
    }
  }

  return score;
}

/** Order a pool by relatedness to `video`, strongest first, ties kept stable. */
export function rankRelatedVideos(video: VideoMetadata, pool: VideoMetadata[]): VideoMetadata[] {
  return pool
    .filter((candidate) => candidate.youtubeId !== video.youtubeId)
    .map((candidate, index) => ({ candidate, index, score: relatednessScore(video, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.candidate);
}

/**
 * Related videos for the one being watched, up to `limit`.
 *
 * Strong matches come first. When fewer than `limit` clear the relatedness bar,
 * the list is topped up with same-source videos (still excluding the current
 * video and the queue) so the section is rarely thin — the baked catalogue gives
 * a large same-source pool even when a video has no shared tags.
 */
export function findRelatedVideos(video: VideoMetadata, options: RelatedOptions): VideoMetadata[] {
  const { pool, exclude = [], limit = 6 } = options;
  const excluded = new Set<string>([video.youtubeId, ...exclude.map((v) => v.youtubeId)]);

  const candidates = pool.filter((candidate) => !excluded.has(candidate.youtubeId));
  const ranked = rankRelatedVideos(video, candidates);

  if (ranked.length >= limit) return ranked.slice(0, limit);

  const chosen = new Set(ranked.map((v) => v.youtubeId));
  const sameSource = candidates.filter(
    (candidate) =>
      !chosen.has(candidate.youtubeId) &&
      candidate.sourceFlags.some((flag) => video.sourceFlags.includes(flag))
  );

  return [...ranked, ...sameSource].slice(0, limit);
}
