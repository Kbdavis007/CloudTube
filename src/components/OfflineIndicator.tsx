import React from 'react';
import { WifiOff, Download } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500/90 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-[#0a0a0a] shadow-2xl border border-amber-400 animate-bounce">
      <WifiOff className="w-4 h-4 text-[#0a0a0a]" />
      <span className="flex items-center gap-1.5">
        Offline Mode Active
        <span className="inline-flex items-center gap-1 rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
          <Download className="w-3 h-3" /> Saved Videos
        </span>
      </span>
    </div>
  );
};
