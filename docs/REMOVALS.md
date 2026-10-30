# Removing Videos and Learning From It

Removing a video is not just a delete. Every removal records **why**, and those
reasons decide which videos you are shown next. The whole loop is local: reasons
live in IndexedDB, nothing is sent anywhere.

## Removing a video

Removal is available wherever a library video appears:

- **Dashboard** - the Remove button on each row in "Highest Ranked Videos".
- **Video Viewer** - the trash icon next to the favorite button.
- **Ratings & Notes** - the trash icon on each row.

All three open the same dialog, which asks for a reason and an optional note.

## Reasons

The reason set is deliberately small so each value maps to a distinct signal
rather than a free-text tag. Each reason carries two weights, defined in
`src/data/removalReasons.ts`:

| Reason | Channel weight | Tag weight |
|---|---|---|
| Not relevant to me | 6 | 3 |
| Dislike this creator | 14 | 1 |
| Low quality / shallow | 8 | 4 |
| Clickbait / misleading | 9 | 4 |
| I already know this | 5 | 5 |
| Duplicate of another video | 4 | 2 |
| Too long / padded | 3 | 2 |
| Outdated | 3 | 2 |
| Other reason | 2 | 1 |

A reason about the **creator** pushes the channel down hard. A reason about the
**content** pushes the video's tags down. A note is kept verbatim for context but
does not affect ranking.

"Use this reason to select future videos" is on by default. Turning it off keeps
the removal in the log (it still counts in the reason breakdown) but excludes it
from the ranking signals.

## How reasons change future selection

`src/services/tasteProfile.ts` turns the removal log into a profile:

1. **Channel penalties** - each removal adds its channel weight to that channel,
   capped at 50. A channel is **muted** once it has at least 2 removals and at
   least 24 points of penalty, so one bad video is never enough.
2. **Tag penalties** - each removal adds its tag weight to each of the video's
   YouTube and personal tags, capped at 18 per tag.

The profile is *derived*, never stored. It is recomputed from the log, so
restoring or forgetting a removal takes effect immediately.

Search applies the profile when **Personalized** is on (the default):

- Each result's IndexScore is raised by its total penalty (channel + tag,
  capped at 60). IndexScore is 1 = best, so a higher number means lower priority.
- Videos from muted channels are sorted to the end and labelled **Muted channel**.
- Any demoted card shows exactly which signals applied and how much each cost, so
  a surprising ranking is explainable rather than mysterious.

## Undoing a removal

The **Removed & Taste** tab lists every removal with its reason, note, and the
signals it is contributing. Two actions:

- **Restore** - puts the video back in the library and deletes the removal record.
  The reason stops influencing ranking.
- **Forget** - deletes the removal record but leaves the video removed. Use this
  when a reason was wrong: the video stays gone, but it stops skewing selection.

The tab also shows the reason breakdown and the channels and tags currently
losing rank.

## Storage

Removals are a fifth IndexedDB store (`removals`), added in schema version 2 with
an in-place upgrade that preserves existing videos, channels, comments, and jobs.
Each record holds the full video snapshot, the reason, the note, the timestamp,
and whether it feeds the profile.

Library export/import (`Settings & Quotas`) includes removals, so a backup
carries the learned taste profile with it. Older backups without a `removals` key
still import.

## Code map

- `src/data/removalReasons.ts` - the reason set and its weights.
- `src/services/tasteProfile.ts` - profile aggregation, scoring, and ranking.
- `src/components/RemoveVideoModal.tsx` - the reason-capture dialog.
- `src/components/views/RemovalsView.tsx` - the removal log and taste insights.
- `src/services/indexedDB.ts` - the `removals` store and its CRUD.
