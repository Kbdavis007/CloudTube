/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { User } from 'firebase/auth';
import { VideoMetadata, ChannelMetadata, VideoComment, CrawlJob, PersonalMetadata, VideoRemoval, TasteProfile } from './types';
import { idbService } from './services/indexedDB';
import { buildTasteProfile } from './services/tasteProfile';
import { getRemovalReason } from './data/removalReasons';
import { Header } from './components/Header';
import { Sidebar, PageTab } from './components/Sidebar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DashboardView } from './components/views/DashboardView';
import { SearchView } from './components/views/SearchView';
import { VegaSourceView } from './components/views/VegaSourceView';
import { VideosPage } from './components/views/VideosPage';
import { ChannelView } from './components/views/ChannelView';
import { CommentsView } from './components/views/CommentsView';
import { RatingsNotesView } from './components/views/RatingsNotesView';
import { RemovalsView } from './components/views/RemovalsView';
import { RemoveVideoModal, RemovalRequest } from './components/RemoveVideoModal';
import { SetupWizardView } from './components/views/SetupWizardView';
import { ScaffoldingExplorerView } from './components/views/ScaffoldingExplorerView';
import { SettingsView } from './components/views/SettingsView';
import { LandingSplashView } from './components/views/LandingSplashView';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { initAuth, setCachedAccessToken, refreshGoogleAccessToken } from './services/googleAuth';
import { YouTubeApiClient } from './services/youtubeApi';
import { expandChannel } from './services/channelExpansion';
import { loadViewState, saveViewState } from './services/viewState';
import { resolvePlayerSelection } from './services/playerSelection';
import { findRelatedVideos } from './services/relatedVideos';
import { loadBakedCatalogVideos } from './services/vegaApi';
import { splitLinks } from './services/googleApiErrors';

// The editor carries Mediabunny, so it is loaded on demand: the media engine
// stays out of the initial bundle until the tab is opened.
const EditorView = lazy(() =>
  import('./components/views/EditorView').then((module) => ({ default: module.EditorView }))
);

export default function App() {
  const [currentTab, setCurrentTab] = useState<PageTab>(() => loadViewState().tab);
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [channels, setChannels] = useState<ChannelMetadata[]>([]);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [removals, setRemovals] = useState<VideoRemoval[]>([]);
  const [videoPendingRemoval, setVideoPendingRemoval] = useState<VideoMetadata | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string>(
    () => loadViewState().selectedVideoId
  );
  // A video being played before it is saved. Watching a result must not add it
  // to the library, so the player holds the video here until the user saves it.
  const [ephemeralVideo, setEphemeralVideo] = useState<VideoMetadata | null>(null);
  // The list a played video came from (search results, catalogue). Prev/next on
  // the player moves through it, so watching a result walks the result list
  // rather than the library. Empty when the video was opened from the library.
  const [playerQueue, setPlayerQueue] = useState<VideoMetadata[]>([]);
  const [queueLabel, setQueueLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  // When set, the wizard opens on this step (used by Settings to replace a token).
  const [wizardStep, setWizardStep] = useState<number | undefined>(undefined);

  // Google OAuth & YouTube user state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isImportingChannel, setIsImportingChannel] = useState(false);

  const isLoggedIn = !!user;

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
      const [vList, cList, commList, rList] = await Promise.all([
        idbService.getAllVideos(),
        idbService.getAllChannels(),
        idbService.getAllComments(),
        idbService.getRemovals(),
      ]);

      setVideos(vList);
      setChannels(cList);
      setComments(commList);
      setRemovals(rList);

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

  // Keep the current view across reloads. The tab and the selected video are the
  // only navigation state, so restoring them is enough to land back where the
  // user was instead of on the dashboard.
  useEffect(() => {
    saveViewState({ tab: currentTab, selectedVideoId });
  }, [currentTab, selectedVideoId]);

  // 1. Index a newly discovered video from search or channel crawl
  const handleIndexVideo = async (video: VideoMetadata) => {
    await idbService.saveVideo(video);

    // Register the channel from real YouTube data if it is not tracked yet.
    // Non-YouTube sources have no YouTube channel to look up.
    const isYouTube = video.sourceFlags.some(
      (flag) => flag === 'YouTubeSearch' || flag === 'ChannelUploads'
    );
    const existingChan = channels.find((c) => c.channelId === video.channelId);
    if (isYouTube && !existingChan && accessToken) {
      try {
        const realChan = await YouTubeApiClient.getChannelById(accessToken, video.channelId);
        if (realChan) await idbService.saveChannel(realChan);
      } catch (err) {
        console.error('Failed to fetch channel metadata from YouTube API:', err);
      }
    }

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
    showToast(`Saved "${video.title.slice(0, 30)}..." to your library!`);
  };

  // 2. Collect a channel's uploads
  const handleExpandChannel = async (channelId: string, channelTitle: string) => {
    if (!accessToken) {
      showToast('Sign in with Google to collect channel videos from YouTube.', 'info');
      return;
    }

    try {
      // Save the channel record too, not just its videos: a channel reached from
      // a search result has no record yet, so without this it never shows up on
      // the Channels page.
      const result = await expandChannel(channelId, channelTitle, {
        store: idbService,
        fetchUploads: (id) => YouTubeApiClient.getChannelUploads(accessToken, id),
        fetchChannel: (id) => YouTubeApiClient.getChannelById(accessToken, id),
      });

      await refreshLibraryData();
      showToast(
        result.channelCreated
          ? `Added channel "${channelTitle}" and imported ${result.videoCount} videos!`
          : `Imported ${result.videoCount} videos from "${channelTitle}"!`
      );
    } catch (err: any) {
      console.error('Channel collection failed:', err);
      showToast(`Channel collection failed: ${err.message}`, 'info');
    }
  };

  // 3. Update notes, score, rating and tags
  const handleUpdatePersonal = async (youtubeId: string, personal: Partial<PersonalMetadata>) => {
    await idbService.updatePersonalMetadata(youtubeId, personal);
    await refreshLibraryData();
  };

  // 3b. Open the "remove video" dialog for a specific video
  const handleRequestRemoval = (youtubeId: string) => {
    const video = videos.find((v) => v.youtubeId === youtubeId);
    if (!video) {
      showToast('That video is not in your library.', 'info');
      return;
    }
    setVideoPendingRemoval(video);
  };

  // 3c. Remove a video and record why, so future selection can learn from it
  const handleConfirmRemoval = async (request: RemovalRequest) => {
    const video = videoPendingRemoval;
    if (!video) return;

    const removal: VideoRemoval = {
      id: crypto.randomUUID(),
      youtubeId: video.youtubeId,
      video,
      reason: request.reason,
      note: request.note,
      removedAt: new Date().toISOString(),
      appliedToProfile: request.applyToProfile,
    };

    await idbService.removeVideoWithReason(removal);

    const job: CrawlJob = {
      id: crypto.randomUUID(),
      type: 'search',
      status: 'completed',
      queryOrTarget: `Removed: ${video.title}`,
      itemsFound: 1,
      progressPct: 100,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    await idbService.addCrawlJob(job);

    setVideoPendingRemoval(null);
    if (selectedVideoId === video.youtubeId) {
      setSelectedVideoId('');
      setEphemeralVideo(null);
    }
    await refreshLibraryData();

    const meta = getRemovalReason(request.reason);
    showToast(
      request.applyToProfile
        ? `Removed "${video.title.slice(0, 24)}..." (${meta.label}). Future selection updated.`
        : `Removed "${video.title.slice(0, 24)}..." (${meta.label}).`
    );
  };

  // 3d. Undo a removal: put the video back and drop its reason
  const handleRestoreRemoval = async (removalId: string) => {
    const restored = await idbService.restoreRemoval(removalId);
    await refreshLibraryData();
    if (restored) {
      setEphemeralVideo(null);
      setSelectedVideoId(restored.youtubeId);
      showToast(`Restored "${restored.video.title.slice(0, 24)}..." to your library.`);
    }
  };

  // 3e. Forget a removal without restoring: it stops influencing selection
  const handleForgetRemoval = async (removalId: string) => {
    await idbService.forgetRemoval(removalId);
    await refreshLibraryData();
    showToast('Removal forgotten. It no longer affects future selection.');
  };

  // 4. Collect real comments for a video from YouTube
  const handleHarvestComments = async (youtubeId: string) => {
    if (!accessToken) {
      showToast('Sign in with Google to collect comments.', 'info');
      return;
    }

    try {
      const harvested = await YouTubeApiClient.getVideoComments(accessToken, youtubeId);
      for (const comm of harvested) {
        await idbService.saveComment(comm);
      }

      const job: CrawlJob = {
        id: crypto.randomUUID(),
        type: 'comment_harvest',
        status: 'completed',
        queryOrTarget: `Comments for ${youtubeId}`,
        itemsFound: harvested.length,
        progressPct: 100,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      await idbService.addCrawlJob(job);

      await refreshLibraryData();
      showToast(`Collected ${harvested.length} comments from YouTube.`);
    } catch (err: any) {
      console.error('Comment collection failed:', err);
      showToast(`Comment collection failed: ${err.message}`, 'info');
    }
  };

  // 5. Select a video to play. Selecting opens the dedicated video page; the
  // Videos listing is shown when nothing is selected. A video already in the
  // library plays from there; one that is not (a search result the user has not
  // saved) plays from the transient selection so watching never adds it.
  const handleSelectVideo = (youtubeId: string) => {
    setEphemeralVideo(null);
    // Opening from the library (or any list that did not supply a queue) walks
    // the library order, so clear any queue left over from a previous play.
    setPlayerQueue([]);
    setQueueLabel('');
    setSelectedVideoId(youtubeId);
    setCurrentTab('player');
  };

  // Leave the dedicated video page and return to the Videos listing.
  const handleBackToVideos = () => {
    setEphemeralVideo(null);
    setPlayerQueue([]);
    setQueueLabel('');
    setSelectedVideoId('');
  };

  // Open the Setup Wizard, optionally forcing the step it starts on. Leaving the
  // wizard clears the forced step, otherwise a later visit would resume on
  // whatever step the last token replacement used.
  const openWizard = (step?: number) => {
    setWizardStep(step);
    setCurrentTab('wizard');
  };

  const navigate = (tab: PageTab) => {
    if (tab !== 'wizard') setWizardStep(undefined);
    // Opening Videos from the nav shows the listing, not the last video.
    if (tab === 'player') {
      setEphemeralVideo(null);
      setPlayerQueue([]);
      setQueueLabel('');
      setSelectedVideoId('');
    }
    setCurrentTab(tab);
  };

  // 5b. Play a video that may not be in the library yet without saving it: hold
  // it as the transient selection and open the player. It is added to the
  // library only when the user presses "Save to Library".
  //
  // `queue` is the list the video was played from (the search results or the
  // catalogue), so prev/next walks that list — whether or not the played video
  // happens to be saved already.
  const handlePlayVideo = (video: VideoMetadata, queue: VideoMetadata[] = [], label = '') => {
    setPlayerQueue(queue);
    setQueueLabel(label);
    // A saved video plays from the library copy; an unsaved one is held
    // transiently. Either way the queue is the list it was played from.
    setEphemeralVideo(videos.some((v) => v.youtubeId === video.youtubeId) ? null : video);
    setSelectedVideoId(video.youtubeId);
    setCurrentTab('player');
  };

  // 5b-ii. Move within the current queue (the player's prev/next). The target
  // may be unsaved, so it is resolved from the queue rather than the library;
  // saving stays explicit.
  const handleNavigateQueue = (youtubeId: string) => {
    setSelectedVideoId(youtubeId);
  };

  // 5b-iii. Play a related video shown under the player. It is appended to the
  // queue so prev/next keeps working afterwards; when the player was walking the
  // library (no explicit queue) the related video joins that order.
  const handlePlayRelated = (video: VideoMetadata) => {
    setPlayerQueue((prev) => {
      const base = prev.length > 0 ? prev : videos;
      return base.some((v) => v.youtubeId === video.youtubeId) ? prev : [...base, video];
    });
    setQueueLabel((prev) => prev || 'Library');
    setEphemeralVideo(videos.some((v) => v.youtubeId === video.youtubeId) ? null : video);
    setSelectedVideoId(video.youtubeId);
  };

  // 5c. Save the video currently being watched to the library.
  const handleSaveToLibrary = async (video: VideoMetadata) => {
    await handleIndexVideo(video);
    setEphemeralVideo(video);
  };

  // 6. Update the video's saved summary
  const handleUpdateAiSummary = async (youtubeId: string, aiSummary: string) => {
    await idbService.updateVideoAiSummary(youtubeId, aiSummary);
    await refreshLibraryData();
    showToast('Summary saved to your notes.');
  };

  // Google Auth Handlers
  const handleAuthSuccess = (authUser: User, token: string) => {
    setUser(authUser);
    setAccessToken(token);
    setCachedAccessToken(token);
    setCurrentTab('dashboard');
    showToast(`Welcome, ${authUser.displayName || authUser.email}! YouTube and AI features are ready.`);
  };

  // Re-acquire a YouTube OAuth token without a full sign-out (e.g. after a reload)
  const handleReconnect = async () => {
    try {
      const token = await refreshGoogleAccessToken();
      setAccessToken(token);
      setCachedAccessToken(token);
      showToast('YouTube access reconnected. Live data enabled.');
    } catch (err: any) {
      console.error('Reconnect failed:', err);
      showToast(`Reconnect failed: ${err?.message || 'Google did not return a token.'}`, 'info');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAccessToken(null);
    setCachedAccessToken(null);
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

  // A video is only "selected" when the user picked one. The Videos page shows
  // its listing while this is null; the dedicated page renders when it is set.
  // The video may be in the library or only being watched, so the two are
  // resolved together.
  const playerSelection = resolvePlayerSelection(videos, selectedVideoId, ephemeralVideo, playerQueue);
  const currentVideo = playerSelection.video;
  const currentVideoComments = comments.filter((c) => c.videoId === selectedVideoId);
  const indexedVideoIds = new Set(videos.map((v) => v.youtubeId));

  // The list the player walks with prev/next: the queue it was played from, or
  // the library when it was opened from the library (or by a deep link).
  const queueVideos = playerQueue.length > 0 ? playerQueue : videos;
  const queueVideosLabel = playerQueue.length > 0 ? queueLabel : 'Library';

  // Related videos under the player. They are scored from the current queue,
  // then topped up from the baked catalogue so the section is rarely thin. The
  // current video and its immediate prev/next neighbours are excluded, so the
  // section shows videos the nav buttons do not already reach.
  const relatedVideos = React.useMemo(() => {
    if (!currentVideo) return [];
    const index = queueVideos.findIndex((v) => v.youtubeId === currentVideo.youtubeId);
    const neighbours = [
      index > 0 ? queueVideos[index - 1] : null,
      index >= 0 && index < queueVideos.length - 1 ? queueVideos[index + 1] : null,
    ].filter((v): v is VideoMetadata => v !== null);

    const seen = new Set<string>();
    const pool: VideoMetadata[] = [];
    for (const video of [...queueVideos, ...loadBakedCatalogVideos()]) {
      if (seen.has(video.youtubeId)) continue;
      seen.add(video.youtubeId);
      pool.push(video);
    }

    return findRelatedVideos(currentVideo, { pool, exclude: neighbours, limit: 6 });
  }, [currentVideo, queueVideos]);

  // The taste profile is derived from the removal log, so restoring or
  // forgetting a removal immediately changes what discovery demotes.
  const tasteProfile: TasteProfile = React.useMemo(() => buildTasteProfile(removals), [removals]);

  return (
    <div className="h-screen ct-app-bg text-slate-100 flex flex-col selection:bg-orange-500/30 selection:text-orange-200">
      {/* Top Navbar */}
      <Header
        onOpenWizard={() => openWizard()}
        onOpenSearch={() => setCurrentTab('search')}
        videoCount={videos.length}
        user={user}
        onAuthSuccess={handleAuthSuccess}
        onLogout={handleLogout}
        onImportMyChannel={handleImportMyChannel}
        onReconnect={handleReconnect}
        isTokenConnected={!!accessToken}
        isImporting={isImportingChannel}
      />

      {/* Main Layout: Sidebar + Content Area.
          On desktop the shell is a fixed-height app frame (h-screen above) and
          only <main> scrolls, so the sidebar stays put and scrolls on its own.
          On mobile the wrapper keeps its natural height and the page scrolls. */}
      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden md:min-h-0">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={navigate}
          videoCount={videos.length}
          channelCount={channels.length}
          commentCount={comments.length}
          removalCount={removals.length}
          isLoggedIn={isLoggedIn}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto md:min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-mono text-slate-400">Loading your library...</p>
              </div>
            </div>
          ) : !isLoggedIn ? (
            <LandingSplashView onAuthSuccess={handleAuthSuccess} />
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView
                  videos={videos}
                  channels={channels}
                  commentCount={comments.length}
                  onSelectVideo={handleSelectVideo}
                  onNavigate={setCurrentTab}
                  onRequestRemoval={handleRequestRemoval}
                />
              )}

              {currentTab === 'search' && (
                <SearchView
                  onIndexVideo={handleIndexVideo}
                  onExpandChannel={handleExpandChannel}
                  onPlayVideo={handlePlayVideo}
                  indexedVideoIds={indexedVideoIds}
                  accessToken={accessToken}
                  userEmail={user?.email}
                  tasteProfile={tasteProfile}
                />
              )}

              {currentTab === 'vega' && (
                <VegaSourceView
                  onIndexVideo={handleIndexVideo}
                  onPlayVideo={handlePlayVideo}
                  indexedVideoIds={indexedVideoIds}
                />
              )}

              {currentTab === 'player' && (
                <VideosPage
                  selectedVideo={currentVideo}
                  isInLibrary={playerSelection.isInLibrary}
                  onSaveToLibrary={handleSaveToLibrary}
                  allVideos={videos}
                  queue={queueVideos}
                  queueLabel={queueVideosLabel}
                  relatedVideos={relatedVideos}
                  indexedVideoIds={indexedVideoIds}
                  comments={currentVideoComments}
                  onSelectVideo={handleSelectVideo}
                  onNavigateQueue={handleNavigateQueue}
                  onPlayRelated={handlePlayRelated}
                  onUpdatePersonal={handleUpdatePersonal}
                  onHarvestComments={handleHarvestComments}
                  onUpdateAiSummary={handleUpdateAiSummary}
                  onRequestRemoval={handleRequestRemoval}
                  onBackToVideos={handleBackToVideos}
                />
              )}

                {currentTab === 'editor' && (
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center h-64">
                        <div className="text-center space-y-3">
                          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-xs font-mono text-slate-400">Loading the editor…</p>
                        </div>
                      </div>
                    }
                  >
                    <EditorView videos={videos} />
                  </Suspense>
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
                    showToast(`Channel "${chan.title}" added to your library!`);
                  }}
                />
              )}

              {currentTab === 'comments' && (
                <CommentsView
                  comments={comments}
                  videos={videos}
                  onSelectVideo={handleSelectVideo}
                  onHarvestMore={() => {
                    const target = currentVideo ?? videos[0] ?? null;
                    if (target) handleHarvestComments(target.youtubeId);
                  }}
                />
              )}

              {currentTab === 'ratings' && (
                <RatingsNotesView
                  videos={videos}
                  onSelectVideo={handleSelectVideo}
                  onUpdatePersonal={handleUpdatePersonal}
                  onRequestRemoval={handleRequestRemoval}
                />
              )}

              {currentTab === 'removals' && (
                <RemovalsView
                  removals={removals}
                  profile={tasteProfile}
                  onRestore={handleRestoreRemoval}
                  onForget={handleForgetRemoval}
                />
              )}

              {currentTab === 'wizard' && (
                <SetupWizardView
                  initialStep={wizardStep}
                  onComplete={() => {
                    setWizardStep(undefined);
                    setCurrentTab('dashboard');
                    showToast('CloudTube is fully set up and ready to use!');
                  }}
                />
              )}

              {currentTab === 'scaffolding' && <ScaffoldingExplorerView />}

              {currentTab === 'settings' && (
                <SettingsView
                  onRefreshData={refreshLibraryData}
                  videoCount={videos.length}
                  onNavigate={navigate}
                  onUpdateToken={() => openWizard(1)}
                  onOpenWizardStep={(step) => openWizard(step)}
                  isYouTubeConnected={!!accessToken}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Offline Notification */}
      <OfflineIndicator />

      {/* Remove Video dialog: captures the reason used to tune future selection */}
      {videoPendingRemoval && (
        <RemoveVideoModal
          video={videoPendingRemoval}
          onClose={() => setVideoPendingRemoval(null)}
          onConfirm={handleConfirmRemoval}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 border border-orange-500/50 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="break-words">
            {splitLinks(toastMessage.text).map((part, i) =>
              part.url ? (
                <a
                  key={i}
                  href={part.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300 underline underline-offset-2 break-all"
                >
                  {part.text}
                </a>
              ) : (
                <React.Fragment key={i}>{part.text}</React.Fragment>
              )
            )}
          </span>
        </div>
      )}
    </div>
  );
}
