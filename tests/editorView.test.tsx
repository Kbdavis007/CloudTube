import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { EditorView } from '../src/components/views/EditorView';
import { ClipCard } from '../src/components/editor/ClipCard';
import { LibraryClipPicker } from '../src/components/editor/LibraryClipPicker';
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

test('the library dropdown always offers the built-in samples', () => {
  const html = renderToStaticMarkup(
    React.createElement(LibraryClipPicker, { videos: [] as never, onAdd: () => {} })
  );

  assert.match(html, /Add a clip/);
  assert.match(html, /Samples \(built in\)/);
  assert.match(html, /Sample · test pattern/);
  assert.match(html, /Sample · colour bars/);
  assert.match(html, /Sample · gradient sweep/);
});

test('the library dropdown offers editable saved videos and skips embed-only ones', () => {
  const videos = [
    {
      id: 'a',
      title: 'Editable saved clip',
      durationSeconds: 12,
      playback: { previewUrl: 'https://media.example/a.mp4' },
    },
    {
      id: 'b',
      title: 'Embed-only video',
      durationSeconds: 30,
      playback: {},
    },
  ] as never;

  const html = renderToStaticMarkup(
    React.createElement(LibraryClipPicker, { videos, onAdd: () => {} })
  );

  assert.match(html, /Your library/);
  assert.match(html, /Editable saved clip/);
  assert.match(html, /0:12\.0/, 'the saved duration is shown next to the title');
  assert.doesNotMatch(html, /Embed-only video/, 'embed-only videos are not offered');
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
