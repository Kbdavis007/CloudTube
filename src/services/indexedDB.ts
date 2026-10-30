import {
  VideoMetadata,
  ChannelMetadata,
  VideoComment,
  CrawlJob,
  PersonalMetadata,
  VideoRemoval,
} from '../types';

const DB_NAME = 'CloudTubeDB';
// v2 adds the `removals` store (video + reason + timestamp).
const DB_VERSION = 2;

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

        // Removals Store (video dropped + why). Indexed by reason so the taste
        // profile can group without a full scan.
        if (!db.objectStoreNames.contains('removals')) {
          const removalStore = db.createObjectStore('removals', { keyPath: 'id' });
          removalStore.createIndex('youtubeId', 'youtubeId', { unique: false });
          removalStore.createIndex('reason', 'reason', { unique: false });
          removalStore.createIndex('removedAt', 'removedAt', { unique: false });
        }
      };
    });

    const db = await this.initPromise;
    return db;
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

  /**
   * Drop a video from the library and record why. Both writes share one
   * transaction so a removal can never be logged without the video leaving, or
   * vice versa.
   */
  async removeVideoWithReason(removal: VideoRemoval): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['videos', 'removals'], 'readwrite');
      tx.objectStore('videos').delete(removal.youtubeId);
      tx.objectStore('removals').put(removal);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async getRemovals(): Promise<VideoRemoval[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('removals', 'readonly');
      const req = tx.objectStore('removals').getAll();
      req.onsuccess = () => {
        const removals: VideoRemoval[] = req.result || [];
        removals.sort((a, b) => new Date(b.removedAt).getTime() - new Date(a.removedAt).getTime());
        resolve(removals);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getRemoval(removalId: string): Promise<VideoRemoval | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('removals', 'readonly');
      const req = tx.objectStore('removals').get(removalId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /** Put a removed video back and drop its removal record in one transaction. */
  async restoreRemoval(removalId: string): Promise<VideoRemoval | null> {
    const removal = await this.getRemoval(removalId);
    if (!removal) return null;

    const db = await this.init();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['videos', 'removals'], 'readwrite');
      tx.objectStore('videos').put(removal.video);
      tx.objectStore('removals').delete(removalId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return removal;
  }

  /**
   * Delete a removal record without restoring the video. Used to unlearn a
   * mistake so it stops influencing the taste profile.
   */
  async forgetRemoval(removalId: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('removals', 'readwrite');
      const req = tx.objectStore('removals').delete(removalId);
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
    const removals = await this.getRemovals();

    return JSON.stringify(
      {
        version: '1.1.0',
        exportedAt: new Date().toISOString(),
        targetRuntime: 'Cloudflare Free Tier (D1/R2/KV)',
        stats: {
          videoCount: videos.length,
          channelCount: channels.length,
          commentCount: comments.length,
          removalCount: removals.length,
        },
        data: {
          videos,
          channels,
          comments,
          crawlJobs: jobs,
          removals,
        },
      },
      null,
      2
    );
  }

  async importLibraryJson(jsonString: string): Promise<{ importedVideos: number; importedChannels: number }> {
    const parsed = JSON.parse(jsonString);
    const db = await this.init();

    const tx = db.transaction(['videos', 'channels', 'comments', 'crawlJobs', 'removals'], 'readwrite');
    const videoStore = tx.objectStore('videos');
    const channelStore = tx.objectStore('channels');
    const commentStore = tx.objectStore('comments');
    const removalStore = tx.objectStore('removals');

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

    // Removals are what teach the taste profile, so a backup must carry them.
    if (parsed.data?.removals && Array.isArray(parsed.data.removals)) {
      parsed.data.removals.forEach((rem: VideoRemoval) => {
        removalStore.put(rem);
      });
    }

    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });

    return { importedVideos: vCount, importedChannels: cCount };
  }

  async clearDatabase(): Promise<void> {
    const db = await this.init();
    const tx = db.transaction(['videos', 'channels', 'comments', 'crawlJobs', 'removals'], 'readwrite');
    tx.objectStore('videos').clear();
    tx.objectStore('channels').clear();
    tx.objectStore('comments').clear();
    tx.objectStore('crawlJobs').clear();
    tx.objectStore('removals').clear();
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  }
}

export const idbService = new IndexedDBService();
