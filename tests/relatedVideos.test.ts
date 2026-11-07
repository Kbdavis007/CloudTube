import test from 'node:test';
import assert from 'node:assert/strict';

import { findRelatedVideos, rankRelatedVideos, relatednessScore } from '../src/services/relatedVideos';
import type { VideoMetadata } from '../src/types';

const makeVideo = (overrides: Partial<VideoMetadata> & { youtubeId: string }): VideoMetadata =>
  ({
    id: `uuid-${overrides.youtubeId}`,
    title: overrides.youtubeId,
    description: '',
    tags: [],
    channelId: 'chan',
    channelTitle: 'Channel',
    publishedAt: '2023-01-01T00:00:00Z',
    duration: 'PT5M',
    durationSeconds: 300,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    thumbnails: { default: '', medium: '', high: '' },
    sourceFlags: [],
    indexedAt: '2023-01-01T00:00:00Z',
    lastUpdatedAt: '2023-01-01T00:00:00Z',
    ...overrides,
  }) as VideoMetadata;

test('a shared tag and uploader score higher than an unrelated video', () => {
  const video = makeVideo({ youtubeId: 'base', tags: ['cooking'], channelId: 'chef' });

  const sameTagAndChannel = makeVideo({ youtubeId: 'a', tags: ['cooking'], channelId: 'chef' });
  const sameTagOnly = makeVideo({ youtubeId: 'b', tags: ['cooking'], channelId: 'other' });
  const unrelated = makeVideo({ youtubeId: 'c', tags: ['gaming'], channelId: 'other' });

  assert.ok(relatednessScore(video, sameTagAndChannel) > relatednessScore(video, sameTagOnly));
  assert.ok(relatednessScore(video, sameTagOnly) > relatednessScore(video, unrelated));
  assert.equal(relatednessScore(video, unrelated), 0, 'nothing shared means unrelated');
});

test('a similar length does not make unrelated videos related', () => {
  const video = makeVideo({ youtubeId: 'base', tags: ['cooking'], channelId: 'chef' });
  const sameLengthUnrelated = makeVideo({ youtubeId: 'other', tags: ['gaming'], channelId: 'gamer' });

  assert.equal(relatednessScore(video, sameLengthUnrelated), 0);
});

test('rankRelatedVideos drops the current video and anything unrelated, best first', () => {
  const video = makeVideo({ youtubeId: 'base', tags: ['cooking'], channelId: 'chef' });

  const ranked = rankRelatedVideos(video, [
    video,
    makeVideo({ youtubeId: 'tag', tags: ['cooking'] }),
    makeVideo({ youtubeId: 'same-channel', channelId: 'chef' }),
    makeVideo({ youtubeId: 'unrelated', tags: ['gaming'], channelId: 'other' }),
  ]);

  assert.deepEqual(
    ranked.map((v) => v.youtubeId),
    ['same-channel', 'tag'],
    'same uploader outranks a shared tag; the current and unrelated videos are dropped'
  );
});

test('findRelatedVideos honours the limit and never returns the current video', () => {
  const video = makeVideo({ youtubeId: 'base', tags: ['cooking'] });
  const pool = Array.from({ length: 10 }, (_, i) =>
    makeVideo({ youtubeId: `v${i}`, tags: ['cooking'] })
  );

  const related = findRelatedVideos(video, { pool, limit: 4 });

  assert.equal(related.length, 4);
  assert.ok(!related.some((v) => v.youtubeId === 'base'));
});

test('findRelatedVideos tops up with same-source videos when few are related', () => {
  const video = makeVideo({ youtubeId: 'base', tags: ['cooking'], sourceFlags: ['Vega'] });
  const pool = [
    makeVideo({ youtubeId: 'related', tags: ['cooking'], sourceFlags: ['Vega'] }),
    makeVideo({ youtubeId: 'same-source-1', tags: ['x'], sourceFlags: ['Vega'] }),
    makeVideo({ youtubeId: 'same-source-2', tags: ['y'], sourceFlags: ['Vega'] }),
    makeVideo({ youtubeId: 'other-source', tags: ['z'], sourceFlags: ['YouTubeSearch'] }),
  ];

  const related = findRelatedVideos(video, { pool, limit: 3 });

  assert.deepEqual(
    related.map((v) => v.youtubeId),
    ['related', 'same-source-1', 'same-source-2'],
    'the strong match comes first, then same-source filler'
  );
});

test('findRelatedVideos excludes the videos prev/next already reaches', () => {
  const video = makeVideo({ youtubeId: 'base', tags: ['cooking'] });
  const neighbour = makeVideo({ youtubeId: 'neighbour', tags: ['cooking'] });
  const other = makeVideo({ youtubeId: 'other', tags: ['cooking'] });

  const related = findRelatedVideos(video, { pool: [neighbour, other], exclude: [neighbour] });

  assert.deepEqual(related.map((v) => v.youtubeId), ['other']);
});
