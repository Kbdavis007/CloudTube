import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { googleSignIn } from '../../services/googleAuth';
import {
  Youtube,
  Cloud,
  Brain,
  Database,
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Loader2,
  Tv,
  MessageSquare,
  Lock,
  CheckCircle2,
} from 'lucide-react';

interface LandingSplashViewProps {
  onAuthSuccess: (user: User, token: string) => void;
}

export const LandingSplashView: React.FC<LandingSplashViewProps> = ({ onAuthSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        onAuthSuccess(res.user, res.accessToken);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setErrorMsg(err.message || 'Google authentication was cancelled or encountered an error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl w-full text-center space-y-8">
        {/* Brand Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-orange-500/30 text-xs font-semibold text-orange-400 shadow-xl backdrop-blur-md animate-fadeIn">
          <Cloud className="w-4 h-4 text-orange-500" />
          <span>Your Personal YouTube Library</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Hero Title */}
        <div className="space-y-4 max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Personal YouTube Library,{' '}
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              Collector & Smart Manager
            </span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Collect the videos you care about, save your notes, and get instant smart summaries —
            all in one private library that keeps working even when you are offline.
          </p>
        </div>

        {/* Centered Login Box */}
        <div className="max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Sign In to Launch Your Studio</h2>
            <p className="text-xs text-slate-400">
              Sign in with Google to connect your YouTube library
            </p>
          </div>

          {/* Large Centered Google Sign-In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl bg-[#ffffff] hover:bg-[#f2f2f2] disabled:opacity-60 text-[#1a1a1a] font-bold text-sm shadow-xl hover:shadow-2xl transition duration-200 active:scale-[0.98] group"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
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
            <span>{isLoading ? 'Connecting Google Account...' : 'Sign in with Google'}</span>
          </button>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          {/* What you get list */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-left text-[11px] text-slate-400">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What you get:</div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Your YouTube videos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Channels & playlists</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Smart summaries</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Saved comments</span>
              </div>
            </div>
          </div>

          <div className="pt-1 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Your sign-in stays private · Nothing is shared</span>
          </div>
        </div>

        {/* 4 Feature Value Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-left">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white">Free to Use</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              No subscriptions, no setup fees. Your library is ready the moment you sign in.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white">Smart Summaries</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Instant summaries, key takeaways, and a score for every video you save.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Tv className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white">Channel Collector</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Collect every video from a channel you follow, with progress you can watch.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white">Works Offline</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Your saved videos and notes stay available even without a connection.
            </p>
          </div>
        </div>

        {/* Legal links. Google's OAuth verification requires the privacy policy to
            be linked on the app homepage, and this page is the homepage signed-out
            visitors see. Plain anchors, not the SPA router: the pages are static. */}
        <div className="pt-2 text-[11px] text-slate-400 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <a href="/privacy" className="text-slate-400 hover:text-orange-400 underline underline-offset-2">
            Privacy Policy
          </a>
          <span aria-hidden="true">·</span>
          <a href="/tos" className="text-slate-400 hover:text-orange-400 underline underline-offset-2">
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );
};
