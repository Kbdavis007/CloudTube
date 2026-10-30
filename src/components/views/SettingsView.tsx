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
  HardDrive,
  Key,
  Server,
} from 'lucide-react';
import { isVaultConfigured, clearCredentialsVault } from '../../services/crypto';
import { idbService } from '../../services/indexedDB';

interface SettingsViewProps {
  onRefreshData: () => Promise<void>;
  videoCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onRefreshData, videoCount }) => {
  const [youtubeApiKey, setYoutubeApiKey] = useState(
    localStorage.getItem('cloudtube_yt_api_key') || ''
  );
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<boolean>(isVaultConfigured());
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleSaveApiKey = () => {
    localStorage.setItem('cloudtube_yt_api_key', youtubeApiKey);
    setIsApiKeySaved(true);
    setTimeout(() => setIsApiKeySaved(false), 2000);
  };

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
    if (confirm('Permanently delete all videos, channels, comments, and crawl jobs from this device?')) {
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
          Settings & Cloudflare Quotas
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Manage API credentials, encrypted client vault, IndexedDB backups, and review Free Tier limits.
        </p>
      </div>

      {importStatus && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{importStatus}</span>
        </div>
      )}

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

      {/* YouTube Data API Key (Optional) */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-white">YouTube Data API v3 Key (Optional)</h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          CloudTube queries the live YouTube Data API v3. Sign in with Google to grant access, or
          enter a Google Cloud YouTube Data API v3 key below to query YouTube endpoints directly.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            value={youtubeApiKey}
            onChange={(e) => setYoutubeApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-hidden focus:border-orange-500"
          />
          <button
            onClick={handleSaveApiKey}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-sm active:scale-95"
          >
            {isApiKeySaved ? 'Saved!' : 'Save Key'}
          </button>
        </div>
      </div>

      {/* IndexedDB Database Backup & Restore */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-white">
            Library Database Management ({videoCount} Videos Cached)
          </h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Export your complete YouTube library, ratings, channel graphs, and study notes as a JSON file, or
          restore from a previous backup.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95"
          >
            <Download className="w-4 h-4 text-orange-400" />
            <span>Export Library JSON</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition active:scale-95">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Import / Restore Backup</span>
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

      {/* Cloudflare Free Tier Guarantees Sheet */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-white">Cloudflare Free Tier Limits Reference</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="pb-2">Resource</th>
                <th className="pb-2">Free Tier Limit</th>
                <th className="pb-2">CloudTube Role</th>
                <th className="pb-2">Cost Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              <tr>
                <td className="py-2.5 font-bold text-white">Workers</td>
                <td className="py-2.5 text-orange-400">100,000 requests / day</td>
                <td className="py-2.5">API router & endpoints</td>
                <td className="py-2.5 text-emerald-400">Free Forever</td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-white">D1 Database</td>
                <td className="py-2.5 text-orange-400">5,000,000 rows read / day</td>
                <td className="py-2.5">Video & comment tables</td>
                <td className="py-2.5 text-emerald-400">Free Forever</td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-white">R2 Storage</td>
                <td className="py-2.5 text-orange-400">10 GB + $0 Egress Fees</td>
                <td className="py-2.5">Media & comments vault</td>
                <td className="py-2.5 text-emerald-400">Free Forever</td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-white">Workers KV</td>
                <td className="py-2.5 text-orange-400">100,000 reads / day</td>
                <td className="py-2.5">Fast metadata cache</td>
                <td className="py-2.5 text-emerald-400">Free Forever</td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-white">Pages PWA</td>
                <td className="py-2.5 text-orange-400">Unlimited requests & bandwidth</td>
                <td className="py-2.5">React PWA hosting</td>
                <td className="py-2.5 text-emerald-400">Free Forever</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
