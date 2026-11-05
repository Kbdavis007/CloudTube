import test from 'node:test';
import assert from 'node:assert/strict';

import { expandChannel, type ChannelExpansionStore } from '../src/services/channelExpansion';
import type { ChannelMetadata, CrawlJob, VideoMetadata } from '../src/types';

const makeChannel = (overrides: Partial<ChannelMetadata> = {}): ChannelMetadata => ({
  channelId: 'UC_test_channel',
  title: 'Test Channel',
  description: 'A channel',
  customUrl: '@testchannel',
  publishedAt: '2020-01-01T00:00:00Z',
  thumbnail: 'https://example.com/thumb.jpg',
  subscriberCount: 1000,
  videoCount: 3,
  viewCount: 5000,
  isExpanded: false,
  ...overrides,
});

const makeVideo = (youtubeId: string): VideoMetadata =>
  ({
    id: `uuid-${youtubeId}`,
    youtubeId,
    title: `Video ${youtubeId}`,
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
    thumbnails: { default: '', medium: '', high: '' },
    sourceFlags: ['YouTubeSearch'],
    indexedAt: '2023-01-01T00:00:00Z',
    lastUpdatedAt: '2023-01-01T00:00:00Z',
  }) as VideoMetadata;

/** In-memory store recording every write, so the test can assert on them. */
function makeStore(initialChannels: ChannelMetadata[] = []) {
  const channels = new Map(initialChannels.map((c) => [c.channelId, c]));
  const savedVideos: VideoMetadata[] = [];
  const savedChannels: ChannelMetadata[] = [];
  const jobs: CrawlJob[] = [];

  const store: ChannelExpansionStore = {
    async getChannel(channelId) {
      return channels.get(channelId) ?? null;
    },
    async saveChannel(channel) {
      savedChannels.push(channel);
      channels.set(channel.channelId, channel);
    },
    async saveVideo(video) {
      savedVideos.push(video);
    },
    async addCrawlJob(job) {
      jobs.push(job);
    },
  };

  return { store, savedVideos, savedChannels, jobs };
}

test('expanding an untracked channel saves the channel so it appears on the Channels page', async () => {
  const { store, savedVideos, savedChannels } = makeStore();

  let fetchChannelCalls = 0;
  const result = await expandChannel('UC_test_channel', 'Test Channel', {
    store,
    fetchUploads: async () => [makeVideo('aaa'), makeVideo('bbb')],
    fetchChannel: async () => {
      fetchChannelCalls += 1;
      return makeChannel();
    },
    now: () => new Date('2024-05-05T12:00:00Z'),
    newId: () => 'job-1',
  });

  // The regression: the channel record must be written, not just its videos.
  assert.equal(savedChannels.length, 1, 'the channel record must be saved');
  assert.equal(savedChannels[0].channelId, 'UC_test_channel');
  assert.equal(result.channelCreated, true);
  assert.equal(result.channel?.channelId, 'UC_test_channel');

  // Expanded metadata is stamped on the saved record.
  assert.equal(savedChannels[0].isExpanded, true);
  assert.equal(savedChannels[0].expandedVideoCount, 2);
  assert.equal(savedChannels[0].lastExpandedAt, '2024-05-05T12:00:00.000Z');

  // Videos are still collected and tagged as uploads.
  assert.equal(savedVideos.length, 2);
  assert.deepEqual(savedVideos[0].sourceFlags, ['ChannelUploads', 'YouTubeSearch']);
  assert.equal(fetchChannelCalls, 1);
});

test('expanding a tracked channel updates it without re-fetching metadata', async () => {
  const existing = makeChannel({ isExpanded: false });
  const { store, savedChannels } = makeStore([existing]);

  let fetchChannelCalls = 0;
  const result = await expandChannel('UC_test_channel', 'Test Channel', {
    store,
    fetchUploads: async () => [makeVideo('aaa')],
    fetchChannel: async () => {
      fetchChannelCalls += 1;
      return makeChannel({ title: 'Fresh From API' });
    },
    now: () => new Date('2024-05-05T12:00:00Z'),
    newId: () => 'job-2',
  });

  assert.equal(fetchChannelCalls, 0, 'a tracked channel needs no API lookup');
  assert.equal(result.channelCreated, false);
  assert.equal(savedChannels.length, 1);
  assert.equal(savedChannels[0].isExpanded, true);
  assert.equal(savedChannels[0].expandedVideoCount, 1);
  assert.equal(savedChannels[0].title, 'Test Channel', 'the existing record is kept');
});

test('expanding a channel with no metadata still saves its videos', async () => {
  const { store, savedVideos, savedChannels, jobs } = makeStore();

  const result = await expandChannel('UC_unknown', 'Unknown', {
    store,
    fetchUploads: async () => [makeVideo('aaa')],
    fetchChannel: async () => null,
    newId: () => 'job-3',
  });

  assert.equal(savedVideos.length, 1);
  assert.equal(savedChannels.length, 0, 'nothing to save without a channel record');
  assert.equal(result.channelCreated, false);
  assert.equal(result.channel, null);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].type, 'channel_expansion');
  assert.equal(jobs[0].itemsFound, 1);
});
