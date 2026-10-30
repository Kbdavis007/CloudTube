import React from 'react';
import { VERSION_LABEL, COMMIT, BRANCH, COMMIT_DATE } from '../generated/version';
import {
  LayoutDashboard,
  Search,
  PlaySquare,
  Tv,
  MessageSquare,
  Star,
  Sparkles,
  Layers,
  Settings,
  HardDrive,
  Lock,
  Trash2,
} from 'lucide-react';

export type PageTab =
  | 'dashboard'
  | 'search'
  | 'player'
  | 'channels'
  | 'comments'
  | 'ratings'
  | 'removals'
  | 'wizard'
  | 'scaffolding'
  | 'settings';

interface SidebarProps {
  currentTab: PageTab;
  onSelectTab: (tab: PageTab) => void;
  videoCount: number;
  channelCount: number;
  commentCount: number;
  removalCount?: number;
  isLoggedIn?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  videoCount,
  channelCount,
  commentCount,
  removalCount = 0,
  isLoggedIn = false,
}) => {
  const navItems = [
    {
      id: 'dashboard' as PageTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'search' as PageTab,
      label: 'Search & Harvest',
      icon: Search,
      badge: 'Live',
    },
    {
      id: 'player' as PageTab,
      label: 'Video Viewer',
      icon: PlaySquare,
      badge: videoCount > 0 ? String(videoCount) : null,
    },
    {
      id: 'channels' as PageTab,
      label: 'Channel Viewer',
      icon: Tv,
      badge: channelCount > 0 ? String(channelCount) : null,
    },
    {
      id: 'comments' as PageTab,
      label: 'Comments Viewer',
      icon: MessageSquare,
      badge: commentCount > 0 ? String(commentCount) : null,
    },
    {
      id: 'ratings' as PageTab,
      label: 'Ratings & Notes',
      icon: Star,
      badge: null,
    },
    {
      id: 'removals' as PageTab,
      label: 'Removed & Taste',
      icon: Trash2,
      badge: removalCount > 0 ? String(removalCount) : null,
    },
    {
      id: 'wizard' as PageTab,
      label: 'Setup Wizard',
      icon: Sparkles,
      badge: '5 Min',
      highlight: true,
    },
    {
      id: 'scaffolding' as PageTab,
      label: 'Architecture & Code',
      icon: Layers,
      badge: '100% Free',
    },
    {
      id: 'settings' as PageTab,
      label: 'Settings & Quotas',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-full md:w-64 border-r border-slate-800/80 bg-slate-950/60 p-3 flex md:flex-col justify-between shrink-0 overflow-x-auto md:overflow-x-visible">
      <div className="flex md:flex-col gap-1 w-full">
        <div className="hidden md:flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
          <span>{isLoggedIn ? 'YouTube Library Core' : 'Navigation Locked'}</span>
          {!isLoggedIn && <Lock className="w-3.5 h-3.5 text-orange-400" />}
        </div>

        {!isLoggedIn ? (
          <div className="hidden md:block my-2 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-200">Links Hidden</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Sign in with Google on the landing page to reveal Dashboard, Search, and Library viewers.
              </p>
            </div>
          </div>
        ) : (
          navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition group whitespace-nowrap active:scale-[0.98] ${
                  isActive
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 transition ${
                      isActive ? 'text-orange-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                      item.highlight
                        ? 'bg-orange-500 text-white'
                        : isActive
                        ? 'bg-orange-500/20 text-orange-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Release / deployment stamp */}
      <div className="hidden md:block mt-3 px-3 py-2 rounded-2xl bg-slate-950/60 border border-slate-800/60">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span title={`Commit ${COMMIT} on ${BRANCH}`}>CloudTube {VERSION_LABEL}</span>
          <span>{COMMIT}</span>
        </div>
        <div className="text-[9px] text-slate-500 font-mono truncate">
          {COMMIT_DATE || 'local build'} · {BRANCH}
        </div>
      </div>

      {/* Cloudflare Free Tier Mini Gauge in Sidebar Footer */}
      <div className="hidden md:block mt-6 p-3 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <HardDrive className="w-3.5 h-3.5 text-orange-400" />
            <span>Cloudflare Free Tier</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-semibold">
            0.1% USED
          </span>
        </div>
        <div className="space-y-1.5 text-[11px] text-slate-400">
          <div className="flex justify-between">
            <span>Workers API:</span>
            <span className="font-mono text-slate-300">124 / 100k /day</span>
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-[1%]" />
          </div>
          <div className="flex justify-between">
            <span>D1 SQLite Reads:</span>
            <span className="font-mono text-slate-300">1.8k / 5M /day</span>
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 w-[2%]" />
          </div>
        </div>
      </div>
    </aside>
  );
};
