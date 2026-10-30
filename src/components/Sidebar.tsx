import React from 'react';
import {
  LayoutDashboard,
  Search,
  PlaySquare,
  Tv,
  MessageSquare,
  Star,
  Settings,
  Lock,
  Trash2,
  Film,
} from 'lucide-react';

export type PageTab =
  | 'dashboard'
  | 'search'
  | 'sources'
  | 'xvideos'
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
      id: 'sources' as PageTab,
      label: 'Video Sources',
      icon: Film,
      badge: '2',
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
      id: 'settings' as PageTab,
      label: 'Settings & Admin',
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
                      isActive
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
    </aside>
  );
};
