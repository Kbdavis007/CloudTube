import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { VegaSourceView } from '../src/components/views/VegaSourceView';
import { loadBakedCatalog } from '../src/services/vegaApi';

const render = () =>
  renderToStaticMarkup(
    React.createElement(VegaSourceView, {
      onIndexVideo: () => {},
      onPlayVideo: () => {},
      indexedVideoIds: new Set<string>(),
    })
  );

test('the catalogue view offers the same search, filter and sort controls as the library', () => {
  const html = render();

  assert.match(html, /video-filter-bar/);
  assert.match(html, /video-filter-search/);
  assert.match(html, /video-filter-source/);
  assert.match(html, /video-filter-sort/);
  assert.match(html, /Filter &amp; sort/);
  // The catalogue search still reaches fields outside the common video model.
  assert.match(html, /actors, category/);
});

test('the catalogue is paginated rather than dumped in one list', () => {
  const total = loadBakedCatalog().length;
  assert.ok(total > 24, 'the baked catalogue has more than one page of videos');

  const html = render();
  assert.match(html, /video-pagination/);
  assert.match(html, /Page /);
});
