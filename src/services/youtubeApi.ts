/**
 * Live YouTube Data API v3 Client
 * Uses the authenticated Google OAuth Bearer access token to fetch
 * personal channel info, playlists, uploads, live searches, and comments.
 */

import { VideoMetadata, ChannelMetadata, VideoComment } from '../types';

export class YouTubeApiClient {
  private static BASE_URL = 'https://www.googleapis.com/youtube/v3';

  // 1. Fetch authenticated user's own YouTube channel
  static async getMyChannel(accessToken: string): Promise<ChannelMetadata | null> {
    const res = await fetch(
      `${this.BASE_URL}/channels?part=snippet,contentDetails,statistics&mine=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `YouTube API returned status ${res.status}`);
    }

    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    return {
      channelId: item.id,
      title: item.snippet.title,
      description: item.snippet.description || 'Your authenticated YouTube channel',
      customUrl: item.snippet.customUrl || `@${item.snippet.title.replace(/\s+/g, '').toLowerCase()}`,
      publishedAt: item.snippet.publishedAt,
      thumbnail:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        '',
      subscriberCount: parseInt(item.statistics.subscriberCount || '0', 10),
      videoCount: parseInt(item.statistics.videoCount || '0', 10),
      viewCount: parseInt(item.statistics.viewCount || '0', 10),
      isExpanded: false,
    };
  }

  // 2. Fetch authenticated user's playlists
  static async getMyPlaylists(accessToken: string): Promise<any[]> {
    const res = await fetch(
      `${this.BASE_URL}/playlists?part=snippet,contentDetails&mine=true&maxResults=25`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to fetch playlists');
    }

    const data = await res.json();
    return data.items || [];
  }

  // 3. Live search on YouTube Data API
  static async searchVideos(accessToken: string, query: string): Promise<VideoMetadata[]> {
    // Search for video IDs
    const searchRes = await fetch(
      `${this.BASE_URL}/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'YouTube search request failed');
    }

    const searchData = await searchRes.json();
    const videoIds = (searchData.items || [])
      .map((item: any) => item.id?.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) return [];

    // Fetch full statistics & duration
    return this.getVideoDetails(accessToken, videoIds);
  }

  // 4. Fetch detailed video statistics (views, likes, comments, duration)
  static async getVideoDetails(accessToken: string, videoIds: string[]): Promise<VideoMetadata[]> {
    const detailsRes = await fetch(
      `${this.BASE_URL}/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!detailsRes.ok) {
      const err = await detailsRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to fetch video details');
    }

    const detailsData = await detailsRes.json();

    return (detailsData.items || []).map((item: any) => {
      const durationIso = item.contentDetails?.duration || 'PT10M';
      const durationSeconds = parseIsoDuration(durationIso);

      return {
        id: crypto.randomUUID(),
        youtubeId: item.id,
        title: item.snippet.title,
        description: item.snippet.description || '',
        tags: item.snippet.tags || [],
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        duration: durationIso,
        durationSeconds,
        viewCount: parseInt(item.statistics?.viewCount || '0', 10),
        likeCount: parseInt(item.statistics?.likeCount || '0', 10),
        commentCount: parseInt(item.statistics?.commentCount || '0', 10),
        thumbnails: {
          default: item.snippet.thumbnails?.default?.url || '',
          medium: item.snippet.thumbnails?.medium?.url || '',
          high: item.snippet.thumbnails?.high?.url || '',
          maxres: item.snippet.thumbnails?.maxres?.url,
        },
        sourceFlags: ['YouTubeSearch', 'Google'],
        indexedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        personal: {
          videoId: item.id,
          indexScore: calculateInitialIndexScore(
            parseInt(item.statistics?.viewCount || '0', 10),
            parseInt(item.statistics?.likeCount || '0', 10)
          ),
          userRating: 85,
          userNotes: '',
          userTags: ['YouTube-Imported'],
        },
      };
    });
  }

  // 5. Fetch a channel by its ID with real statistics
  static async getChannelById(accessToken: string, channelId: string): Promise<ChannelMetadata | null> {
    const res = await fetch(
      `${this.BASE_URL}/channels?part=snippet,statistics,contentDetails&id=${encodeURIComponent(channelId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `YouTube API returned status ${res.status}`);
    }

    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    return {
      channelId: item.id,
      title: item.snippet.title,
      description: item.snippet.description || '',
      customUrl: item.snippet.customUrl || `@${item.snippet.title.replace(/\s+/g, '').toLowerCase()}`,
      publishedAt: item.snippet.publishedAt,
      thumbnail:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        '',
      subscriberCount: parseInt(item.statistics?.subscriberCount || '0', 10),
      videoCount: parseInt(item.statistics?.videoCount || '0', 10),
      viewCount: parseInt(item.statistics?.viewCount || '0', 10),
      isExpanded: false,
    };
  }

  // 6. Resolve a channel handle (e.g. "@fireship") to a real channel
  static async getChannelByHandle(accessToken: string, handle: string): Promise<ChannelMetadata | null> {
    const res = await fetch(
      `${this.BASE_URL}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(handle)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to resolve channel handle');
    }

    const data = await res.json();
    const channelId = data.items?.[0]?.id?.channelId;
    if (!channelId) return null;
    return this.getChannelById(accessToken, channelId);
  }

  // 7. Fetch all uploads for a channel via its uploads playlist
  static async getChannelUploads(accessToken: string, channelId: string): Promise<VideoMetadata[]> {
    const channelRes = await fetch(
      `${this.BASE_URL}/channels?part=contentDetails&id=${encodeURIComponent(channelId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!channelRes.ok) {
      const err = await channelRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to resolve channel uploads playlist');
    }

    const channelData = await channelRes.json();
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return [];

    const playlistRes = await fetch(
      `${this.BASE_URL}/playlistItems?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(uploadsPlaylistId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!playlistRes.ok) {
      const err = await playlistRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to fetch channel uploads');
    }

    const playlistData = await playlistRes.json();
    const videoIds = (playlistData.items || [])
      .map((item: any) => item.contentDetails?.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) return [];
    return this.getVideoDetails(accessToken, videoIds);
  }

  // 8. Fetch comments for a specific video
  static async getVideoComments(accessToken: string, videoId: string): Promise<VideoComment[]> {
    const res = await fetch(
      `${this.BASE_URL}/commentThreads?part=snippet&videoId=${videoId}&maxResults=20&order=relevance`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to harvest comments');
    }

    const data = await res.json();
    return (data.items || []).map((item: any) => {
      const topComment = item.snippet?.topLevelComment?.snippet;
      return {
        id: item.id,
        videoId,
        authorName: topComment?.authorDisplayName || 'Anonymous User',
        authorChannelId: topComment?.authorChannelId?.value || 'unknown',
        authorAvatar: topComment?.authorProfileImageUrl || '',
        text: topComment?.textDisplay || '',
        likes: topComment?.likeCount || 0,
        publishedAt: topComment?.publishedAt || new Date().toISOString(),
        sentiment: topComment?.likeCount > 20 ? 'positive' : 'neutral',
      };
    });
  }
}

function parseIsoDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 300;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function calculateInitialIndexScore(views: number, likes: number): number {
  if (views === 0) return 50;
  const ratio = (likes / views) * 100;
  if (ratio > 5) return 10;
  if (ratio > 3) return 20;
  if (ratio > 1) return 35;
  return 55;
}
