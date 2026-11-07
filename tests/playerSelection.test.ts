import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePlayerSelection } from '../src/services/playerSelection';
import type { VideoMetadata } from '../src/types';

const makeVideo = (youtubeId: string, title = `Video ${youtubeId}`): VideoMetadata =>
  ({
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
    thumbnails: { default: '', medium: '', high: '' },
    sourceFlags: ['YouTubeSearch'],
    indexedAt: '2023-01-01T00:00:00Z',
    lastUpdatedAt: '2023-01-01T00:00:00Z',
  }) as VideoMetadata;

test('a video in the library plays from the library', () => {
  const saved = makeVideo('saved');
  const selection = resolvePlayerSelection([saved], 'saved', null);

  assert.equal(selection.video, saved);
  assert.equal(selection.isInLibrary, true);
});

test('watching a video that is not in the library does not report it as saved', () => {
  // The watched video is held transiently, never added to the library list.
  const watched = makeVideo('result');
  const selection = resolvePlayerSelection([], 'result', watched);

  assert.equal(selection.video, watched);
  assert.equal(selection.isInLibrary, false, 'watching must not count as saving');
});

test('a video only becomes part of the library once it is saved', () => {
  const watched = makeVideo('result');

  const beforeSave = resolvePlayerSelection([], 'result', watched);
  assert.equal(beforeSave.isInLibrary, false);

  // Saving adds it to the library list; the same selection now resolves to it.
  const afterSave = resolvePlayerSelection([watched], 'result', null);
  assert.equal(afterSave.isInLibrary, true);
  assert.equal(afterSave.video, watched);
});

test('nothing selected resolves to no video', () => {
  const selection = resolvePlayerSelection([makeVideo('a')], '', null);

  assert.equal(selection.video, null);
  assert.equal(selection.isInLibrary, false);
});

test('a transient video is ignored once another video is selected', () => {
  const watched = makeVideo('result');
  const selection = resolvePlayerSelection([], 'something-else', watched);

  assert.equal(selection.video, null);
  assert.equal(selection.isInLibrary, false);
});

test('a video reached through the queue resolves while it is unsaved', () => {
  // Prev/next moves through the queue; the target was never held transiently,
  // so it is resolved from the queue instead of dropping the player to null.
  const first = makeVideo('first');
  const second = makeVideo('second');

  const selection = resolvePlayerSelection([], 'second', first, [first, second]);

  assert.equal(selection.video, second);
  assert.equal(selection.isInLibrary, false, 'a queued video is still not saved');
});

test('a saved video wins over the queue and reports as in the library', () => {
  const saved = makeVideo('saved');
  const selection = resolvePlayerSelection([saved], 'saved', null, [makeVideo('other')]);

  assert.equal(selection.video, saved);
  assert.equal(selection.isInLibrary, true);
});
