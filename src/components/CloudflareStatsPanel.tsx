import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, HardDrive, RefreshCw, ShieldCheck, Loader2, ExternalLink, KeyRound } from 'lucide-react';
import {
  cfClient,
  CloudflareUsageSnapshot,
  CloudflareUsageMetric,
  buildAnalyticsTokenUrl,
  isAnalyticsPermissionError,
} from '../services/cloudflareApi';
import { loadAndDecryptCredentials } from '../services/crypto';

interface CloudflareStatsPanelProps {
  /** Opens the Setup Wizard so an unconfigured account can be connected. */
  onOpenWizard?: () => void;
  /** Opens the Setup Wizard on the credentials step so a new token can be pasted. */
  onUpdateToken?: () => void;
}

const formatValue = (value: number, unit: string): string => {
  if (unit === 'GB') return value.toFixed(2);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
};

const barColor = (pct: number): string => {
  if (pct >= 80) return 'bg-red-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const MetricRow: React.FC<{ metric: CloudflareUsageMetric }> = ({ metric }) => {
  const pct = metric.limit > 0 ? (metric.used / metric.limit) * 100 : 0;
  const width = Math.min(100, Math.max(pct > 0 ? 1 : 0, pct));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{metric.label}</span>
        <span className="font-mono text-slate-400">
          {formatValue(metric.used, metric.unit)} / {formatValue(metric.limit, metric.unit)}
          <span className="ml-2 text-slate-500">{pct.toFixed(pct < 1 ? 2 : 1)}%</span>
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${barColor(pct)}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

export const CloudflareStatsPanel: React.FC<CloudflareStatsPanelProps> = ({
  onOpenWizard,
  onUpdateToken,
}) => {
  const [snapshot, setSnapshot] = useState<CloudflareUsageSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  const loadUsage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNeedsPermission(false);
    setNotConfigured(false);

    try {
      const creds = await loadAndDecryptCredentials();
      if (!creds?.accountId || !creds?.apiToken) {
        setNotConfigured(true);
        setSnapshot(null);
        return;
      }

      cfClient.setCredentials(creds.accountId, creds.apiToken, creds.accountEmail, creds.authMode);
      setSnapshot(await cfClient.fetchUsageSnapshot());
    } catch (err: any) {
      const message = err?.message || 'Failed to read Cloudflare usage analytics.';
      setError(message);
      // A missing scope is the one failure the user can fix from here, so it
      // gets a button rather than just an explanation.
      setNeedsPermission(
        Boolean(err?.needsAnalyticsPermission) || isAnalyticsPermissionError(message)
      );
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const worstPct = snapshot
    ? Math.max(
        ...snapshot.metrics.map((m) => (m.limit > 0 ? (m.used / m.limit) * 100 : 0)),
        0
      )
    : 0;

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900/95 to-slate-950 border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold text-white">Cloudflare Free Tier Usage</h2>
          {snapshot && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                worstPct >= 80
                  ? 'bg-red-500/20 text-red-400'
                  : worstPct >= 50
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {worstPct.toFixed(worstPct < 1 ? 2 : 1)}% PEAK
            </span>
          )}
        </div>

        <button
          onClick={loadUsage}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
          )}
          <span>Refresh</span>
        </button>
      </div>

      {isLoading && !snapshot && (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
          <span>Reading live analytics from the Cloudflare GraphQL API...</span>
        </div>
      )}

      {notConfigured && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            Connect a Cloudflare account to see live Workers, D1, KV, and R2 usage for the current
            UTC day. Usage is read from the same GraphQL Analytics API the Cloudflare dashboard
            uses — nothing is estimated.
          </p>
          {onOpenWizard && (
            <button
              onClick={onOpenWizard}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition active:scale-95"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Connect via Setup Wizard</span>
            </button>
          )}
        </div>
      )}

      {error && !isLoading && (
        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/50 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>{needsPermission ? 'Analytics permission missing' : 'Usage analytics unavailable'}</span>
          </div>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">{error}</p>

          {needsPermission ? (
            <>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Cloudflare cannot add a scope to an existing token, so this needs a replacement
                token that includes{' '}
                <span className="font-mono text-slate-200">Account Analytics: Read</span>. Your
                other permissions are unchanged.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={buildAnalyticsTokenUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition active:scale-95"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Create a token with this scope</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
                {onUpdateToken && (
                  <button
                    onClick={onUpdateToken}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition active:scale-95"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                    <span>Paste the new token</span>
                  </button>
                )}
                <button
                  onClick={loadUsage}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-semibold transition active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                The form opens with the scope pre-selected; you still review and create the token in
                the Cloudflare dashboard.
              </p>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              This is usually a transient Cloudflare API problem. Retry, or check the token has{' '}
              <span className="font-mono">Account Analytics: Read</span> if it keeps failing.
            </p>
          )}
        </div>
      )}

      {snapshot && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {snapshot.metrics.map((metric) => (
              <MetricRow key={metric.key} metric={metric} />
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Measured via Cloudflare GraphQL Analytics API
            </span>
            <span className="font-mono">
              {new Date(snapshot.fetchedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {snapshot.errors.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-[11px] font-bold text-amber-300">Partial data</div>
              {snapshot.errors.map((message, i) => (
                <p key={i} className="text-[11px] text-slate-400 leading-relaxed">
                  {message}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
