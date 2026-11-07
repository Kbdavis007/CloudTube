import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_VIDEO_FILTERS,
  collectChannelOptions,
  collectSourceOptions,
  collectTagOptions,
  filterAndSortVideos,
  hasActiveVideoFilters,
  matchesVideoFilters,
  paginate,
  sortVideos,
  type VideoFilterState,
} from '../src/services/videoFilter';
import type { VideoMetadata } from '../src/types';

const makeVideo = (overrides: Partial<VideoMetadata> = {}): VideoMetadata => ({
  id: 'uuid',
  youtubeId: 'yt',
  title: 'A video',
  description: '',
  tags: [],
  channelId: 'chan-1',
  channelTitle: 'Channel One',
  publishedAt: '2023-06-01T00:00:00Z',
  duration: 'PT5M',
  durationSeconds: 300,
  viewCount: 0,
  likeCount: 0,
  commentCount: 0,
  thumbnails: { default: '', medium: '', high: '' },
  sourceFlags: ['YouTubeSearch'],
  indexedAt: '2023-06-01T00:00:00Z',
  lastUpdatedAt: '2023-06-01T00:00:00Z',
  ...overrides,
});

const withFilters = (patch: Partial<VideoFilterState>): VideoFilterState => ({
  ...DEFAULT_VIDEO_FILTERS,
  ...patch,
});

test('hasActiveVideoFilters is false for the defaults and true once a filter is set', () => {
  assert.equal(hasActiveVideoFilters(DEFAULT_VIDEO_FILTERS), false);
  assert.equal(hasActiveVideoFilters(withFilters({ query: 'x' })), true);
  assert.equal(hasActiveVideoFilters(withFilters({ sort: 'title' })), true);
});

test('the free-text search matches any of title, channel, description or tag', () => {
  const video = makeVideo({
    title: 'Rust Ownership',
    channelTitle: 'Ferris Talks',
    description: 'borrow checker',
    tags: ['systems'],
  });

  assert.ok(matchesVideoFilters(video, withFilters({ query: 'ownership' })));
  assert.ok(matchesVideoFilters(video, withFilters({ query: 'ferris' })));
  assert.ok(matchesVideoFilters(video, withFilters({ query: 'borrow' })));
  assert.ok(matchesVideoFilters(video, withFilters({ query: 'systems' })));
  assert.equal(matchesVideoFilters(video, withFilters({ query: 'python' })), false);
});

test('every whitespace-separated search term must match, so terms narrow', () => {
  const video = makeVideo({ title: 'Rust Ownership', description: 'borrow checker' });

  assert.ok(matchesVideoFilters(video, withFilters({ query: 'rust borrow' })));
  assert.equal(matchesVideoFilters(video, withFilters({ query: 'rust python' })), false);
});

test('extraSearchText lets a caller search fields outside the common model', () => {
  const video = makeVideo({ title: 'Unrelated' });

  assert.equal(matchesVideoFilters(video, withFilters({ query: 'actor-name' })), false);
  assert.ok(
    matchesVideoFilters(video, withFilters({ query: 'actor-name' }), {
      extraSearchText: () => 'actor-name category-x',
    })
  );
});

test('source, channel and tag filters each narrow the list', () => {
  const video = makeVideo({ sourceFlags: ['Vega'], channelId: 'v-1', tags: ['tag-a'] });

  assert.ok(matchesVideoFilters(video, withFilters({ source: 'Vega' })));
  assert.equal(matchesVideoFilters(video, withFilters({ source: 'YouTubeSearch' })), false);
  assert.ok(matchesVideoFilters(video, withFilters({ channel: 'v-1' })));
  assert.equal(matchesVideoFilters(video, withFilters({ channel: 'other' })), false);
  assert.ok(matchesVideoFilters(video, withFilters({ tag: 'tag-a' })));
  assert.equal(matchesVideoFilters(video, withFilters({ tag: 'tag-b' })), false);
});

test('score, rating, duration and date filters behave as their labels promise', () => {
  const video = makeVideo({
    durationSeconds: 60,
    publishedAt: '2023-06-15T00:00:00Z',
    personal: { videoId: 'yt', indexScore: 10, userRating: 80, userNotes: '', userTags: [], isFavorite: true },
  });

  assert.ok(matchesVideoFilters(video, withFilters({ score: 'elite' })));
  assert.equal(matchesVideoFilters(video, withFilters({ score: 'low' })), false);
  assert.ok(matchesVideoFilters(video, withFilters({ rating: 'rated' })));
  assert.ok(matchesVideoFilters(video, withFilters({ rating: 'favorites' })));
  assert.equal(matchesVideoFilters(video, withFilters({ rating: 'unrated' })), false);
  assert.ok(matchesVideoFilters(video, withFilters({ duration: 'short' })));
  assert.equal(matchesVideoFilters(video, withFilters({ duration: 'long' })), false);
  assert.ok(matchesVideoFilters(video, withFilters({ publishedFrom: '2023-06-01', publishedTo: '2023-06-30' })));
  assert.equal(matchesVideoFilters(video, withFilters({ publishedFrom: '2023-07-01' })), false);
});

test('filterAndSortVideos applies filters then sorts without mutating the input', () => {
  const a = makeVideo({ youtubeId: 'a', title: 'Beta', personal: { videoId: 'a', indexScore: 30, userRating: 0, userNotes: '', userTags: [] } });
  const b = makeVideo({ youtubeId: 'b', title: 'Alpha', personal: { videoId: 'b', indexScore: 10, userRating: 0, userNotes: '', userTags: [] } });
  const c = makeVideo({ youtubeId: 'c', title: 'Gamma', personal: { videoId: 'c', indexScore: 90, userRating: 0, userNotes: '', userTags: [] } });
  const input = [a, b, c];

  const byScore = filterAndSortVideos(input, withFilters({ sort: 'score' }));
  assert.deepEqual(byScore.map((v) => v.youtubeId), ['b', 'a', 'c']);

  const byTitle = filterAndSortVideos(input, withFilters({ sort: 'title' }));
  assert.deepEqual(byTitle.map((v) => v.youtubeId), ['b', 'a', 'c']);

  // The original array order is untouched.
  assert.deepEqual(input.map((v) => v.youtubeId), ['a', 'b', 'c']);
});

test('sortVideos supports newest-first and views', () => {
  const older = makeVideo({ youtubeId: 'older', publishedAt: '2020-01-01T00:00:00Z', viewCount: 5 });
  const newer = makeVideo({ youtubeId: 'newer', publishedAt: '2024-01-01T00:00:00Z', viewCount: 500 });

  assert.deepEqual(sortVideos([older, newer], 'date_desc').map((v) => v.youtubeId), ['newer', 'older']);
  assert.deepEqual(sortVideos([older, newer], 'views').map((v) => v.youtubeId), ['newer', 'older']);
});

test('collect* helpers count and order options, most common first', () => {
  const videos = [
    makeVideo({ channelId: 'c1', channelTitle: 'One', sourceFlags: ['Vega'], tags: ['x'] }),
    makeVideo({ channelId: 'c1', channelTitle: 'One', sourceFlags: ['Vega'], tags: ['x'] }),
    makeVideo({ channelId: 'c2', channelTitle: 'Two', sourceFlags: ['YouTubeSearch'], tags: ['y'] }),
  ];

  assert.deepEqual(collectSourceOptions(videos), [['Vega', 2], ['YouTubeSearch', 1]]);
  assert.deepEqual(collectChannelOptions(videos), [['c1', 2], ['c2', 1]]);
  assert.deepEqual(collectTagOptions(videos), [['x', 2], ['y', 1]]);
});

test('collectTagOptions includes personal user tags', () => {
  const video = makeVideo({
    tags: ['base'],
    personal: { videoId: 'yt', indexScore: 50, userRating: 0, userNotes: '', userTags: ['mine'] },
  });
  assert.deepEqual(collectTagOptions([video]), [['base', 1], ['mine', 1]]);
});

test('paginate clamps the page and slices the items', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  const first = paginate(items, 0, 10);
  assert.equal(first.page, 0);
  assert.equal(first.pageCount, 3);
  assert.deepEqual(first.items, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const last = paginate(items, 2, 10);
  assert.deepEqual(last.items, [20, 21, 22, 23, 24]);

  // Out-of-range pages clamp to the last valid page.
  const clamped = paginate(items, 99, 10);
  assert.equal(clamped.page, 2);

  // An empty list is still one (empty) page.
  const empty = paginate([], 0, 10);
  assert.equal(empty.pageCount, 1);
  assert.deepEqual(empty.items, []);
});
