import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATALOG_SOURCES,
  catalogSourceById,
  catalogToVideoMetadata,
  loadBakedCatalog,
} from '../src/services/vegaApi';
import { SOURCE_ALIASES } from '../src/data/sourceAliases';
import { sourceFlagLabel } from '../src/data/sourceLabels';

const catalog = loadBakedCatalog();

test('the baked catalogue carries every wired source', () => {
  const ids = CATALOG_SOURCES.map((s) => s.id);
  for (const id of [
    'vega',
    'xgroovy',
    'justporn',
    'hornyfap',
    'yesporn',
    'xxbrits',
    'notfans',
    'pornlib',
    'drtuber',
    'porngo',
    'youjizz',
    'anysex',
    'alotporn',
  ]) {
    assert.ok(ids.includes(id), `${id} source is registered`);
  }
  for (const source of CATALOG_SOURCES) {
    assert.ok(source.name.length > 0, `${source.id} has a display name`);
    assert.ok(source.flag.length > 0, `${source.id} has a SourceFlag`);
  }
});

test('every catalogue source is aliased and labelled', () => {
  for (const source of CATALOG_SOURCES) {
    assert.ok(
      SOURCE_ALIASES[source.flag],
      `${source.id} (${source.flag}) has a cryptic alias`
    );
    assert.equal(
      sourceFlagLabel(source.flag),
      SOURCE_ALIASES[source.flag],
      `${source.id} renders under its alias, not its real name`
    );
    // The rendered label must be a bare cryptic name, never a host or URL.
    assert.ok(
      !/[./]/.test(sourceFlagLabel(source.flag)),
      `${source.id} renders a bare alias, not a host`
    );
  }
});

test('every video names a registered source', () => {
  assert.ok(catalog.length > 0, 'catalogue is not empty');
  for (const video of catalog) {
    assert.ok(
      catalogSourceById(video.sourceId),
      `video ${video.sourceVideoId} names a known sourceId`
    );
  }
});

test('every video carries a unique page URL', () => {
  const urls = catalog.map((v) => v.pageUrl);
  assert.equal(new Set(urls).size, urls.length, 'page URLs are unique');
});

test('every video has an embed URL and a published date', () => {
  for (const video of catalog) {
    assert.ok(video.embedUrl.startsWith('http'), `${video.sourceVideoId} has an embed`);
    assert.ok(video.publishedDate.length > 0, `${video.sourceVideoId} has a date`);
    assert.ok(!Number.isNaN(Date.parse(video.publishedDate)), 'date is parseable');
  }
});

test('the catalogue is sorted newest first', () => {
  const dates = catalog.map((v) => v.publishedDate);
  for (let i = 1; i < dates.length; i += 1) {
    assert.ok(dates[i - 1] >= dates[i], `position ${i} is in date order`);
  }
});

test('a catalogue video maps onto the app video model', () => {
  const record = catalog[0];
  const video = catalogToVideoMetadata(record);
  const source = catalogSourceById(record.sourceId)!;

  assert.equal(video.sourceVideoId, record.sourceVideoId);
  assert.equal(video.youtubeId, `${record.sourceId}:${record.sourceVideoId}`);
  assert.deepEqual(video.sourceFlags, [source.flag]);
  assert.equal(video.playback?.embedUrl, record.embedUrl);
  assert.equal(video.playback?.externalUrl, record.pageUrl);
});
