import React, { useState } from 'react';
import { ChannelMetadata, VideoMetadata } from '../../types';
import { YouTubeApiClient } from '../../services/youtubeApi';
import {
  Tv,
  Play,
  Users,
  Video,
  Eye,
  CheckCircle2,
  Loader2,
  Sparkles,
  ExternalLink,
  Plus,
} from 'lucide-react';

interface ChannelViewProps {
  channels: ChannelMetadata[];
  videos: VideoMetadata[];
  onExpandChannel: (channelId: string, channelTitle: string) => Promise<void>;
  onSelectVideo: (youtubeId: string) => void;
  onAddChannel: (channel: ChannelMetadata) => void;
  accessToken?: string | null;
}

export const ChannelView: React.FC<ChannelViewProps> = ({
  channels,
  videos,
  onExpandChannel,
  onSelectVideo,
  onAddChannel,
  accessToken,
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    channels[0]?.channelId || ''
  );
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionProgress, setExpansionProgress] = useState<{
    pct: number;
    currentCount: number;
    totalExpected: number;
    statusText: string;
  } | null>(null);

  // New channel modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChannelHandle, setNewChannelHandle] = useState('');
  const [addChannelError, setAddChannelError] = useState<string | null>(null);

  const selectedChannel = channels.find((c) => c.channelId === selectedChannelId) || channels[0];
  const channelVideos = videos.filter((v) => v.channelId === selectedChannelId);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  const handleTriggerExpansion = async (channel: ChannelMetadata) => {
    setIsExpanding(true);
    setExpansionProgress({
      pct: 20,
      currentCount: channelVideos.length,
      totalExpected: channel.videoCount,
      statusText: 'Contacting YouTube Data API...',
    });

    try {
      await onExpandChannel(channel.channelId, channel.title);
      setExpansionProgress({
        pct: 100,
        currentCount: channel.videoCount,
        totalExpected: channel.videoCount,
        statusText: 'Completed. All available uploads indexed.',
      });
    } catch (err: any) {
      setExpansionProgress({
        pct: 100,
        currentCount: channelVideos.length,
        totalExpected: channel.videoCount,
        statusText: `Expansion failed: ${err?.message || 'unknown error'}`,
      });
    } finally {
      setTimeout(() => {
        setIsExpanding(false);
        setExpansionProgress(null);
      }, 1200);
    }
  };

  const handleAddNewChannel = async () => {
    const input = newChannelHandle.trim();
    if (!input) return;
    if (!accessToken) {
      setAddChannelError('Sign in with Google to add channels from the live YouTube API.');
      return;
    }

    setAddChannelError(null);
    try {
      const handle = input.startsWith('@') ? input : `@${input}`;
      const realChan = input.startsWith('UC')
        ? await YouTubeApiClient.getChannelById(accessToken, input)
        : await YouTubeApiClient.getChannelByHandle(accessToken, handle);

      if (!realChan) {
        setAddChannelError(`No YouTube channel found for "${input}".`);
        return;
      }

      await onAddChannel(realChan);
      setSelectedChannelId(realChan.channelId);
      setNewChannelHandle('');
      setShowAddModal(false);
    } catch (err: any) {
      setAddChannelError(`Failed to resolve channel: ${err?.message || 'unknown error'}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Tv className="w-5 h-5 text-orange-500" />
            Channel Viewer & Deep Expander
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Expand discovered channels to retrieve ALL uploads into your personal Cloudflare D1 library.
          </p>
        </div>

        <button
          onClick={() => {
            setAddChannelError(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Channel
        </button>
      </div>

      {/* Channel Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {channels.map((chan) => {
          const isSelected = chan.channelId === selectedChannelId;
          const chanVidsCount = videos.filter((v) => v.channelId === chan.channelId).length;

          return (
            <div
              key={chan.channelId}
              onClick={() => setSelectedChannelId(chan.channelId)}
              className={`p-4 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                isSelected
                  ? 'bg-orange-950/20 border-orange-500/60 shadow-lg shadow-orange-500/5'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <img
                src={chan.thumbnail}
                alt={chan.title}
                className="w-12 h-12 rounded-xl object-cover border border-slate-700"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white truncate">{chan.title}</h3>
                  {chan.isExpanded && (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Expanded
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">{chan.customUrl || '@channel'}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                  <span>{formatNumber(chan.subscriberCount)} subs</span>
                  <span>·</span>
                  <span>{chanVidsCount} / {chan.videoCount} in library</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Channel Deep Dive Banner */}
      {selectedChannel && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={selectedChannel.thumbnail}
                alt={selectedChannel.title}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-500/40 shadow-md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{selectedChannel.title}</h2>
                  <span className="text-xs text-orange-400 font-mono">{selectedChannel.customUrl}</span>
                </div>
                <p className="text-xs text-slate-300 max-w-xl line-clamp-2 mt-1">
                  {selectedChannel.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 font-medium">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {formatNumber(selectedChannel.subscriberCount)} subscribers
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="w-3.5 h-3.5 text-slate-400" />
                    {selectedChannel.videoCount} total videos
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    {formatNumber(selectedChannel.viewCount)} channel views
                  </span>
                </div>
              </div>
            </div>

            {/* Expansion Trigger Button */}
            <div className="shrink-0">
              <button
                onClick={() => handleTriggerExpansion(selectedChannel)}
                disabled={isExpanding}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-orange-600/30 active:scale-95"
              >
                {isExpanding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Expanding Channel...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Expand ALL {selectedChannel.videoCount} Videos</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Expansion Progress Bar */}
          {expansionProgress && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-orange-500/30 space-y-2 animate-fadeIn">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-orange-300 font-mono">
                  {expansionProgress.statusText}
                </span>
                <span className="font-bold text-white font-mono">{expansionProgress.pct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
                  style={{ width: `${expansionProgress.pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Orchestrated via Cloudflare Queue + Durable Objects</span>
                <span>
                  Harvested {expansionProgress.currentCount} of {expansionProgress.totalExpected} uploads
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Videos from this Channel */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-white flex items-center justify-between">
          <span>Videos Indexed from {selectedChannel?.title} ({channelVideos.length})</span>
          <span className="text-xs text-slate-400 font-normal">Sorted by IndexScore</span>
        </h3>

        {channelVideos.length === 0 ? (
          <div className="py-12 text-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <p className="text-sm text-slate-300">No videos from this channel indexed in library yet.</p>
            <button
              onClick={() => handleTriggerExpansion(selectedChannel)}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-sm"
            >
              Trigger Channel Expansion Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channelVideos.map((video) => (
              <div
                key={video.youtubeId}
                onClick={() => onSelectVideo(video.youtubeId)}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-orange-500/50 cursor-pointer overflow-hidden transition group"
              >
                <div className="relative aspect-video w-full bg-slate-950">
                  <img
                    src={video.thumbnails.medium}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                    {video.duration.replace('PT', '').toLowerCase()}
                  </div>
                  <div className="absolute top-1 left-1 px-2 py-0.5 rounded bg-orange-600 text-white text-[10px] font-extrabold">
                    Score: {video.personal?.indexScore ?? 50}
                  </div>
                </div>

                <div className="p-3.5 space-y-1.5">
                  <h4 className="text-xs font-bold text-white line-clamp-2 group-hover:text-orange-400 transition">
                    {video.title}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>{formatNumber(video.viewCount)} views</span>
                    <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Tv className="w-4 h-4 text-orange-500" />
              Add YouTube Channel to Track
            </h3>
            <p className="text-xs text-slate-300">
              Enter a channel handle, custom URL, or channel ID to register into Cloudflare D1.
            </p>
            <input
              type="text"
              value={newChannelHandle}
              onChange={(e) => setNewChannelHandle(e.target.value)}
              placeholder="e.g. @cloudflare or @fireship"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-hidden focus:border-orange-500"
            />
            {addChannelError && (
              <p className="text-xs text-red-300">{addChannelError}</p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewChannel}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-sm"
              >
                Track Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
