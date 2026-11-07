import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EditorError,
  assembleTimeline,
  clampTrimEnd,
  clampTrimStart,
  formatTime,
  readClip,
  timelineDuration,
  trimmedDuration,
  type EditorClip,
} from '../src/services/videoEditor';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureBuffer = readFileSync(resolve(here, 'fixtures/sample.webm'));
const sampleClip = (): Blob => new Blob([fixtureBuffer], { type: 'video/webm' });

const clip = (trimStart: number, trimEnd: number): EditorClip => ({
  id: 'x',
  file: sampleClip(),
  name: 'clip',
  duration: 10,
  width: 160,
  height: 120,
  trimStart,
  trimEnd,
  hasAudio: true,
  videoCodec: 'vp8',
  audioCodec: 'opus',
});

test('a clip contributes only its trimmed span', () => {
  assert.equal(trimmedDuration({ trimStart: 2, trimEnd: 5 }), 3);
  assert.equal(trimmedDuration({ trimStart: 5, trimEnd: 2 }), 0);
});

test('the timeline duration is the sum of the trimmed spans', () => {
  // Two clips: [1,4] -> 3s and [2,6] -> 4s; the untrimmed length is irrelevant.
  assert.equal(timelineDuration([clip(1, 4), clip(2, 6)]), 7);
  assert.equal(timelineDuration([]), 0);
});

test('the in point cannot reach or pass the out point', () => {
  // Dragging the in point to/past the out point stops short of crossing it.
  assert.equal(clampTrimStart(6, 5, 10), 4.99);
  assert.ok(clampTrimStart(6, 5, 10) < 5);
  // A valid in point is left alone.
  assert.equal(clampTrimStart(2, 5, 10), 2);
  // The in point cannot go before the start of the clip.
  assert.equal(clampTrimStart(-3, 5, 10), 0);
});

test('the out point cannot reach or pass the in point, nor exceed the clip', () => {
  assert.equal(clampTrimEnd(3, 4, 10), 4.01);
  assert.ok(clampTrimEnd(3, 4, 10) > 4);
  assert.equal(clampTrimEnd(20, 4, 10), 10);
  assert.equal(clampTrimEnd(6, 2, 10), 6);
});

test('times are formatted as minutes and tenths of a second', () => {
  assert.equal(formatTime(0), '0:00.0');
  assert.equal(formatTime(5.25), '0:05.3');
  assert.equal(formatTime(65.2), '1:05.2');
  assert.equal(formatTime(-1), '0:00.0');
});

test('a playable local file becomes a clip with its duration and resolution', async () => {
  const added = await readClip(sampleClip(), 'sample.webm');

  assert.equal(added.name, 'sample.webm');
  assert.ok(added.duration > 1.9 && added.duration < 2.2, `duration was ${added.duration}`);
  assert.equal(added.width, 160);
  assert.equal(added.height, 120);
  assert.equal(added.hasAudio, true);
  // A fresh clip starts fully selected.
  assert.equal(added.trimStart, 0);
  assert.equal(added.trimEnd, added.duration);
});

test('a file the browser cannot read is rejected with a named error and no clip', async () => {
  const notMedia = new Blob([new TextEncoder().encode('this is not a media file')], { type: 'text/plain' });

  await assert.rejects(
    () => readClip(notMedia, 'notes.txt'),
    (error: unknown) => {
      assert.ok(error instanceof EditorError);
      assert.equal(error.code, 'unsupported');
      assert.match(error.message, /notes\.txt/);
      return true;
    }
  );
});

test('an empty timeline is refused before any encoding is attempted', async () => {
  await assert.rejects(
    () => assembleTimeline([]),
    (error: unknown) => {
      assert.ok(error instanceof EditorError);
      assert.equal(error.code, 'empty-timeline');
      return true;
    }
  );
});

test('a clip trimmed to nothing is refused', async () => {
  await assert.rejects(
    () => assembleTimeline([clip(3, 3)]),
    (error: unknown) => {
      assert.ok(error instanceof EditorError);
      assert.equal(error.code, 'empty-timeline');
      return true;
    }
  );
});
