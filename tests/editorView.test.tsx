import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { EditorView } from '../src/components/views/EditorView';
import { ClipCard } from '../src/components/editor/ClipCard';
import type { EditorClip } from '../src/services/videoEditor';

const clip: EditorClip = {
  id: 'clip-1',
  file: new Blob(),
  name: 'first.webm',
  duration: 8,
  width: 1280,
  height: 720,
  trimStart: 1,
  trimEnd: 4,
  hasAudio: true,
  videoCodec: 'vp8',
  audioCodec: 'opus',
};

test('the editor starts empty with the local-file guidance', () => {
  const html = renderToStaticMarkup(React.createElement(EditorView));

  assert.match(html, /Video Editor/);
  assert.match(html, /Add clips/);
  assert.match(html, /Add local video clips to start an edit/);
  assert.match(html, /cannot be read by the page/);
});

test('a clip card shows its resolution, source length and kept span', () => {
  const html = renderToStaticMarkup(
    React.createElement(ClipCard, {
      clip,
      index: 0,
      total: 1,
      onTrimStart: () => {},
      onTrimEnd: () => {},
      onRemove: () => {},
      onMove: () => {},
      onDragStart: () => {},
      onDragOver: () => {},
      onDrop: () => {},
      isDragging: false,
    })
  );

  assert.match(html, /first\.webm/);
  assert.match(html, /1280×720/);
  assert.match(html, /keeps/);
  assert.match(html, /0:03\.0/, 'the trimmed span (4 - 1 = 3s) is shown');
  assert.match(html, /Trim in point/);
  assert.match(html, /Trim out point/);
});
