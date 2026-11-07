import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SearchResultCard } from '../src/components/SearchResultCard';
import type { TasteAssessment, VideoMetadata } from '../src/types';

const makeVideo = (overrides: Partial<VideoMetadata> = {}): VideoMetadata => ({
  id: 'uuid-1',
  youtubeId: 'aaa',
  title: 'A search result',
  description: 'A description',
  tags: [],
  channelId: 'UC_test',
  channelTitle: 'Test Channel',
  publishedAt: '2023-01-01T00:00:00Z',
  duration: 'PT5M',
  durationSeconds: 300,
  viewCount: 1234,
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
  ...overrides,
});

const noAssessment: TasteAssessment = { penalty: 0, muted: false, signals: [] };

const render = (video: VideoMetadata, assessment: TasteAssessment = noAssessment) =>
  renderToStaticMarkup(
    React.createElement(SearchResultCard, {
      video,
      assessment,
      adjustedScore: 42,
      isIndexed: false,
      resultQueue: [video],
      queueLabel: 'Search results',
      onIndexVideo: () => {},
      onPlayVideo: () => {},
      onExpandChannel: () => {},
    })
  );

test('a search result card renders its title, source badge and actions', () => {
  const html = render(makeVideo());

  assert.match(html, /A search result/);
  assert.match(html, /Search/);
  assert.match(html, /Score: 42/);
  assert.match(html, /data-testid="search-result-card"/);
});

test('the card plays in place: a play control is offered and no player is mounted until pressed', () => {
  const html = render(makeVideo());

  // The play overlay exists, but the iframe is not mounted until the user plays.
  assert.match(html, /Play A search result in this card/);
  assert.doesNotMatch(html, /data-testid="search-inline-player"/);
});

test('an open-source result offers Play rather than Collect Channel', () => {
  const html = render(
    makeVideo({
      sourceFlags: ['Vega'],
      playback: { embedUrl: 'https://source.test/embed/1', externalUrl: 'https://source.test/watch/1' },
    })
  );

  assert.match(html, />Play</);
  assert.doesNotMatch(html, /Collect Channel/);
});

test('a demoted result shows the taste penalty it carries', () => {
  const html = render(makeVideo(), {
    penalty: 30,
    muted: false,
    signals: [{ kind: 'tag', label: 'clickbait', penalty: 30 }],
  });

  assert.match(html, /Demoted by your removals/);
  assert.match(html, /clickbait/);
});
