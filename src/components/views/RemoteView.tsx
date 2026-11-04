import React, { useState } from 'react';
import { Globe, RefreshCw, ExternalLink, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { REMOTE_PREFIX, REMOTE_HOST } from '../../services/remoteProxy';

const CONSENT_STORAGE_KEY = 'cloudtube.remote.contentConfirmed';

/**
 * Full-page Remote view.
 *
 * Embeds a whole external site inside CloudTube. The site cannot be framed
 * directly (it sends `X-Frame-Options: SAMEORIGIN`), so the iframe loads the
 * same-origin proxy at `/_remote` (see services/remoteProxy.ts), which re-serves
 * the page without the blocking headers.
 *
 * The page fills the content area: this view is a flex column of full height, and
 * the iframe takes the remaining space. The app shell keeps the left sidebar
 * sticky, so only this panel scrolls.
 */
export const RemoteView: React.FC = () => {
  const [confirmed, setConfirmed] = useState<boolean>(
    () => localStorage.getItem(CONSENT_STORAGE_KEY) === 'true'
  );
  const [isLoading, setIsLoading] = useState(true);
  // Bumping this key remounts the iframe, which is how a reload is triggered.
  const [reloadKey, setReloadKey] = useState(0);

  const confirmContent = () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
    setConfirmed(true);
  };

  const reload = () => {
    setIsLoading(true);
    setReloadKey((k) => k + 1);
  };

  if (!confirmed) {
    return (
      <div className="flex-1 md:h-full flex items-center justify-center py-6">
        <div className="w-full max-w-2xl space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-500" />
              Remote
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Browse an external site inside CloudTube, full page, with the sidebar still in reach.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/80 border border-orange-500/30 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-white">Content notice</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Remote loads a live external site through this app's own server, so its page and
                  assets are fetched on your behalf. It is age-restricted content. Continue only if
                  you are 18 or older and it is legal to view this content where you are.
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Nothing is stored from the site; it is proxied so it can be shown in a frame.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={confirmContent}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition active:scale-95"
              >
                I am 18 or older — open Remote
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 md:h-full flex flex-col gap-3">
      {/* Slim control bar: reload and open-original, so the proxied frame never
          traps navigation. */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-orange-500" />
          <h1 className="text-sm font-bold text-white">Remote</h1>
          <span className="text-[10px] font-mono text-slate-500">{REMOTE_HOST}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
            <span>Reload</span>
          </button>

          <a
            href={`https://${REMOTE_HOST}/`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-semibold transition"
          >
            <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
            <span>Open original</span>
          </a>
        </div>
      </div>

      <div className="relative flex-1 min-h-[70vh] md:min-h-0 rounded-3xl overflow-hidden border border-slate-800 bg-slate-950">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              Loading {REMOTE_HOST}…
            </div>
          </div>
        )}
        <iframe
          key={reloadKey}
          src={`${REMOTE_PREFIX}/`}
          title="Remote"
          onLoad={() => setIsLoading(false)}
          className="w-full h-full border-0"
          // The proxy already allows the frame; this mirrors the sandbox the
          // source uses for its own embeds so the site behaves as expected.
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  );
};
