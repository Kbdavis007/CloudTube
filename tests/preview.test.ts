import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hoverPreviewEmbedUrl,
  inlinePlayerEmbedUrl,
  withAutoplay,
  youtubeEmbedUrl,
  youtubePlayerUrl,
} from '../src/services/preview';
import type { VideoMetadata } from '../src/types';

const makeVideo = (overrides: Partial<VideoMetadata> = {}): VideoMetadata =>
  ({
    id: 'uuid',
    youtubeId: 'abc123',
    title: 'A video',
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
    sourceFlags: ['YouTubeSearch'],
    indexedAt: '2023-01-01T00:00:00Z',
    lastUpdatedAt: '2023-01-01T00:00:00Z',
    ...overrides,
  }) as VideoMetadata;

test('a preview embed is muted and autoplaying', () => {
  assert.equal(withAutoplay('https://example.com/embed/x'), 'https://example.com/embed/x?autoplay=1&mute=1');
  assert.equal(withAutoplay('https://example.com/embed/x?a=b'), 'https://example.com/embed/x?a=b&autoplay=1&mute=1');
  assert.equal(withAutoplay(undefined), undefined);
});

test('a source with its own embed previews that embed, muted and autoplaying', () => {
  const video = makeVideo({
    playback: { embedUrl: 'https://source.test/embed/1', externalUrl: 'https://source.test/watch/1' },
  });

  assert.equal(hoverPreviewEmbedUrl(video), 'https://source.test/embed/1?autoplay=1&mute=1');
});

test('a source without an embed falls back to its external page', () => {
  const video = makeVideo({
    playback: { embedUrl: '', externalUrl: 'https://source.test/watch/1' },
  });

  assert.equal(hoverPreviewEmbedUrl(video), 'https://source.test/watch/1?autoplay=1&mute=1');
});

test('a YouTube video previews its embed, which the source does not provide', () => {
  const video = makeVideo({ youtubeId: 'dQw4w9WgXcQ' });

  assert.equal(hoverPreviewEmbedUrl(video), youtubeEmbedUrl('dQw4w9WgXcQ'));
  assert.match(hoverPreviewEmbedUrl(video)!, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  assert.match(hoverPreviewEmbedUrl(video)!, /autoplay=1&mute=1/);
});

test('an in-place player uses the source embed, or the YouTube player when there is none', () => {
  const source = makeVideo({
    playback: { embedUrl: 'https://source.test/embed/1', externalUrl: 'https://source.test/watch/1' },
  });
  assert.equal(inlinePlayerEmbedUrl(source), 'https://source.test/embed/1');

  const youtube = makeVideo({ youtubeId: 'dQw4w9WgXcQ' });
  assert.equal(inlinePlayerEmbedUrl(youtube), youtubePlayerUrl('dQw4w9WgXcQ'));
  // The in-place player is interactive: sound on and controls shown, unlike the
  // muted hover preview.
  assert.doesNotMatch(inlinePlayerEmbedUrl(youtube)!, /mute=1/);
  assert.doesNotMatch(inlinePlayerEmbedUrl(youtube)!, /controls=0/);
});

test('an in-place player falls back to the external page when a source has no embed', () => {
  const video = makeVideo({
    playback: { embedUrl: '', externalUrl: 'https://source.test/watch/1' },
  });

  assert.equal(inlinePlayerEmbedUrl(video), 'https://source.test/watch/1');
});
