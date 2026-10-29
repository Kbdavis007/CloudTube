import { VideoMetadata, ChannelMetadata, VideoComment, CrawlJob, PersonalMetadata } from '../types';

const DB_NAME = 'CloudTubeDB';
const DB_VERSION = 1;

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Videos Store
        if (!db.objectStoreNames.contains('videos')) {
          const videoStore = db.createObjectStore('videos', { keyPath: 'youtubeId' });
          videoStore.createIndex('channelId', 'channelId', { unique: false });
          videoStore.createIndex('indexedAt', 'indexedAt', { unique: false });
          videoStore.createIndex('viewCount', 'viewCount', { unique: false });
        }

        // Channels Store
        if (!db.objectStoreNames.contains('channels')) {
          const channelStore = db.createObjectStore('channels', { keyPath: 'channelId' });
          channelStore.createIndex('subscriberCount', 'subscriberCount', { unique: false });
        }

        // Comments Store
        if (!db.objectStoreNames.contains('comments')) {
          const commentStore = db.createObjectStore('comments', { keyPath: 'id' });
          commentStore.createIndex('videoId', 'videoId', { unique: false });
          commentStore.createIndex('publishedAt', 'publishedAt', { unique: false });
        }

        // Crawl Jobs Store
        if (!db.objectStoreNames.contains('crawlJobs')) {
          const jobStore = db.createObjectStore('crawlJobs', { keyPath: 'id' });
          jobStore.createIndex('status', 'status', { unique: false });
          jobStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });

    const db = await this.initPromise;
    await this.seedInitialDataIfEmpty(db);
    return db;
  }

  private async seedInitialDataIfEmpty(db: IDBDatabase): Promise<void> {
    const count = await this.getVideoCount(db);
    if (count > 0) return;

    const sampleChannels: ChannelMetadata[] = [
      {
        channelId: 'UC_cloudflare_official',
        title: 'Cloudflare',
        description: 'Building a better Internet. Cloudflare Workers, Pages, D1, R2, and Zero Trust tutorials and tech talks.',
        customUrl: '@cloudflare',
        publishedAt: '2011-09-27T00:00:00Z',
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
        subscriberCount: 145000,
        videoCount: 420,
        viewCount: 18450000,
        isExpanded: true,
        lastExpandedAt: new Date().toISOString(),
        expandedVideoCount: 6,
      },
      {
        channelId: 'UC_fireship_dev',
        title: 'Fireship',
        description: 'High-intensity code tutorials and tech news to help you ship apps faster.',
        customUrl: '@fireship',
        publishedAt: '2017-06-20T00:00:00Z',
        thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=200&auto=format&fit=crop&q=80',
        subscriberCount: 3200000,
        videoCount: 650,
        viewCount: 420000000,
        isExpanded: false,
      },
      {
        channelId: 'UC_bytebytego_sys',
        title: 'ByteByteGo',
        description: 'System design interviews and architecture fundamentals visual diagrams and deep dives.',
        customUrl: '@ByteByteGo',
        publishedAt: '2022-01-10T00:00:00Z',
        thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200&auto=format&fit=crop&q=80',
        subscriberCount: 1100000,
        videoCount: 190,
        viewCount: 75000000,
        isExpanded: true,
        lastExpandedAt: new Date().toISOString(),
        expandedVideoCount: 4,
      },
    ];

    const sampleVideos: VideoMetadata[] = [
      {
        id: 'vid-001',
        youtubeId: 'kJQP7kiw5Fk', // Despacito / sample id or realistic CF talk
        title: 'Building Full-Stack Edge Apps with Cloudflare D1, Workers & R2',
        description: 'Learn how to architect stateful, low-latency applications at the edge using Cloudflare D1 (serverless SQLite), Workers KV for caching, and R2 object storage.',
        tags: ['Cloudflare', 'D1', 'Workers', 'R2', 'Edge Computing', 'TypeScript', 'Database'],
        channelId: 'UC_cloudflare_official',
        channelTitle: 'Cloudflare',
        publishedAt: '2026-03-15T14:30:00Z',
        duration: 'PT24M10S',
        durationSeconds: 1450,
        viewCount: 89400,
        likeCount: 4120,
        commentCount: 382,
        thumbnails: {
          default: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
          medium: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
          high: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1280&auto=format&fit=crop&q=80',
        },
        sourceFlags: ['YouTubeSearch', 'ChannelUploads', 'Google'],
        indexedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        aiSummary: `### Overview\nThis video delivers an end-to-end masterclass on building full-stack applications directly at Cloudflare's edge using D1 serverless SQLite for relational persistence, Workers KV for low-latency caching, and R2 object storage for media with zero egress fees.\n\n### Key Takeaways\n• **D1 Prepared Statements:** How to batch queries effectively to maximize throughput within free-tier row quotas.\n• **Cache-Aside Pattern:** Leveraging Workers KV to serve sub-millisecond responses and prevent redundant database scans.\n• **Zero Egress Architecture:** Using Cloudflare R2 as an S3 replacement to eliminate unexpected cloud transfer bills.`,
        aiSummaryGeneratedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        personal: {
          videoId: 'kJQP7kiw5Fk',
          indexScore: 4, // 1 to 100, 1=best
          userRating: 98,
          userNotes: 'Crucial reference for D1 batch statements and edge transactions. Check timestamp 12:40 for SQLite pragma optimizations.',
          userTags: ['Must-Watch', 'Cloudflare', 'D1-Architecture', 'Free-Tier-Guide'],
          isFavorite: true,
          watchProgressSeconds: 780,
          lastViewedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
      },
      {
        id: 'vid-002',
        youtubeId: 'M576WGiDBdQ',
        title: 'Cloudflare Queues & Durable Objects: Stateful Job Orchestration Explained',
        description: 'Deep dive into background job scheduling, rate limiting, and distributed state coordination using Cloudflare Durable Objects and Queues.',
        tags: ['Durable Objects', 'Queues', 'Cloudflare', 'Background Jobs', 'Concurrency'],
        channelId: 'UC_cloudflare_official',
        channelTitle: 'Cloudflare',
        publishedAt: '2026-04-02T10:15:00Z',
        duration: 'PT18M45S',
        durationSeconds: 1125,
        viewCount: 64200,
        likeCount: 3200,
        commentCount: 195,
        thumbnails: {
          default: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&auto=format&fit=crop&q=80',
          medium: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&auto=format&fit=crop&q=80',
          high: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1280&auto=format&fit=crop&q=80',
        },
        sourceFlags: ['YouTubeSearch', 'Reddit'],
        indexedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        personal: {
          videoId: 'M576WGiDBdQ',
          indexScore: 9,
          userRating: 95,
          userNotes: 'Used for designing the YouTube crawler quota limiter and orchestrator state machine.',
          userTags: ['Queues', 'Durable-Objects', 'Architecture'],
          isFavorite: true,
          watchProgressSeconds: 1125,
        },
      },
      {
        id: 'vid-003',
        youtubeId: 'bMknfKXIFA8',
        title: 'System Design 101: How YouTube Serves Billions of Videos Daily',
        description: 'Complete YouTube architectural breakdown: CDN edge caching, video transcoding pipelines, metadata database sharding, and real-time recommendation engines.',
        tags: ['YouTube Architecture', 'System Design', 'CDN', 'Video Streaming', 'Databases'],
        channelId: 'UC_bytebytego_sys',
        channelTitle: 'ByteByteGo',
        publishedAt: '2025-11-12T16:00:00Z',
        duration: 'PT15M30S',
        durationSeconds: 930,
        viewCount: 1420000,
        likeCount: 88500,
        commentCount: 2450,
        thumbnails: {
          default: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80',
          medium: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80',
          high: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1280&auto=format&fit=crop&q=80',
        },
        sourceFlags: ['YouTubeSearch', 'X', 'LinkedIn'],
        indexedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        personal: {
          videoId: 'bMknfKXIFA8',
          indexScore: 12,
          userRating: 92,
          userNotes: 'Great explanation of chunked HTTP live streaming and how Cloudflare R2 can replace S3 egress fees completely.',
          userTags: ['System-Design', 'YouTube', 'Storage'],
          isFavorite: false,
          watchProgressSeconds: 450,
        },
      },
      {
        id: 'vid-004',
        youtubeId: 'cuHDQhDhvPE',
        title: 'TypeScript in 100 Seconds + Complete Modern Edge Setup',
        description: 'A rapid overview of TypeScript features, strict mode, generics, and setting up type safety across full-stack edge runtimes.',
        tags: ['TypeScript', 'JavaScript', 'WebDev', 'Edge'],
        channelId: 'UC_fireship_dev',
        channelTitle: 'Fireship',
        publishedAt: '2025-08-19T18:00:00Z',
        duration: 'PT02M15S',
        durationSeconds: 135,
        viewCount: 890000,
        likeCount: 67000,
        commentCount: 1420,
        thumbnails: {
          default: 'https://images.unsplash.com/photo-1516116211227-bbc1552a425a?w=600&auto=format&fit=crop&q=80',
          medium: 'https://images.unsplash.com/photo-1516116211227-bbc1552a425a?w=600&auto=format&fit=crop&q=80',
          high: 'https://images.unsplash.com/photo-1516116211227-bbc1552a425a?w=1280&auto=format&fit=crop&q=80',
        },
        sourceFlags: ['YouTubeSearch', 'Playlist'],
        indexedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        personal: {
          videoId: 'cuHDQhDhvPE',
          indexScore: 18,
          userRating: 88,
          userNotes: 'Quick refresher on TS utility types: Pick, Omit, and Record for database schemas.',
          userTags: ['Quick-Tips', 'TypeScript'],
          isFavorite: false,
        },
      },
    ];

    const sampleComments: VideoComment[] = [
      {
        id: 'comm-101',
        videoId: 'kJQP7kiw5Fk',
        authorName: 'Alex Rivera (Staff Engineer)',
        authorChannelId: 'UC_alex_r',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        text: 'The zero egress fee model of R2 combined with D1 query batching makes this entire architecture essentially free for sub-100k queries. Truly revolutionary.',
        likes: 142,
        publishedAt: '2026-03-16T09:20:00Z',
        sentiment: 'positive',
      },
      {
        id: 'comm-102',
        videoId: 'kJQP7kiw5Fk',
        authorName: 'Sarah Jenkins',
        authorChannelId: 'UC_sarah_j',
        authorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
        text: 'Does D1 support foreign key cascades by default or do you need to execute PRAGMA foreign_keys = ON on each worker request?',
        likes: 58,
        publishedAt: '2026-03-16T14:45:00Z',
        sentiment: 'neutral',
      },
      {
        id: 'comm-103',
        videoId: 'M576WGiDBdQ',
        authorName: 'Marcus Vance',
        authorChannelId: 'UC_marcus_v',
        authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
        text: 'Durable Objects solving the YouTube Data API quota problem with a singleton alarm is pure genius. No redis needed!',
        likes: 89,
        publishedAt: '2026-04-03T11:10:00Z',
        sentiment: 'positive',
      },
    ];

    const sampleJobs: CrawlJob[] = [
      {
        id: 'job-init-01',
        type: 'search',
        status: 'completed',
        queryOrTarget: 'Cloudflare Workers D1 TypeScript',
        itemsFound: 24,
        progressPct: 100,
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 5 + 14000).toISOString(),
      },
      {
        id: 'job-init-02',
        type: 'channel_expansion',
        status: 'completed',
        queryOrTarget: 'UC_cloudflare_official (Cloudflare)',
        itemsFound: 420,
        progressPct: 100,
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 3 + 28000).toISOString(),
      },
    ];

    // Bulk insert initial data
    const tx = db.transaction(['channels', 'videos', 'comments', 'crawlJobs'], 'readwrite');
    sampleChannels.forEach((c) => tx.objectStore('channels').put(c));
    sampleVideos.forEach((v) => tx.objectStore('videos').put(v));
    sampleComments.forEach((comm) => tx.objectStore('comments').put(comm));
    sampleJobs.forEach((j) => tx.objectStore('crawlJobs').put(j));

    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  }

  private getVideoCount(db: IDBDatabase): Promise<number> {
    return new Promise((resolve) => {
      const tx = db.transaction('videos', 'readonly');
      const req = tx.objectStore('videos').count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  }

  // --- Video Operations ---
  async getAllVideos(): Promise<VideoMetadata[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readonly');
      const req = tx.objectStore('videos').getAll();
      req.onsuccess = () => {
        const videos: VideoMetadata[] = req.result || [];
        // Sort primarily by IndexScore (1 is highest quality)
        videos.sort((a, b) => {
          const scoreA = a.personal?.indexScore ?? 50;
          const scoreB = b.personal?.indexScore ?? 50;
          return scoreA - scoreB;
        });
        resolve(videos);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getVideo(youtubeId: string): Promise<VideoMetadata | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readonly');
      const req = tx.objectStore('videos').get(youtubeId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveVideo(video: VideoMetadata): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      const req = tx.objectStore('videos').put(video);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteVideo(youtubeId: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      const req = tx.objectStore('videos').delete(youtubeId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async updatePersonalMetadata(youtubeId: string, personal: Partial<PersonalMetadata>): Promise<VideoMetadata | null> {
    const video = await this.getVideo(youtubeId);
    if (!video) return null;

    const existingPersonal = video.personal || {
      videoId: youtubeId,
      indexScore: 50,
      userRating: 70,
      userNotes: '',
      userTags: [],
    };

    video.personal = {
      ...existingPersonal,
      ...personal,
    };
    video.lastUpdatedAt = new Date().toISOString();

    await this.saveVideo(video);
    return video;
  }

  async updateVideoAiSummary(youtubeId: string, aiSummary: string): Promise<VideoMetadata | null> {
    const video = await this.getVideo(youtubeId);
    if (!video) return null;

    video.aiSummary = aiSummary;
    video.aiSummaryGeneratedAt = new Date().toISOString();
    video.lastUpdatedAt = new Date().toISOString();

    await this.saveVideo(video);
    return video;
  }

  // --- Channel Operations ---
  async getAllChannels(): Promise<ChannelMetadata[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('channels', 'readonly');
      const req = tx.objectStore('channels').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveChannel(channel: ChannelMetadata): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('channels', 'readwrite');
      const req = tx.objectStore('channels').put(channel);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Comments Operations ---
  async getCommentsByVideo(videoId: string): Promise<VideoComment[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('comments', 'readonly');
      const store = tx.objectStore('comments');
      const index = store.index('videoId');
      const req = index.getAll(videoId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllComments(): Promise<VideoComment[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('comments', 'readonly');
      const req = tx.objectStore('comments').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveComment(comment: VideoComment): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('comments', 'readwrite');
      const req = tx.objectStore('comments').put(comment);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Crawl Jobs ---
  async getCrawlJobs(): Promise<CrawlJob[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('crawlJobs', 'readonly');
      const req = tx.objectStore('crawlJobs').getAll();
      req.onsuccess = () => {
        const jobs: CrawlJob[] = req.result || [];
        jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(jobs);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async addCrawlJob(job: CrawlJob): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('crawlJobs', 'readwrite');
      const req = tx.objectStore('crawlJobs').put(job);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async updateCrawlJob(job: CrawlJob): Promise<void> {
    return this.addCrawlJob(job);
  }

  // --- Backup / Export / Import ---
  async exportLibraryJson(): Promise<string> {
    const videos = await this.getAllVideos();
    const channels = await this.getAllChannels();
    const comments = await this.getAllComments();
    const jobs = await this.getCrawlJobs();

    return JSON.stringify(
      {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        targetRuntime: 'Cloudflare Free Tier (D1/R2/KV)',
        stats: {
          videoCount: videos.length,
          channelCount: channels.length,
          commentCount: comments.length,
        },
        data: {
          videos,
          channels,
          comments,
          crawlJobs: jobs,
        },
      },
      null,
      2
    );
  }

  async importLibraryJson(jsonString: string): Promise<{ importedVideos: number; importedChannels: number }> {
    const parsed = JSON.parse(jsonString);
    const db = await this.init();

    const tx = db.transaction(['videos', 'channels', 'comments', 'crawlJobs'], 'readwrite');
    const videoStore = tx.objectStore('videos');
    const channelStore = tx.objectStore('channels');
    const commentStore = tx.objectStore('comments');

    let vCount = 0;
    let cCount = 0;

    if (parsed.data?.videos && Array.isArray(parsed.data.videos)) {
      parsed.data.videos.forEach((v: VideoMetadata) => {
        videoStore.put(v);
        vCount++;
      });
    }

    if (parsed.data?.channels && Array.isArray(parsed.data.channels)) {
      parsed.data.channels.forEach((c: ChannelMetadata) => {
        channelStore.put(c);
        cCount++;
      });
    }

    if (parsed.data?.comments && Array.isArray(parsed.data.comments)) {
      parsed.data.comments.forEach((comm: VideoComment) => {
        commentStore.put(comm);
      });
    }

    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });

    return { importedVideos: vCount, importedChannels: cCount };
  }

  async clearDatabase(): Promise<void> {
    const db = await this.init();
    const tx = db.transaction(['videos', 'channels', 'comments', 'crawlJobs'], 'readwrite');
    tx.objectStore('videos').clear();
    tx.objectStore('channels').clear();
    tx.objectStore('comments').clear();
    tx.objectStore('crawlJobs').clear();
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  }
}

export const idbService = new IndexedDBService();
