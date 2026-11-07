import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SearchView } from '../src/components/views/SearchView';
import type { TasteProfile } from '../src/types';

const tasteProfile: TasteProfile = {
  totalRemovals: 0,
  reasonCounts: {} as TasteProfile['reasonCounts'],
  channelPenalties: [],
  tagPenalties: [],
  mutedChannelIds: [],
};

const render = () =>
  renderToStaticMarkup(
    React.createElement(SearchView, {
      onIndexVideo: () => {},
      onExpandChannel: () => {},
      onPlayVideo: () => {},
      indexedVideoIds: new Set<string>(),
      accessToken: null,
      userEmail: null,
      tasteProfile,
    })
  );

test('search does not offer its own source toggles — Settings is the one place', () => {
  const html = render();

  // The old per-search "Also search:" chip row is gone.
  assert.doesNotMatch(html, /Also search:/);
  // The page still tells the user which sources it will use, and where to change them.
  assert.match(html, /enabled in Settings/);
  assert.match(html, /Settings → Search Sources/);
});
