import React, { useState } from 'react';
import { SCAFFOLDING_FILES } from '../../data/scaffoldingCode';
import { ScaffoldFile } from '../../types';
import {
  Layers,
  FileCode,
  Copy,
  Check,
  Download,
  Search,
  ExternalLink,
  Server,
  Database,
  Cpu,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  FolderTree,
  GitBranch,
} from 'lucide-react';

export const ScaffoldingExplorerView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<ScaffoldFile>(SCAFFOLDING_FILES[0]);
  const [activeTab, setActiveTab] = useState<'code' | 'architecture' | 'tree'>('architecture');
  const [copied, setCopied] = useState(false);
  const [fileSearch, setFileSearch] = useState('');

  const filteredFiles = SCAFFOLDING_FILES.filter((f) =>
    f.path.toLowerCase().includes(fileSearch.toLowerCase()) ||
    f.description.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleFile = (file: ScaffoldFile) => {
    const blob = new Blob([file.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() || 'scaffold-file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllBundle = () => {
    const bundlePayload = {
      project: 'CloudTube Studio - Full Cloudflare Scaffolding',
      runtime: 'Cloudflare Free Tier (Workers, D1, R2, KV, Queues, Durable Objects, Pages PWA)',
      generatedAt: new Date().toISOString(),
      fileCount: SCAFFOLDING_FILES.length,
      files: SCAFFOLDING_FILES.map((f) => ({
        path: f.path,
        category: f.category,
        description: f.description,
        content: f.code,
      })),
    };
    const blob = new Blob([JSON.stringify(bundlePayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudtube-cloudflare-scaffolding-bundle.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-500" />
            System Architecture & Production Scaffolding
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Complete code scaffolding, database schemas, Durable Objects, queue consumers, and provider abstractions.
          </p>
        </div>

        <button
          onClick={handleDownloadAllBundle}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-sm active:scale-95"
        >
          <Download className="w-4 h-4" /> Download Complete Scaffolding Bundle
        </button>
      </div>

      {/* View Switcher: Architecture Diagram vs Code Scaffolding vs Folder Tree */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/60 border border-slate-800">
        <button
          onClick={() => setActiveTab('architecture')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'architecture'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <GitBranch className="w-4 h-4" /> Full System Architecture Diagram
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'code'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-4 h-4" /> Code Scaffolding Explorer ({SCAFFOLDING_FILES.length} Files)
        </button>
        <button
          onClick={() => setActiveTab('tree')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'tree'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FolderTree className="w-4 h-4" /> Folder Structure
        </button>
      </div>

      {/* TAB 1: SYSTEM ARCHITECTURE DIAGRAM */}
      {activeTab === 'architecture' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-2xl">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-orange-500" />
                Cloudflare Free-Tier Native Architecture Topology
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Zero-server, edge-native microservices topology running 100% within Cloudflare's free limits.
              </p>
            </div>

            {/* Visual Topology Diagram */}
            <div className="p-4 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-6">
              {/* Row 1: Client Layer */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Client & Edge Presentation Layer (Hosted on Cloudflare Pages)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-orange-500/30 space-y-1">
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>React 18 / 19 PWA</span>
                      <span className="text-[10px] text-orange-400 font-mono">PAGES FREE</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Static assets served with unlimited bandwidth and 0 egress fees worldwide.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-1">
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>Service Worker & Cache API</span>
                      <span className="text-[10px] text-emerald-400 font-mono">OFFLINE</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Stale-while-revalidate strategy for UI, thumbnails, and fallback API mock.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/30 space-y-1">
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>Browser IndexedDB</span>
                      <span className="text-[10px] text-blue-400 font-mono">LOCAL DB</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Full video metadata, ratings, comments, and background sync queue on-device.
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="text-center text-slate-400 text-xs font-mono">
                ↓ Cloudflare Zero Trust (Access JWT Assertion) & Global Edge Routing ↓
              </div>

              {/* Row 2: Compute & Logic Layer */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Compute & Stateful Orchestration Layer
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-orange-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Cloudflare Workers API Gateway</span>
                      <span className="text-[10px] text-orange-400 font-mono">100k req/day free</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      REST router (<code className="text-orange-300">/api/videos</code>, <code className="text-orange-300">/api/search</code>, <code className="text-orange-300">/api/channels</code>) with sub-10ms global edge latency.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-purple-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Durable Objects (DO)</span>
                      <span className="text-[10px] text-purple-400 font-mono">Stateful Singleton</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      <strong className="text-purple-300">QuotaManagerDO</strong>: 10,000 daily YouTube API units rate limiter + <strong className="text-purple-300">CrawlOrchestratorDO</strong> channel pagination coordinator.
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="text-center text-slate-400 text-xs font-mono">
                ↓ Cloudflare Queues Message Bus (youtube-crawler-queue) ↓
              </div>

              {/* Row 3: Storage, Database & Cache Layer */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Data Persistence & Edge Storage Layer
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                        Cloudflare D1 (SQLite)
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">5M reads/day</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Videos, channels, comments, personal metadata, and full-text search indexes.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-orange-500/30 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-orange-400" />
                        Cloudflare R2 Storage
                      </span>
                      <span className="text-[10px] text-orange-400 font-mono">10 GB Free</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      $0 egress media vault for thumbnails, transcripts, comments archive, and backups.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/30 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        Cloudflare KV Cache
                      </span>
                      <span className="text-[10px] text-blue-400 font-mono">100k reads/day</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Sub-millisecond cache-aside for fast video metadata and quota snapshots.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CODE SCAFFOLDING EXPLORER */}
      {activeTab === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File List (4 Cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                placeholder="Search scaffolding files..."
                className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredFiles.map((file) => {
                const isSelected = selectedFile.path === file.path;
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      isSelected
                        ? 'bg-orange-500/15 border-orange-500/50 text-white'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono font-bold truncate">{file.path}</div>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {file.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1 mt-1">{file.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Code Viewer (8 Cols) */}
          <div className="lg:col-span-8 space-y-3">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono font-bold text-orange-400">{selectedFile.path}</div>
                <div className="text-[11px] text-slate-400">{selectedFile.description}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>

                <button
                  onClick={() => handleDownloadSingleFile(selectedFile)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition active:scale-95 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Code Block with Syntax Style */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#090d16]">
              <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>{selectedFile.language.toUpperCase()} · {selectedFile.code.split('\n').length} lines</span>
                <span className="text-[10px] text-emerald-400 font-semibold">100% Free-Tier Compatible</span>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[550px] selection:bg-orange-500/30">
                {selectedFile.code}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FOLDER STRUCTURE */}
      {activeTab === 'tree' && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-orange-500" />
              Complete Project Folder Structure
            </h2>
            <span className="text-xs text-slate-400">Production Monorepo / Scaffolding layout</span>
          </div>

          <pre className="p-5 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-orange-200 leading-loose overflow-x-auto">
{`cloudtube/
├── wrangler.toml                           # Cloudflare Worker configuration & Free Tier bindings
├── package.json                            # TypeScript, Cloudflare Workers & React dependencies
├── tsconfig.json                           # Strict TS configuration
├── db/
│   ├── schema.sql                          # Cloudflare D1 SQLite tables, views, triggers & FTS5
│   └── migrations/                         # D1 schema versioned migrations
├── storage/
│   └── r2-spec.md                          # Cloudflare R2 object hierarchy and presigned S3 specs
├── cache/
│   └── kv-spec.md                          # Cloudflare KV cache namespaces, TTLs and key conventions
├── scripts/
│   └── setup-cloudflare.ts                 # Automated 5-minute setup wizard CLI script
├── src/
│   ├── worker/
│   │   ├── index.ts                        # Main Cloudflare Worker API gateway & router
│   │   ├── types.ts                        # Cloudflare Env & Bindings definitions
│   │   ├── durable-objects/
│   │   │   ├── QuotaManagerDO.ts           # Stateful YouTube API 10,000 quota rate limiter
│   │   │   └── CrawlOrchestratorDO.ts      # Multi-page channel crawler state machine
│   │   └── queues/
│   │       └── crawlerQueue.ts             # Cloudflare Queue consumer for background jobs
│   ├── providers/                          # Provider Abstraction Layer (Swappable for AWS/GCP/Azure)
│   │   ├── types.ts                        # IStorageProvider, IDatabaseProvider, IQueueProvider, etc.
│   │   ├── cloudflare/                     # Cloudflare R2, D1, KV, Queues implementation
│   │   ├── aws/                            # AWS S3, DynamoDB, SQS, ElastiCache stubs
│   │   ├── gcp/                            # GCP Storage, Cloud SQL, Pub/Sub, Memorystore stubs
│   │   └── azure/                          # Azure Blob, Cosmos, Service Bus, Redis stubs
│   └── frontend/                           # React 18/19 PWA (Hosted on Cloudflare Pages)
│       ├── public/
│       │   ├── manifest.webmanifest        # PWA installable manifest
│       │   ├── sw.js                       # Service worker with offline caching & background sync
│       │   └── icon.svg                    # Vector brand icon
│       └── src/
│           ├── components/                 # UI Views (Dashboard, Search, Player, Channels, etc.)
│           └── services/                   # IndexedDB on-device database & Web Crypto vault
├── DEPLOYMENT_GUIDE.md                     # Step-by-step 100% Free Tier deployment
└── PROVIDER_MIGRATION_GUIDE.md             # Guide to swap Cloudflare for AWS, GCP, or Azure`}
          </pre>
        </div>
      )}
    </div>
  );
};
