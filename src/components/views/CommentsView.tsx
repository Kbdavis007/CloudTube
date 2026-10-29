import React, { useState } from 'react';
import { VideoComment, VideoMetadata } from '../../types';
import {
  MessageSquare,
  Search,
  ThumbsUp,
  Download,
  Filter,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface CommentsViewProps {
  comments: VideoComment[];
  videos: VideoMetadata[];
  onSelectVideo: (youtubeId: string) => void;
  onHarvestMore: () => void;
}

export const CommentsView: React.FC<CommentsViewProps> = ({
  comments,
  videos,
  onSelectVideo,
  onHarvestMore,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSentiment, setSelectedSentiment] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [filterVideoId, setFilterVideoId] = useState<string>('all');
  const [exportedJson, setExportedJson] = useState<string | null>(null);

  // Map of video titles by youtubeId
  const videoTitleMap = new Map(videos.map((v) => [v.youtubeId, v.title]));

  const filteredComments = comments.filter((c) => {
    const matchesSearch =
      c.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.authorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSentiment = selectedSentiment === 'all' || c.sentiment === selectedSentiment;
    const matchesVideo = filterVideoId === 'all' || c.videoId === filterVideoId;
    return matchesSearch && matchesSentiment && matchesVideo;
  });

  const handleExportR2Json = () => {
    const archivePayload = {
      archiveFormat: 'Cloudflare R2 Comments Vault v1',
      exportedAt: new Date().toISOString(),
      r2PathPrefix: 'youtube-library-media-vault/comments-archive/',
      totalComments: filteredComments.length,
      comments: filteredComments,
    };
    const blob = new Blob([JSON.stringify(archivePayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comments-r2-vault-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-orange-500" />
            Comments Viewer & Harvester
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Harvest discussions, search community insights, and backup to Cloudflare R2 storage archive.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportR2Json}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95"
            title="Download JSON schema matching R2 comments archive"
          >
            <Download className="w-4 h-4 text-orange-400" />
            <span>Export to R2 JSON</span>
          </button>
          <button
            onClick={onHarvestMore}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-sm active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Harvest Latest</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter comments by text or author..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500"
            />
          </div>

          {/* Filter by Video */}
          <div>
            <select
              value={filterVideoId}
              onChange={(e) => setFilterVideoId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-hidden focus:border-orange-500"
            >
              <option value="all">All Videos ({comments.length} comments)</option>
              {videos.map((v) => (
                <option key={v.youtubeId} value={v.youtubeId}>
                  {v.title.slice(0, 35)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sentiment Filter Pills */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Sentiment:</span>
            {(['all', 'positive', 'neutral', 'negative'] as const).map((sent) => (
              <button
                key={sent}
                onClick={() => setSelectedSentiment(sent)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  selectedSentiment === sent
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {sent}
              </button>
            ))}
          </div>

          <span className="text-slate-500 font-mono text-[11px]">
            Showing {filteredComments.length} of {comments.length}
          </span>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-3">
        {filteredComments.length === 0 ? (
          <div className="py-16 text-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
            <p className="text-sm font-semibold text-white">No comments found matching your filters.</p>
            <p className="text-xs text-slate-400">Clear your search term or select another video.</p>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const videoTitle = videoTitleMap.get(comment.videoId) || 'Referenced Video';

            return (
              <div
                key={comment.id}
                className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={comment.authorAvatar}
                      alt={comment.authorName}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{comment.authorName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ID: {comment.authorChannelId}
                        </span>
                      </div>
                      <button
                        onClick={() => onSelectVideo(comment.videoId)}
                        className="text-[11px] text-orange-400 hover:text-orange-300 truncate max-w-sm block text-left"
                      >
                        On: {videoTitle}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 self-end sm:self-auto">
                    <span className="flex items-center gap-1 font-mono font-bold text-orange-400/90">
                      <ThumbsUp className="w-3.5 h-3.5" /> {comment.likes}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(comment.publishedAt).toLocaleDateString()}
                    </span>
                    {comment.sentiment && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          comment.sentiment === 'positive'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {comment.sentiment}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pl-11 whitespace-pre-line">
                  {comment.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
