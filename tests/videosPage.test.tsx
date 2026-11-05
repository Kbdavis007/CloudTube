import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { VideosPage } from '../src/components/views/VideosPage';
import type { VideoMetadata } from '../src/types';

const makeVideo = (youtubeId: string, title: string): VideoMetadata => ({
  id: `uuid-${youtubeId}`,
  youtubeId,
  title,
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
  thumbnails: {
    default: 'https://example.com/d.jpg',
    medium: 'https://example.com/m.jpg',
    high: 'https://example.com/h.jpg',
  },
  sourceFlags: ['YouTubeSearch'],
  indexedAt: '2023-01-01T00:00:00Z',
  lastUpdatedAt: '2023-01-01T00:00:00Z',
});

const render = (selectedVideo: VideoMetadata | null, allVideos: VideoMetadata[]) =>
  renderToStaticMarkup(
    React.createElement(VideosPage, {
      selectedVideo,
      isInLibrary: selectedVideo ? allVideos.some((v) => v.youtubeId === selectedVideo.youtubeId) : false,
      onSaveToLibrary: async () => {},
      allVideos,
      comments: [],
      onSelectVideo: () => {},
      onUpdatePersonal: async () => {},
      onHarvestComments: () => {},
      onUpdateAiSummary: async () => {},
      onRequestRemoval: () => {},
      onBackToVideos: () => {},
    })
  );

const SAVE_TITLE = 'Add this video to your library';

test('the library listing shows the saved videos', () => {
  const html = render(null, [makeVideo('a', 'Saved video A')]);

  assert.match(html, /Saved video A/);
  assert.match(html, /All Library Videos/);
});

test('an unsaved video being watched offers to be saved, not silently listed', () => {
  const watched = makeVideo('result', 'A watched search result');
  const html = render(watched, []);

  assert.match(html, /A watched search result/);
  assert.match(html, new RegExp(SAVE_TITLE));
  assert.match(html, /Not in Library/);
});

test('a saved video shows library actions rather than the save prompt', () => {
  const saved = makeVideo('saved', 'A saved video');
  const html = render(saved, [saved]);

  assert.doesNotMatch(html, new RegExp(SAVE_TITLE));
  assert.match(html, /in Library/);
});
