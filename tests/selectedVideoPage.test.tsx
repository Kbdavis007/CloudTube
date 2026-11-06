import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SelectedVideoPage } from '../src/components/views/SelectedVideoPage';
import type { VideoMetadata } from '../src/types';

const video: VideoMetadata = {
  id: 'uuid-1',
  youtubeId: 'aaa',
  title: 'A result the user is only watching',
  description: '',
  tags: [],
  channelId: 'UC_test',
  channelTitle: 'Test Channel',
  publishedAt: '2023-01-01T00:00:00Z',
  duration: 'PT5M',
  durationSeconds: 300,
  viewCount: 10,
  likeCount: 1,
  commentCount: 0,
  thumbnails: {
    default: 'https://example.com/d.jpg',
    medium: 'https://example.com/m.jpg',
    high: 'https://example.com/h.jpg',
  },
  sourceFlags: ['YouTubeSearch'],
  indexedAt: '2023-01-01T00:00:00Z',
  lastUpdatedAt: '2023-01-01T00:00:00Z',
};

const render = (isInLibrary: boolean) =>
  renderToStaticMarkup(
    React.createElement(SelectedVideoPage, {
      currentVideo: video,
      isInLibrary,
      onSaveToLibrary: async () => {},
      allVideos: isInLibrary ? [video] : [],
      comments: [],
      onSelectVideo: () => {},
      onHarvestComments: () => {},
      onUpdatePersonal: async () => {},
      onUpdateAiSummary: async () => {},
      onRequestRemoval: () => {},
      onBack: () => {},
    })
  );

const SAVE_TITLE = 'Add this video to your library';
const REMOVE_TITLE = 'Remove this video and record why it should not be recommended again';

test('a watched video offers to be saved instead of being in the library', () => {
  const html = render(false);

  assert.match(html, new RegExp(SAVE_TITLE), 'the player offers "Save to Library"');
  assert.match(html, /Save to Library/);
  assert.match(html, /Not in Library/);
  assert.doesNotMatch(html, new RegExp(REMOVE_TITLE), 'removal only applies to saved videos');
});

test('a saved video is in the library and offers removal', () => {
  const html = render(true);

  assert.doesNotMatch(html, new RegExp(SAVE_TITLE), 'a saved video has nothing left to save');
  assert.match(html, new RegExp(REMOVE_TITLE));
  assert.match(html, /in Library/);
});
