import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  logout,
} from '../services/googleAuth';
import {
  Youtube,
  LogOut,
  ChevronDown,
  User as UserIcon,
  CheckCircle2,
  Sparkles,
  Download,
  Loader2,
} from 'lucide-react';

interface GoogleAuthButtonProps {
  user: User | null;
  onAuthSuccess: (user: User, token: string) => void;
  onLogout: () => void;
  onImportMyChannel?: () => void;
  isImporting?: boolean;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  user,
  onAuthSuccess,
  onLogout,
  onImportMyChannel,
  isImporting = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        onAuthSuccess(res.user, res.accessToken);
      }
    } catch (err: any) {
      console.error('Sign in failed:', err);
      setErrorMsg(err.message || 'Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setShowDropdown(false);
    await logout();
    onLogout();
  };

  if (user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition text-xs font-semibold text-white active:scale-95 shadow-sm"
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-5 h-5 rounded-full object-cover ring-1 ring-orange-500"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center text-[10px] text-white">
              {user.displayName?.charAt(0) || 'U'}
            </div>
          )}
          <span className="hidden sm:inline max-w-[110px] truncate">{user.displayName || user.email}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="YouTube API & Google AI Connected" />
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 p-2.5 shadow-2xl z-50 space-y-2 animate-fadeIn">
            <div className="px-2 py-1.5 border-b border-slate-800">
              <div className="text-xs font-bold text-white truncate">{user.displayName || 'Google User'}</div>
              <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3" /> YouTube & Google AI Active
              </div>
            </div>

            {onImportMyChannel && (
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onImportMyChannel();
                }}
                disabled={isImporting}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-orange-600/15 hover:bg-orange-600/25 border border-orange-500/30 text-orange-300 text-xs font-semibold transition text-left"
              >
                {isImporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                )}
                <span>Import My YouTube Channel</span>
              </button>
            )}

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleSignIn}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-800 text-xs font-semibold transition shadow-md active:scale-95"
        title="Sign in with Google to grant YouTube & Google AI permissions"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
        )}
        <span className="hidden sm:inline">Sign in with Google</span>
        <span className="sm:hidden">Sign In</span>
      </button>

      {errorMsg && (
        <div className="absolute right-0 top-full mt-2 w-56 p-2 rounded-xl bg-red-950 border border-red-800 text-[11px] text-red-200 shadow-xl z-50">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
