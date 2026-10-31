import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { runHealthCheck } from '../services/healthCheck';
import type { HealthCheckItem, HealthReport } from '../types';

interface HealthCheckPanelProps {
  /**
   * Runs the check on mount. Off by default so the panel can be embedded
   * without firing API calls until the user asks for them.
   */
  autoRun?: boolean;
  /** Called when a fix needs to change wizard step or open the credentials form. */
  onFixNavigate?: (step: number) => void;
  /** Compacts the layout for embedding inside the wizard. */
  compact?: boolean;
}

const statusStyles: Record<
  HealthCheckItem['status'],
  { icon: React.ReactNode; row: string; badge: string; text: string }
> = {
  pass: {
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    row: 'bg-emerald-950/20 border-emerald-900/60',
    badge: 'bg-emerald-950/50 border-emerald-800 text-emerald-300',
    text: 'text-emerald-300',
  },
  warn: {
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    row: 'bg-amber-950/20 border-amber-900/60',
    badge: 'bg-amber-950/50 border-amber-800 text-amber-300',
    text: 'text-amber-300',
  },
  fail: {
    icon: <XCircle className="w-4 h-4 text-red-400" />,
    row: 'bg-red-950/30 border-red-900/70',
    badge: 'bg-red-950/60 border-red-800 text-red-300',
    text: 'text-red-300',
  },
};

const FixButton: React.FC<{
  item: HealthCheckItem;
  onFixNavigate?: (step: number) => void;
  onRetry: () => void;
}> = ({ item, onFixNavigate, onRetry }) => {
  const fix = item.fix;
  if (!fix) return null;

  if (fix.kind === 'token' && fix.url) {
    return (
      <a
        href={fix.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition active:scale-95"
      >
        <KeyRound className="w-3.5 h-3.5" />
        <span>{fix.label}</span>
        <ExternalLink className="w-3 h-3 opacity-70" />
      </a>
    );
  }

  if (fix.kind === 'dashboard' && fix.url) {
    return (
      <a
        href={fix.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition active:scale-95"
      >
        <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
        <span>{fix.label}</span>
      </a>
    );
  }

  if (fix.kind === 'credentials') {
    return (
      <button
        onClick={() => onFixNavigate?.(fix.step ?? 1)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition active:scale-95"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
        <span>{fix.label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-semibold transition active:scale-95"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      <span>{fix.label}</span>
    </button>
  );
};

/**
 * Renders a full health report. Each requirement is a row; anything that failed
 * for a fixable reason shows a button that resolves it. Usable anywhere, so the
 * same check backs both the wizard step and the Settings page.
 */
export const HealthCheckPanel: React.FC<HealthCheckPanelProps> = ({
  autoRun = false,
  onFixNavigate,
  compact = false,
}) => {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showPassed, setShowPassed] = useState(true);

  const run = useCallback(async () => {
    setIsRunning(true);
    try {
      setReport(await runHealthCheck());
    } catch (e: any) {
      // runHealthCheck is designed not to throw; if it somehow does, still show
      // something actionable rather than a blank panel.
      setReport({
        ranAt: new Date().toISOString(),
        ok: false,
        groups: [
          {
            title: 'Health check',
            items: [
              {
                id: 'fatal',
                label: 'Health check could not run',
                detail: '',
                status: 'fail',
                message: e?.message || 'Unexpected error.',
                fix: { label: 'Retry', kind: 'retry' },
              },
            ],
          },
        ],
        passed: 0,
        failed: 1,
        warned: 0,
      });
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    if (autoRun) run();
  }, [autoRun, run]);

  const allItems = report?.groups.flatMap((g) => g.items) ?? [];
  const failedItems = allItems.filter((i) => i.status === 'fail');
  const warnItems = allItems.filter((i) => i.status === 'warn');

  return (
    <div
      className={`rounded-3xl bg-slate-900/80 border border-slate-800 ${
        compact ? 'p-5 space-y-4' : 'p-6 space-y-4'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" />
            <span>Full Health Check</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Verifies every permission, resource, and setting this app needs. Safe to run at any
            time — it only reads, never changes anything.
          </p>
        </div>
        <button
          onClick={run}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[11px] font-bold transition active:scale-95"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{isRunning ? 'Checking…' : report ? 'Re-run check' : 'Run check'}</span>
        </button>
      </div>

      {report && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="px-2.5 py-1 rounded-full border bg-emerald-950/40 border-emerald-800 text-emerald-300">
            {report.passed} passed
          </span>
          {report.warned > 0 && (
            <span className="px-2.5 py-1 rounded-full border bg-amber-950/40 border-amber-800 text-amber-300">
              {report.warned} warning{report.warned === 1 ? '' : 's'}
            </span>
          )}
          {report.failed > 0 && (
            <span className="px-2.5 py-1 rounded-full border bg-red-950/50 border-red-800 text-red-300">
              {report.failed} failed
            </span>
          )}
          <span className="text-slate-500">
            checked {new Date(report.ranAt).toLocaleTimeString()}
          </span>
        </div>
      )}

      {report && failedItems.length > 0 && (
        <div className="p-3 rounded-2xl bg-red-950/30 border border-red-900/70 text-[11px] text-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          <span>
            {failedItems.length} requirement{failedItems.length === 1 ? '' : 's'} not met. Use the
            button on each failed row to fix it, then re-run.
          </span>
        </div>
      )}

      {report?.ok && (
        <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-900/70 text-[11px] text-emerald-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <span>
            Everything checks out. All permissions, resources, and settings are in place.
          </span>
        </div>
      )}

      {report &&
        report.groups.map((group) => {
          const visible = showPassed
            ? group.items
            : group.items.filter((i) => i.status !== 'pass');
          if (visible.length === 0) return null;
          return (
            <div key={group.title} className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.title}
              </div>
              {visible.map((it) => {
                const s = statusStyles[it.status];
                return (
                  <div
                    key={it.id}
                    className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-start gap-2 ${s.row}`}
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="mt-0.5 shrink-0">{s.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100">{it.label}</div>
                        {it.detail && (
                          <div className="text-[11px] text-slate-500">{it.detail}</div>
                        )}
                        {it.message && it.status !== 'pass' && (
                          <div className={`text-[11px] mt-1 break-words ${s.text}`}>
                            {it.message}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${s.badge}`}
                      >
                        {it.status}
                      </span>
                      <FixButton item={it} onFixNavigate={onFixNavigate} onRetry={run} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

      {report && (failedItems.length > 0 || warnItems.length > 0) && (
        <button
          onClick={() => setShowPassed((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition"
        >
          {showPassed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{showPassed ? 'Hide passing checks' : 'Show passing checks'}</span>
        </button>
      )}

      {!report && !isRunning && (
        <p className="text-[11px] text-slate-500">
          Run the check to see the status of every permission and setting.
        </p>
      )}
    </div>
  );
};
