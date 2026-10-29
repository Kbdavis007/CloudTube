import React from 'react';
import { Cloud, Wifi, ShieldCheck, Sparkles, Youtube } from 'lucide-react';
import { User } from 'firebase/auth';
import { PWAInstallButton } from './PWAInstallButton';
import { GoogleAuthButton } from './GoogleAuthButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface HeaderProps {
  onOpenWizard: () => void;
  onOpenSearch: () => void;
  videoCount: number;
  user: User | null;
  onAuthSuccess: (user: User, token: string) => void;
  onLogout: () => void;
  onImportMyChannel?: () => void;
  isImporting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenWizard,
  onOpenSearch,
  videoCount,
  user,
  onAuthSuccess,
  onLogout,
  onImportMyChannel,
  isImporting,
}) => {
  const isOnline = useOnlineStatus();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-md shadow-orange-500/20 text-white">
            <Youtube className="w-5 h-5 text-white" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border border-orange-500 flex items-center justify-center">
              <Cloud className="w-2.5 h-2.5 text-orange-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">CloudTube</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                100% CF Free Tier
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Workers · D1 · R2 · KV · Queues · Durable Objects · PWA
            </p>
          </div>
        </div>

        {/* Center / Right Status & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Online/Offline status */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                : 'bg-amber-950/40 text-amber-300 border-amber-800/50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {isOnline ? 'Edge Online' : 'IndexedDB Offline'}
          </div>

          {/* Cloudflare Free Tier Quota Shield */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
            <span>{videoCount} Indexed Videos</span>
          </div>

          {/* Google Auth & YouTube OAuth Button */}
          <GoogleAuthButton
            user={user}
            onAuthSuccess={onAuthSuccess}
            onLogout={onLogout}
            onImportMyChannel={onImportMyChannel}
            isImporting={isImporting}
          />

          {/* Quick Setup Wizard Button */}
          <button
            onClick={onOpenWizard}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
            title="Launch 5-Minute Automated Setup Wizard"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>5-Min Wizard</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
};
