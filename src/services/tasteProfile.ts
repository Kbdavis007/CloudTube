/**
 * Taste profile: turns removal reasons into ranking signals.
 *
 * Removing a video is only useful if it changes what shows up next. Every
 * removal carries a reason, and this module aggregates those reasons into a
 * profile of penalized channels and tags. `assessVideo` scores a not-yet-removed
 * video against that profile, so discovery (search results) can demote videos
 * that look like the ones already rejected and hide channels the user has
 * rejected repeatedly.
 *
 * The profile is derived, never stored: it is recomputed from the removal log,
 * so restoring or forgetting a removal takes effect immediately.
 */

import {
  RemovalReason,
  VideoMetadata,
  VideoRemoval,
  TasteProfile,
  TasteAssessment,
  TasteSignal,
  ChannelPenalty,
  TagPenalty,
} from '../types';
import { getRemovalReason } from '../data/removalReasons';

/** A channel's total penalty is capped so one bad channel cannot bury everything. */
const CHANNEL_PENALTY_CAP = 50;
/** A single tag's total penalty is capped so broad tags stay usable. */
const TAG_PENALTY_CAP = 18;
/** Combined channel + tag penalty applied to an indexScore (1 = best). */
const ASSESSMENT_PENALTY_CAP = 60;
/** A channel is muted only after at least this many removals... */
const MUTE_MIN_REMOVALS = 2;
/** ...and at least this much accumulated penalty, so one off day is not enough. */
const MUTE_PENALTY_THRESHOLD = 24;

const normalizeTag = (tag: string): string => tag.trim().toLowerCase();

/** The tags a video can be penalized on: YouTube tags plus the user's own. */
const videoTagSet = (video: VideoMetadata): string[] =>
  Array.from(
    new Set([...(video.tags || []), ...(video.personal?.userTags || [])].map(normalizeTag).filter(Boolean))
  );

const emptyReasonCounts = (): Record<RemovalReason, number> => ({
  'not-relevant': 0,
  'disliked-creator': 0,
  'low-quality': 0,
  clickbait: 0,
  'already-known': 0,
  duplicate: 0,
  'too-long': 0,
  outdated: 0,
  other: 0,
});

/** Build the profile from the removal log. Only removals marked as applied count. */
export const buildTasteProfile = (removals: VideoRemoval[]): TasteProfile => {
  const reasonCounts = emptyReasonCounts();
  const channelTotals = new Map<string, ChannelPenalty>();
  const tagTotals = new Map<string, TagPenalty>();

  for (const removal of removals) {
    reasonCounts[removal.reason] = (reasonCounts[removal.reason] || 0) + 1;
    if (!removal.appliedToProfile) continue;

    const meta = getRemovalReason(removal.reason);
    const { channelId, channelTitle } = removal.video;

    if (channelId) {
      const existing = channelTotals.get(channelId);
      if (existing) {
        existing.removals += 1;
        existing.penalty = Math.min(CHANNEL_PENALTY_CAP, existing.penalty + meta.channelWeight);
        existing.lastReason = removal.reason;
        existing.lastRemovedAt = removal.removedAt;
      } else {
        channelTotals.set(channelId, {
          channelId,
          channelTitle,
          removals: 1,
          penalty: Math.min(CHANNEL_PENALTY_CAP, meta.channelWeight),
          lastReason: removal.reason,
          lastRemovedAt: removal.removedAt,
        });
      }
    }

    for (const tag of videoTagSet(removal.video)) {
      const existing = tagTotals.get(tag);
      if (existing) {
        existing.removals += 1;
        existing.penalty = Math.min(TAG_PENALTY_CAP, existing.penalty + meta.tagWeight);
      } else {
        tagTotals.set(tag, { tag, removals: 1, penalty: Math.min(TAG_PENALTY_CAP, meta.tagWeight) });
      }
    }
  }

  const channelPenalties = Array.from(channelTotals.values()).sort((a, b) => b.penalty - a.penalty);
  const tagPenalties = Array.from(tagTotals.values()).sort((a, b) => b.penalty - a.penalty);

  return {
    totalRemovals: removals.length,
    reasonCounts,
    channelPenalties,
    tagPenalties,
    mutedChannelIds: channelPenalties
      .filter((c) => c.removals >= MUTE_MIN_REMOVALS && c.penalty >= MUTE_PENALTY_THRESHOLD)
      .map((c) => c.channelId),
  };
};

/** Score one candidate video against the profile, with the reasons why. */
export const assessVideo = (video: VideoMetadata, profile: TasteProfile): TasteAssessment => {
  const signals: TasteSignal[] = [];
  let penalty = 0;

  const channel = profile.channelPenalties.find((c) => c.channelId === video.channelId);
  if (channel && channel.penalty > 0) {
    penalty += channel.penalty;
    signals.push({
      kind: 'channel',
      label: `Channel "${channel.channelTitle}" removed ${channel.removals}\u00d7`,
      penalty: channel.penalty,
    });
  }

  const videoTags = videoTagSet(video);
  for (const tag of profile.tagPenalties) {
    if (tag.penalty > 0 && videoTags.includes(tag.tag)) {
      penalty += tag.penalty;
      signals.push({ kind: 'tag', label: `Tag #${tag.tag} removed ${tag.removals}\u00d7`, penalty: tag.penalty });
    }
  }

  return {
    penalty: Math.min(ASSESSMENT_PENALTY_CAP, penalty),
    muted: Boolean(video.channelId) && profile.mutedChannelIds.includes(video.channelId),
    signals: signals.sort((a, b) => b.penalty - a.penalty),
  };
};

/**
 * Fold an assessment into a video's IndexScore. IndexScore is 1 = best, so the
 * penalty is added and the result clamped to the 1-100 range.
 */
export const applyPenaltyToScore = (indexScore: number, assessment: TasteAssessment): number =>
  Math.max(1, Math.min(100, Math.round(indexScore + assessment.penalty)));

export interface RankedCandidate {
  video: VideoMetadata;
  assessment: TasteAssessment;
  /** IndexScore after the taste penalty; 1 = best. */
  adjustedScore: number;
}

/**
 * Rank discovery candidates the way the user would: muted channels last, then
 * by taste-adjusted IndexScore. Ties keep their original (YouTube relevance)
 * order because the sort is stable.
 */
export const rankCandidates = (videos: VideoMetadata[], profile: TasteProfile): RankedCandidate[] =>
  videos
    .map((video) => {
      const assessment = assessVideo(video, profile);
      const base = video.personal?.indexScore ?? 50;
      return { video, assessment, adjustedScore: applyPenaltyToScore(base, assessment) };
    })
    .sort((a, b) => {
      if (a.assessment.muted !== b.assessment.muted) return a.assessment.muted ? 1 : -1;
      return a.adjustedScore - b.adjustedScore;
    });
