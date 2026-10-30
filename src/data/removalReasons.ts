import { RemovalReason } from '../types';

export interface RemovalReasonMeta {
  id: RemovalReason;
  label: string;
  /** What the reason means, shown in the remove dialog and the insights view. */
  hint: string;
  /**
   * How strongly one removal with this reason should push future videos from
   * the same channel down the ranking. A reason about the creator is a stronger
   * signal than one about a single video's length.
   */
  channelWeight: number;
  /** How strongly it should penalize the video's tags in future discovery. */
  tagWeight: number;
}

export const REMOVAL_REASONS: RemovalReasonMeta[] = [
  {
    id: 'not-relevant',
    label: 'Not relevant to me',
    hint: 'Off-topic for the topics you actually want.',
    channelWeight: 6,
    tagWeight: 3,
  },
  {
    id: 'disliked-creator',
    label: 'Dislike this creator',
    hint: 'You do not want more from this channel.',
    channelWeight: 14,
    tagWeight: 1,
  },
  {
    id: 'low-quality',
    label: 'Low quality / shallow',
    hint: 'Thin on substance, little to learn.',
    channelWeight: 8,
    tagWeight: 4,
  },
  {
    id: 'clickbait',
    label: 'Clickbait / misleading',
    hint: 'Title or thumbnail overpromised.',
    channelWeight: 9,
    tagWeight: 4,
  },
  {
    id: 'already-known',
    label: 'I already know this',
    hint: 'Nothing new to learn from this topic.',
    channelWeight: 5,
    tagWeight: 5,
  },
  {
    id: 'duplicate',
    label: 'Duplicate of another video',
    hint: 'Covered better elsewhere in the library.',
    channelWeight: 4,
    tagWeight: 2,
  },
  {
    id: 'too-long',
    label: 'Too long / padded',
    hint: 'Buried the point in runtime.',
    channelWeight: 3,
    tagWeight: 2,
  },
  {
    id: 'outdated',
    label: 'Outdated',
    hint: 'Superseded by newer material.',
    channelWeight: 3,
    tagWeight: 2,
  },
  {
    id: 'other',
    label: 'Other reason',
    hint: 'Captured in your note below.',
    channelWeight: 2,
    tagWeight: 1,
  },
];

const BY_ID = new Map<RemovalReason, RemovalReasonMeta>(REMOVAL_REASONS.map((r) => [r.id, r]));

export const getRemovalReason = (id: RemovalReason): RemovalReasonMeta =>
  BY_ID.get(id) ?? REMOVAL_REASONS[REMOVAL_REASONS.length - 1];
