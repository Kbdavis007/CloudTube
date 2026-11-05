import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ChannelView } from '../src/components/views/ChannelView';
import type { ChannelMetadata, VideoMetadata } from '../src/types';

const channel: ChannelMetadata = {
  channelId: 'UC_test_channel',
  title: 'Test Channel',
  description: 'A channel',
  customUrl: '@testchannel',
  publishedAt: '2020-01-01T00:00:00Z',
  thumbnail: 'https://example.com/thumb.jpg',
  subscriberCount: 1000,
  videoCount: 3,
  viewCount: 5000,
  isExpanded: true,
};

const video: VideoMetadata = {
  id: 'uuid-1',
  youtubeId: 'aaa',
  title: 'A collected upload',
  description: '',
  tags: [],
  channelId: 'UC_test_channel',
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
  sourceFlags: ['ChannelUploads'],
  indexedAt: '2023-01-01T00:00:00Z',
  lastUpdatedAt: '2023-01-01T00:00:00Z',
};

const render = (channels: ChannelMetadata[], videos: VideoMetadata[]) =>
  renderToStaticMarkup(
    React.createElement(ChannelView, {
      channels,
      videos,
      onExpandChannel: async () => {},
      onSelectVideo: () => {},
      onAddChannel: () => {},
    })
  );

test('a collected channel is listed and its videos are shown', () => {
  const html = render([channel], [video]);

  assert.match(html, /Test Channel/);
  assert.match(html, /Videos Saved from Test Channel \(1\)/);
  assert.match(html, /A collected upload/);
  assert.match(html, /Collected/, 'an expanded channel is marked as collected');
});

test('the empty state renders when no channel has been collected', () => {
  const html = render([], []);

  assert.match(html, /Channels/);
  assert.doesNotMatch(html, /Test Channel/);
});
