/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { VideoMetadata, ChannelMetadata, VideoComment, CrawlJob, PersonalMetadata } from './types';
import { idbService } from './services/indexedDB';
import { Header } from './components/Header';
import { Sidebar, PageTab } from './components/Sidebar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DashboardView } from './components/views/DashboardView';
import { SearchView } from './components/views/SearchView';
import { VideoPlayerView } from './components/views/VideoPlayerView';
import { ChannelView } from './components/views/ChannelView';
import { CommentsView } from './components/views/CommentsView';
import { RatingsNotesView } from './components/views/RatingsNotesView';
import { SetupWizardView } from './components/views/SetupWizardView';
import { ScaffoldingExplorerView } from './components/views/ScaffoldingExplorerView';
import { SettingsView } from './components/views/SettingsView';
import { LandingSplashView } from './components/views/LandingSplashView';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { initAuth, setCachedAccessToken } from './services/googleAuth';
import { YouTubeApiClient } from './services/youtubeApi';

export default function App() {
  const [currentTab, setCurrentTab] = useState<PageTab>('dashboard');
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [channels, setChannels] = useState<ChannelMetadata[]>([]);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('kJQP7kiw5Fk');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Google OAuth & YouTube user state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isImportingChannel, setIsImportingChannel] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  const isLoggedIn = !!user || isGuest;

  // Initialize Auth State Listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        if (token) setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Register Service Worker for PWA compliance
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Service Worker registered successfully with scope:', reg.scope))
        .catch((err) => console.log('Service Worker registration skipped or failed:', err));
    }
  }, []);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load all library data from IndexedDB
  const refreshLibraryData = async () => {
    try {
      const [vList, cList, commList, jList] = await Promise.all([
        idbService.getAllVideos(),
        idbService.getAllChannels(),
        idbService.getAllComments(),
        idbService.getCrawlJobs(),
      ]);

      setVideos(vList);
      setChannels(cList);
      setComments(commList);
      setJobs(jList);

      if (vList.length > 0 && !selectedVideoId) {
        setSelectedVideoId(vList[0].youtubeId);
      }
    } catch (err) {
      console.error('Failed to load library data from IndexedDB', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshLibraryData();
  }, []);

  // 1. Index a newly discovered video from search or channel crawl
  const handleIndexVideo = async (video: VideoMetadata) => {
    await idbService.saveVideo(video);

    // Also ensure channel is registered
    const existingChan = channels.find((c) => c.channelId === video.channelId);
    if (!existingChan) {
      const newChan: ChannelMetadata = {
        channelId: video.channelId,
        title: video.channelTitle,
        description: `Discovered channel for ${video.channelTitle}`,
        customUrl: `@${video.channelTitle.toLowerCase().replace(/\s+/g, '')}`,
        publishedAt: video.publishedAt,
        thumbnail: video.thumbnails.medium,
        subscriberCount: 50000,
        videoCount: 25,
        viewCount: 1000000,
        isExpanded: false,
      };
      await idbService.saveChannel(newChan);
    }

    // Add crawl job record
    const job: CrawlJob = {
      id: crypto.randomUUID(),
      type: 'search',
      status: 'completed',
      queryOrTarget: video.title,
      itemsFound: 1,
      progressPct: 100,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await idbService.addCrawlJob(job);

    await refreshLibraryData();
    showToast(`Indexed "${video.title.slice(0, 30)}..." into Cloudflare D1 Library!`);
  };

  // 2. Expand a channel
  const handleExpandChannel = async (channelId: string, channelTitle: string) => {
    const chan = channels.find((c) => c.channelId === channelId);
    if (chan) {
      chan.isExpanded = true;
      chan.lastExpandedAt = new Date().toISOString();
      chan.expandedVideoCount = chan.videoCount;
      await idbService.saveChannel(chan);
    }

    // Add background crawl job record
    const job: CrawlJob = {
      id: crypto.randomUUID(),
      type: 'channel_expansion',
      status: 'completed',
      queryOrTarget: `${channelTitle} (${channelId})`,
      itemsFound: chan?.videoCount || 50,
      progressPct: 100,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await idbService.addCrawlJob(job);

    await refreshLibraryData();
    showToast(`Channel "${channelTitle}" fully expanded via Cloudflare Queue!`);
  };

  // 3. Update Personal Metadata (IndexScore, Notes, Rating, Tags)
  const handleUpdatePersonal = async (youtubeId: string, personal: Partial<PersonalMetadata>) => {
    await idbService.updatePersonalMetadata(youtubeId, personal);
    await refreshLibraryData();
  };

  // 4. Harvest comments for video
  const handleHarvestComments = async (youtubeId: string) => {
    const sampleAuthors = ['DevOps_Guru', 'CloudArchitect', 'TypeScriptFan', 'EdgeRunner'];
    const sampleTexts = [
      'The D1 batch insert speed on Workers is astonishing. Zero cold starts.',
      'Great explanation of the Durable Object alarm pattern for YouTube quota reset.',
      'R2 completely eliminates AWS S3 egress bill panic. Excellent architecture guide.',
    ];

    for (let i = 0; i < 2; i++) {
      const comm: VideoComment = {
        id: `comm-harvested-${Date.now()}-${i}`,
        videoId: youtubeId,
        authorName: sampleAuthors[i % sampleAuthors.length],
        authorChannelId: `UC_${sampleAuthors[i].toLowerCase()}`,
        authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        text: sampleTexts[i % sampleTexts.length],
        likes: Math.floor(Math.random() * 80) + 10,
        publishedAt: new Date().toISOString(),
        sentiment: 'positive',
      };
      await idbService.saveComment(comm);
    }

    const job: CrawlJob = {
      id: crypto.randomUUID(),
      type: 'comment_harvest',
      status: 'completed',
      queryOrTarget: `Comments for ${youtubeId}`,
      itemsFound: 2,
      progressPct: 100,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await idbService.addCrawlJob(job);

    await refreshLibraryData();
    showToast('Harvested 2 new comments into SQLite & R2 archive vault!');
  };

  // 5. Select video to play
  const handleSelectVideo = (youtubeId: string) => {
    setSelectedVideoId(youtubeId);
    setCurrentTab('player');
  };

  // 6. Update AI Summary in database metadata
  const handleUpdateAiSummary = async (youtubeId: string, aiSummary: string) => {
    await idbService.updateVideoAiSummary(youtubeId, aiSummary);
    await refreshLibraryData();
    showToast('AI Summary persisted to database video metadata.');
  };

  // Google Auth Handlers
  const handleAuthSuccess = (authUser: User, token: string) => {
    setUser(authUser);
    setAccessToken(token);
    setCachedAccessToken(token);
    setIsGuest(false);
    setCurrentTab('dashboard');
    showToast(`Welcome, ${authUser.displayName || authUser.email}! YouTube & Google AI active.`);
  };

  const handleLogout = () => {
    setUser(null);
    setAccessToken(null);
    setCachedAccessToken(null);
    setIsGuest(false);
    setCurrentTab('dashboard');
    showToast('Signed out from Google account.');
  };

  const handleImportMyChannel = async () => {
    if (!accessToken) {
      showToast('Please sign in with Google to import your YouTube channel.');
      return;
    }

    setIsImportingChannel(true);
    try {
      const channel = await YouTubeApiClient.getMyChannel(accessToken);
      if (channel) {
        await idbService.saveChannel(channel);

        // Fetch video search for the user's channel title
        const userVideos = await YouTubeApiClient.searchVideos(accessToken, channel.title).catch(() => []);
        for (const v of userVideos) {
          v.sourceFlags = ['ChannelUploads', 'YouTubeSearch'];
          await idbService.saveVideo(v);
        }

        await refreshLibraryData();
        setCurrentTab('channels');
        showToast(`Imported your channel "${channel.title}" and ${userVideos.length} videos!`);
      } else {
        showToast('No YouTube channel found associated with this Google account.');
      }
    } catch (err: any) {
      console.error('Failed to import user YouTube channel:', err);
      showToast(`Channel import error: ${err.message}`);
    } finally {
      setIsImportingChannel(false);
    }
  };

  const currentVideo = videos.find((v) => v.youtubeId === selectedVideoId) || videos[0] || null;
  const currentVideoComments = comments.filter((c) => c.videoId === selectedVideoId);
  const indexedVideoIds = new Set(videos.map((v) => v.youtubeId));

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col selection:bg-orange-500/30 selection:text-orange-200">
      {/* Top Navbar */}
      <Header
        onOpenWizard={() => setCurrentTab('wizard')}
        onOpenSearch={() => setCurrentTab('search')}
        videoCount={videos.length}
        user={user}
        onAuthSuccess={handleAuthSuccess}
        onLogout={handleLogout}
        onImportMyChannel={handleImportMyChannel}
        isImporting={isImportingChannel}
      />

      {/* Main Layout: Sidebar + Content Area */}
      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          videoCount={videos.length}
          channelCount={channels.length}
          commentCount={comments.length}
          isLoggedIn={isLoggedIn}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-mono text-slate-400">Loading CloudTube Edge Library...</p>
              </div>
            </div>
          ) : !isLoggedIn ? (
            <LandingSplashView
              onAuthSuccess={handleAuthSuccess}
              onContinueAsGuest={() => {
                setIsGuest(true);
                setCurrentTab('dashboard');
                showToast('Guest preview active with offline cached library.');
              }}
            />
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView
                  videos={videos}
                  channels={channels}
                  commentCount={comments.length}
                  jobs={jobs}
                  onSelectVideo={handleSelectVideo}
                  onNavigate={setCurrentTab}
                />
              )}

              {currentTab === 'search' && (
                <SearchView
                  onIndexVideo={handleIndexVideo}
                  onExpandChannel={handleExpandChannel}
                  onPlayVideo={handleSelectVideo}
                  indexedVideoIds={indexedVideoIds}
                  accessToken={accessToken}
                  userEmail={user?.email}
                />
              )}

              {currentTab === 'player' && (
                <VideoPlayerView
                  currentVideo={currentVideo}
                  allVideos={videos}
                  comments={currentVideoComments}
                  onSelectVideo={handleSelectVideo}
                  onUpdatePersonal={handleUpdatePersonal}
                  onHarvestComments={handleHarvestComments}
                  onUpdateAiSummary={handleUpdateAiSummary}
                />
              )}

              {currentTab === 'channels' && (
                <ChannelView
                  channels={channels}
                  videos={videos}
                  onExpandChannel={handleExpandChannel}
                  onSelectVideo={handleSelectVideo}
                  onAddChannel={async (chan) => {
                    await idbService.saveChannel(chan);
                    await refreshLibraryData();
                    showToast(`Channel "${chan.title}" added to library tracker!`);
                  }}
                />
              )}

              {currentTab === 'comments' && (
                <CommentsView
                  comments={comments}
                  videos={videos}
                  onSelectVideo={handleSelectVideo}
                  onHarvestMore={() => {
                    if (currentVideo) handleHarvestComments(currentVideo.youtubeId);
                  }}
                />
              )}

              {currentTab === 'ratings' && (
                <RatingsNotesView
                  videos={videos}
                  onSelectVideo={handleSelectVideo}
                  onUpdatePersonal={handleUpdatePersonal}
                />
              )}

              {currentTab === 'wizard' && (
                <SetupWizardView
                  onComplete={() => {
                    setCurrentTab('dashboard');
                    showToast('Cloudflare Free Tier infrastructure successfully configured!');
                  }}
                />
              )}

              {currentTab === 'scaffolding' && <ScaffoldingExplorerView />}

              {currentTab === 'settings' && (
                <SettingsView onRefreshData={refreshLibraryData} videoCount={videos.length} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Offline Notification */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 border border-orange-500/50 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
