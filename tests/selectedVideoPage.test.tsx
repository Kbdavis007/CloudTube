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

const makeVideo = (youtubeId: string): VideoMetadata => ({
  ...video,
  id: `uuid-${youtubeId}`,
  youtubeId,
  title: `Video ${youtubeId}`,
});

const render = (isInLibrary: boolean, relatedVideos: VideoMetadata[] = []) =>
  renderToStaticMarkup(
    React.createElement(SelectedVideoPage, {
      currentVideo: video,
      isInLibrary,
      onSaveToLibrary: async () => {},
      queue: isInLibrary ? [video] : [],
      queueLabel: 'Library',
      relatedVideos,
      indexedVideoIds: isInLibrary ? new Set([video.youtubeId]) : new Set<string>(),
      comments: [],
      onNavigateQueue: () => {},
      onPlayRelated: () => {},
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

test('the nav bar counts the queue the video was played from, not the library', () => {
  const queue = [
    makeVideo('first'),
    makeVideo('second'),
    makeVideo('third'),
  ];
  const html = renderToStaticMarkup(
    React.createElement(SelectedVideoPage, {
      currentVideo: queue[1],
      isInLibrary: false,
      onSaveToLibrary: async () => {},
      queue,
      queueLabel: 'Search results',
      relatedVideos: [],
      indexedVideoIds: new Set<string>(),
      comments: [],
      onNavigateQueue: () => {},
      onPlayRelated: () => {},
      onHarvestComments: () => {},
      onUpdatePersonal: async () => {},
      onUpdateAiSummary: async () => {},
      onRequestRemoval: () => {},
      onBack: () => {},
    })
  );

  assert.match(html, /Video 2 of 3 in Search results/);
});

test('related videos render under the player as playable cards', () => {
  const related = [makeVideo('rel-1'), makeVideo('rel-2')];
  const html = render(false, related);

  assert.match(html, /Related Videos/);
  assert.match(html, /Video rel-1/);
  assert.match(html, /Video rel-2/);
});
