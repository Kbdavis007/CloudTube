import React, { useState } from 'react';
import {
  Settings,
  Database,
  Lock,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Layers,
  Cloud,
  ArrowUpRight,
  GitBranch,
  CalendarClock,
} from 'lucide-react';
import { isVaultConfigured, clearCredentialsVault } from '../../services/crypto';
import { idbService } from '../../services/indexedDB';
import { CloudflareStatsPanel } from '../CloudflareStatsPanel';
import { HealthCheckPanel } from '../HealthCheckPanel';
import { VideoSourcesPanel } from '../VideoSourcesPanel';
import { ThemeVisualOptionsPanel } from '../ThemeVisualOptionsPanel';
import type { PageTab } from '../Sidebar';
import {
  VERSION_LABEL,
  VERSION_FULL,
  COMMIT,
  COMMIT_DATE,
  BRANCH,
  DIRTY,
} from '../../generated/version';

interface SettingsViewProps {
  onRefreshData: () => Promise<void>;
  videoCount: number;
  /** Opens another page (wizard, scaffolding) from the admin shortcuts. */
  onNavigate?: (tab: PageTab) => void;
  /** Opens the Setup Wizard at the credentials step so a token can be replaced. */
  onUpdateToken?: () => void;
  /** Opens the Setup Wizard at a specific step, used by the health-check fixes. */
  onOpenWizardStep?: (step: number) => void;
  /** Whether the Google account is connected, used for the YouTube source status. */
  isYouTubeConnected?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onRefreshData,
  videoCount,
  onNavigate,
  onUpdateToken,
  onOpenWizardStep,
  isYouTubeConnected = false,
}) => {
  const [vaultStatus, setVaultStatus] = useState<boolean>(isVaultConfigured());
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleClearVault = () => {
    if (confirm('Clear encrypted Cloudflare credentials from this device?')) {
      clearCredentialsVault();
      setVaultStatus(false);
    }
  };

  const handleExportBackup = async () => {
    const json = await idbService.exportLibraryJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudtube-library-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const res = await idbService.importLibraryJson(text);
        await onRefreshData();
        setImportStatus(`Successfully restored ${res.importedVideos} videos and ${res.importedChannels} channels!`);
        setTimeout(() => setImportStatus(null), 3500);
      } catch (err: any) {
        setImportStatus(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleClearLibrary = async () => {
    if (confirm('Permanently delete all videos, channels, comments, crawl jobs, and removal reasons from this device?')) {
      await idbService.clearDatabase();
      await onRefreshData();
      setImportStatus('Library cleared. All local data removed.');
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-orange-500" />
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Manage your library backups, connected accounts, storage, and setup options.
        </p>
      </div>

      {importStatus && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Live storage & activity usage (top of settings) */}
      <CloudflareStatsPanel
        onOpenWizard={() => onNavigate?.('wizard')}
        onUpdateToken={onUpdateToken}
      />

      {/* Always-available diagnostics: the same check the wizard runs, but
          reachable without going through setup. */}
      <HealthCheckPanel onFixNavigate={(step) => (onOpenWizardStep ?? onUpdateToken ?? (() => {}))(step)} />

      {/* Cloudflare Encrypted Storage Status */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Encrypted Credential Vault</h2>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              vaultStatus
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {vaultStatus ? 'AES-GCM Vault Active' : 'Not Configured'}
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Cloudflare API tokens used by the 5-Minute Setup Wizard are stored encrypted using the Web Crypto
          API in your browser. Tokens never leave your device unencrypted.
        </p>

        {vaultStatus && (
          <div className="flex justify-end">
            <button
              onClick={handleClearVault}
              className="px-3.5 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-semibold transition"
            >
              Clear Vault Credentials
            </button>
          </div>
        )}
      </div>

      {/* Theme & visual options */}
      <ThemeVisualOptionsPanel />

      {/* Video sources: relocated here from the sidebar, collapsed by default */}
      <VideoSourcesPanel
        onSelectSource={(tab) => onNavigate?.(tab)}
        isYouTubeConnected={isYouTubeConnected}
      />

      {/* YouTube access */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-white">YouTube Access</h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          CloudTube connects to YouTube using the access you grant when you sign in with Google. Signing
          in requests permission to read your YouTube library, profile, and email. No separate API key is
          required.
        </p>
      </div>

      {/* Library Backup & Restore */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-white">
            Library Backup & Restore ({videoCount} videos saved)
          </h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Export your complete YouTube library, ratings, channel graphs, study notes, and removal reasons as
          a JSON file, or restore from a previous backup. Restoring a backup also restores the taste profile
          learned from those reasons.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95"
          >
            <Download className="w-4 h-4 text-orange-400" />
            <span>Export Library</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition active:scale-95">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Restore Backup</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>

          <button
            onClick={handleClearLibrary}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-semibold transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Clear Library Data</span>
          </button>
        </div>
      </div>

      {/* What the library keeps, in plain terms (live usage meters are above) */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-white">What Your Library Keeps</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="text-xs font-semibold text-slate-300">Videos & channels</div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Everything you save, ready to browse, search, and play.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="text-xs font-semibold text-slate-300">Ratings, notes & comments</div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Your scores, notes, tags, and collected comments.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="text-xs font-semibold text-slate-300">Backups</div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Export or restore your whole library at any time.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Storage and activity meters are shown above. Nothing is estimated — they come from the same
          numbers your account provider reports.
        </p>
      </div>

      {/* Administration: build provenance + setup shortcuts */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-white">Administration</h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Setup and build details live here so they stay out of the way of everyday use.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate?.('wizard')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold transition shadow-sm active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Setup Wizard</span>
          </button>

          <button
            onClick={() => onNavigate?.('scaffolding')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95"
          >
            <Layers className="w-4 h-4 text-slate-400" />
            <span>View Code</span>
          </button>

          <a
            href="https://dash.cloudflare.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition"
          >
            <ArrowUpRight className="w-4 h-4 text-orange-400" />
            <span>Open Dashboard</span>
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <GitBranch className="w-3 h-3" /> Version
            </div>
            <div
              className={`font-mono text-sm ${
                DIRTY ? 'text-amber-300' : 'text-white'
              }`}
              title={VERSION_FULL}
            >
              {VERSION_LABEL}
              {DIRTY ? ' dirty' : ''}
            </div>
            <p className="text-[10px] text-slate-500 font-mono">{VERSION_FULL}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <Cloud className="w-3 h-3" /> Commit
            </div>
            <div className="font-mono text-sm text-white">{COMMIT}</div>
            <p className="text-[10px] text-slate-500 font-mono truncate">{BRANCH}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <CalendarClock className="w-3 h-3" /> Built
            </div>
            <div className="font-mono text-sm text-white">
              {COMMIT_DATE ? new Date(COMMIT_DATE).toLocaleDateString() : 'local build'}
            </div>
            <p className="text-[10px] text-slate-500 font-mono truncate">
              {COMMIT_DATE || 'uncommitted tree'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
