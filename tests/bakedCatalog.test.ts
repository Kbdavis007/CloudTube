import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATALOG_SOURCES,
  catalogSourceById,
  catalogToVideoMetadata,
  loadBakedCatalog,
} from '../src/services/vegaApi';

const catalog = loadBakedCatalog();

test('the baked catalogue carries every wired source', () => {
  const ids = CATALOG_SOURCES.map((s) => s.id);
  assert.ok(ids.includes('vega'), 'vega source is registered');
  assert.ok(ids.includes('xgroovy'), 'xgroovy source is registered');
  for (const source of CATALOG_SOURCES) {
    assert.ok(source.name.length > 0, `${source.id} has a display name`);
    assert.ok(source.flag.length > 0, `${source.id} has a SourceFlag`);
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
