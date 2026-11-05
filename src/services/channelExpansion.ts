import type { ChannelMetadata, CrawlJob, VideoMetadata } from '../types';

/**
 * The persistence channel expansion needs. Narrowing it to these four calls
 * keeps the logic testable without a real IndexedDB.
 */
export interface ChannelExpansionStore {
  getChannel(channelId: string): Promise<ChannelMetadata | null>;
  saveChannel(channel: ChannelMetadata): Promise<void>;
  saveVideo(video: VideoMetadata): Promise<void>;
  addCrawlJob(job: CrawlJob): Promise<void>;
}

export interface ChannelExpansionDeps {
  store: ChannelExpansionStore;
  /** All uploads for a channel (YouTube: the uploads playlist). */
  fetchUploads: (channelId: string) => Promise<VideoMetadata[]>;
  /** Channel metadata, used only when the channel is not tracked yet. */
  fetchChannel: (channelId: string) => Promise<ChannelMetadata | null>;
  now?: () => Date;
  newId?: () => string;
}

export interface ChannelExpansionResult {
  /** The channel record now in the library, or null when it could not be resolved. */
  channel: ChannelMetadata | null;
  videoCount: number;
  /** True when the expansion added a channel that was not tracked before. */
  channelCreated: boolean;
}

/**
 * Collect a channel's uploads into the library and make sure the channel itself
 * is tracked, so the Channels page shows it.
 *
 * A channel seen only through a search result has no channel record yet; the
 * old flow expanded it and saved only its videos, so it never appeared under
 * Channels. Fetching the metadata and saving the record is what fixes that.
 */
export async function expandChannel(
  channelId: string,
  channelTitle: string,
  {
    store,
    fetchUploads,
    fetchChannel,
    now = () => new Date(),
    newId = () => crypto.randomUUID(),
  }: ChannelExpansionDeps
): Promise<ChannelExpansionResult> {
  const uploads = await fetchUploads(channelId);
  for (const video of uploads) {
    video.sourceFlags = ['ChannelUploads', 'YouTubeSearch'];
    await store.saveVideo(video);
  }

  const existing = await store.getChannel(channelId);
  const channel = existing ?? (await fetchChannel(channelId));
  const channelCreated = !existing && channel !== null;

  if (channel) {
    channel.isExpanded = true;
    channel.lastExpandedAt = now().toISOString();
    channel.expandedVideoCount = uploads.length;
    await store.saveChannel(channel);
  }

  const job: CrawlJob = {
    id: newId(),
    type: 'channel_expansion',
    status: 'completed',
    queryOrTarget: `${channelTitle} (${channelId})`,
    itemsFound: uploads.length,
    progressPct: 100,
    createdAt: now().toISOString(),
    completedAt: now().toISOString(),
  };
  await store.addCrawlJob(job);

  return { channel, videoCount: uploads.length, channelCreated };
}
