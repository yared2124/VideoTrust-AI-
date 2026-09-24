import React, { useState, useEffect, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { CompleteAnalysisReport } from '../types/index.js';
import { getCachedReport, setCachedReport } from '../utils/storage.js';
import { sendMessage } from '../utils/messaging.js';
import { TrustBadge } from '../ui/TrustBadge.js';
import { MiniBadge } from '../ui/MiniBadge.js';
import { SlidingDrawer } from '../ui/SlidingDrawer.js';
import './content.css';

console.log('[VideoTrust AI] Content script loaded on YouTube.');

/**
 * Root React application component injected into YouTube Watch DOM.
 */
const App: React.FC<{ initialVideoId: string }> = ({ initialVideoId }) => {
  const [videoId, setVideoId] = useState<string>(initialVideoId);
  const [report, setReport] = useState<CompleteAnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async (id: string, forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    // 1. Check local storage cache first
    if (!forceRefresh) {
      const localCached = await getCachedReport(id);
      if (localCached) {
        setReport(localCached);
        setIsLoading(false);
        return;
      }
    }

    // 2. Request analysis via background service worker
    try {
      const response = await sendMessage({
        type: 'ANALYZE_VIDEO',
        payload: { videoId: id, forceRefresh },
      });

      // null means the extension context was invalidated — fail silently
      if (response === null) {
        setError('Extension context invalidated — please refresh the tab.');
        setIsLoading(false);
        return;
      }

      if (!response.success) {
        setError(response.error || 'Analysis failed');
        setIsLoading(false);
        return;
      }

      const reportData: CompleteAnalysisReport = response.data;
      setReport(reportData);
      setIsLoading(false);

      // Persist to local cache for 24h
      setCachedReport(id, reportData).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to request analysis');
      setIsLoading(false);
    }
  }, []);

  // Fetch when videoId changes
  useEffect(() => {
    if (videoId) {
      fetchAnalysis(videoId);
    }
  }, [videoId, fetchAnalysis]);

  // Listen for custom video change events dispatched by the SPA observer
  useEffect(() => {
    const handleVideoChange = (event: CustomEvent<{ videoId: string }>) => {
      if (event.detail?.videoId && event.detail.videoId !== videoId) {
        setVideoId(event.detail.videoId);
      }
    };

    window.addEventListener('vt-video-changed' as any, handleVideoChange as EventListener);
    return () => {
      window.removeEventListener('vt-video-changed' as any, handleVideoChange as EventListener);
    };
  }, [videoId]);

  return (
    <TrustBadge
      report={report}
      isLoading={isLoading}
      error={error}
      onRetry={() => fetchAnalysis(videoId, true)}
    />
  );
};

// ============================================================================
// GLOBAL DRAWER HOST (Opens drawer from anywhere: Search, Home, or Watch)
// ============================================================================

const GlobalDrawerHost: React.FC = () => {
  const [drawerReport, setDrawerReport] = useState<CompleteAnalysisReport | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = (e: CustomEvent<{ report: CompleteAnalysisReport }>) => {
      if (e.detail?.report) {
        setDrawerReport(e.detail.report);
        setIsOpen(true);
      }
    };

    window.addEventListener('vt-open-drawer' as any, handleOpen as EventListener);
    return () => {
      window.removeEventListener('vt-open-drawer' as any, handleOpen as EventListener);
    };
  }, []);

  return (
    <SlidingDrawer
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      report={drawerReport}
    />
  );
};

let globalDrawerRoot: Root | null = null;
function initGlobalDrawerHost() {
  if (globalDrawerRoot) return;
  if (typeof document === 'undefined' || !document.body) return;
  let host = document.getElementById('vt-global-drawer');
  if (!host) {
    host = document.createElement('div');
    host.id = 'vt-global-drawer';
    document.body.appendChild(host);
  }
  try {
    globalDrawerRoot = createRoot(host);
    globalDrawerRoot.render(<GlobalDrawerHost />);
  } catch (err) {
    console.warn('[VideoTrust AI] Error initializing global drawer host:', err);
  }
}

// ============================================================================
// DOM INJECTION & YOUTUBE SPA OBSERVER
// ============================================================================

const VT_ROOT_ID = 'vt-root';
let reactRoot: Root | null = null;
let currentMountedContainer: HTMLElement | null = null;
let currentVideoId: string | null = null;

function getVideoIdFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

/**
 * Locate the optimal injection anchor in YouTube's DOM.
 * Prioritizes the area directly adjacent to the subscribe button.
 *
 * On modern YouTube, `#owner` (under `#top-row`) houses the channel avatar, name,
 * and the Subscribe button at its far right edge. Placing our root immediately
 * AFTER `#owner` positions it directly next to the Subscribe button inside the
 * flexible #top-row header, immune to Polymer component re-renders or overflow clipping.
 */
function findInjectionTarget(): { target: HTMLElement; position: 'after' | 'before' } | null {
  // 1. Primary Target: Directly after #owner (sits directly next to Subscribe button)
  const ownerSelectors = [
    'ytd-watch-metadata #top-row #owner',
    'ytd-watch-metadata #owner',
    '#top-row #owner',
    '#owner.ytd-watch-metadata',
  ];
  for (const selector of ownerSelectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && el.isConnected) {
      return { target: el, position: 'after' };
    }
  }

  // 2. Direct Subscribe Button target
  const subSelectors = [
    '#subscribe-button',
    'ytd-subscribe-button-renderer',
    '#owner #subscribe-button',
  ];
  for (const selector of subSelectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && el.isConnected) {
      return { target: el, position: 'after' };
    }
  }

  // 3. Fallback: Right before #actions (Like/Share row)
  const actionSelectors = [
    'ytd-watch-metadata #top-row #actions',
    '#top-row #actions',
    '#actions.ytd-watch-metadata',
    '#actions-inner',
  ];
  for (const selector of actionSelectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && el.isConnected) {
      return { target: el, position: 'before' };
    }
  }

  // 4. Fallback: Below/next to video title
  const titleSelectors = [
    '#above-the-fold #title',
    '#title.ytd-watch-metadata',
  ];
  for (const selector of titleSelectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && el.isConnected) {
      return { target: el, position: 'after' };
    }
  }

  return null;
}

/**
 * Mount or update the in-page VideoTrust AI widget on YouTube Watch pages.
 */
function injectWidget() {
  initGlobalDrawerHost();
  const videoId = getVideoIdFromUrl();

  // If not on a watch page, clean up watch page root
  if (!videoId) {
    if (reactRoot) {
      try {
        reactRoot.unmount();
      } catch {}
      reactRoot = null;
      document.getElementById(VT_ROOT_ID)?.remove();
    }
    currentMountedContainer = null;
    currentVideoId = null;
    return;
  }

  // Find optimal target anchor in YouTube DOM
  const injection = findInjectionTarget();
  if (!injection) {
    return;
  }

  const { target, position } = injection;

  // Create clean host container if needed
  let container = document.getElementById(VT_ROOT_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = VT_ROOT_ID;
  }

  // Ensure container is in the right location next to the target
  const isCorrectlyPlaced =
    position === 'after'
      ? target.nextSibling === container
      : container.nextSibling === target;

  if (!isCorrectlyPlaced) {
    if (position === 'after') {
      target.parentNode?.insertBefore(container, target.nextSibling);
    } else {
      target.parentNode?.insertBefore(container, target);
    }
  }

  // If container is already mounted with active React root
  if (container.isConnected && currentMountedContainer === container && reactRoot) {
    if (currentVideoId !== videoId) {
      currentVideoId = videoId;
      window.dispatchEvent(
        new CustomEvent('vt-video-changed', { detail: { videoId } })
      );
    }
    return;
  }

  // Clean up previous root if container was detached / re-created by YouTube SPA
  if (reactRoot) {
    try {
      reactRoot.unmount();
    } catch {}
    reactRoot = null;
  }

  // Mount React Root
  try {
    currentVideoId = videoId;
    currentMountedContainer = container;
    reactRoot = createRoot(container);
    reactRoot.render(<App initialVideoId={videoId} />);
  } catch (err) {
    console.warn('[VideoTrust AI] Failed to mount watch widget:', err);
  }
}

/**
 * Scan video cards on Search results, Homepage, and Up-Next sidebar to inject MiniBadges.
 */
function scanVideoCards() {
  initGlobalDrawerHost();

  const cardSelectors = [
    'ytd-video-renderer',
    'ytd-rich-item-renderer',
    'ytd-compact-video-renderer',
  ];

  const cards = document.querySelectorAll<HTMLElement>(cardSelectors.join(','));

  for (const card of cards) {
    if (card.getAttribute('data-vt-mini') === 'true') {
      continue;
    }

    // Find anchor tag with video ID
    const anchor = card.querySelector<HTMLAnchorElement>('a#thumbnail, a#video-title');
    const href = anchor?.getAttribute('href') || '';
    const match = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    const videoId = match ? match[1] : null;

    if (!videoId) continue;

    // Find thumbnail container
    const thumb = card.querySelector<HTMLElement>('ytd-thumbnail, #thumbnail');
    if (!thumb || !thumb.isConnected) continue;

    try {
      card.setAttribute('data-vt-mini', 'true');

      // Make sure thumbnail has relative positioning
      const currentPos = window.getComputedStyle(thumb).position;
      if (currentPos === 'static') {
        thumb.style.position = 'relative';
      }

      // Create mini-badge container
      const overlay = document.createElement('div');
      overlay.className = 'vt-thumbnail-overlay';
      thumb.appendChild(overlay);

      const miniRoot = createRoot(overlay);
      miniRoot.render(<MiniBadge videoId={videoId} />);
    } catch (err) {
      console.warn('[VideoTrust AI] Failed to mount mini badge on card:', err);
    }
  }
}

// 1. Listen for YouTube's custom navigation events (SPA routing)
function scheduleInjection() {
  injectWidget();
  scanVideoCards();
  setTimeout(() => {
    injectWidget();
    scanVideoCards();
  }, 300);
  setTimeout(() => {
    injectWidget();
    scanVideoCards();
  }, 800);
  setTimeout(() => {
    injectWidget();
    scanVideoCards();
  }, 1600);
}

window.addEventListener('yt-navigate-finish', scheduleInjection);
window.addEventListener('yt-page-data-updated', scheduleInjection);

// 2. MutationObserver fallback for dynamic loading, scroll, and Theater Mode
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const videoId = getVideoIdFromUrl();
    if (videoId) {
      const container = document.getElementById(VT_ROOT_ID);
      if (!container || !container.isConnected) {
        injectWidget();
      }
    }
    // Continuously scan newly loaded video cards on search/feed
    scanVideoCards();
  }, 300);
});

// Start observing document body & initial execution safely
function startObserver() {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  scheduleInjection();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserver);
} else {
  startObserver();
}

// Global listener for seeking video to exact timestamp when clicked in drawer
window.addEventListener('vt-seek-video' as any, ((event: CustomEvent<{ seconds: number }>) => {
  const seconds = event.detail?.seconds;
  if (typeof seconds === 'number') {
    const video = document.querySelector<HTMLVideoElement>('video');
    if (video) {
      video.currentTime = seconds;
      video.play().catch(() => {});
    }
  }
}) as EventListener);
