import type { VideoMetadata } from '../types';

export interface PlayerSelection {
  /** The video to play, or null when nothing is selected. */
  video: VideoMetadata | null;
  /**
   * Whether the video is saved in the library. A false value means it is being
   * watched without being saved, so the player offers "Save to Library".
   */
  isInLibrary: boolean;
}

/**
 * Resolve which video the player should show.
 *
 * A video only enters the library when the user saves it, so playing a search
 * result must not persist it. The played video is therefore held as a transient
 * (`ephemeral`) selection until the user saves it, and this picks it up when it
 * is not in the library.
 *
 * The `queue` is the list the video was played from (search results, catalogue).
 * Prev/next moves through that queue, so a video reached that way — and still
 * unsaved — is resolved from the queue rather than dropped to null.
 */
export function resolvePlayerSelection(
  videos: VideoMetadata[],
  selectedVideoId: string,
  ephemeral: VideoMetadata | null,
  queue: VideoMetadata[] = []
): PlayerSelection {
  const saved = videos.find((v) => v.youtubeId === selectedVideoId);
  if (saved) return { video: saved, isInLibrary: true };
  if (ephemeral && ephemeral.youtubeId === selectedVideoId) {
    return { video: ephemeral, isInLibrary: false };
  }
  const queued = queue.find((v) => v.youtubeId === selectedVideoId);
  if (queued) return { video: queued, isInLibrary: false };
  return { video: null, isInLibrary: false };
}
