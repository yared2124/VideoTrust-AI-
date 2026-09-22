import React, { useState, useEffect, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { CompleteAnalysisReport } from '../types/index.js';
import { getCachedReport, setCachedReport } from '../utils/storage.js';
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
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        throw new Error('Chrome runtime unavailable');
      }

      chrome.runtime.sendMessage(
        {
          type: 'ANALYZE_VIDEO',
          payload: { videoId: id, forceRefresh },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            setError(chrome.runtime.lastError.message || 'Worker connection failed');
            setIsLoading(false);
            return;
          }

          if (!response || !response.success) {
            setError(response?.error || 'Analysis failed');
            setIsLoading(false);
            return;
          }

          const reportData: CompleteAnalysisReport = response.data;
          setReport(reportData);
          setIsLoading(false);

          // Persist to local cache for 24h
          setCachedReport(id, reportData).catch(() => {});
        }
      );
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
  let host = document.getElementById('vt-global-drawer');
  if (!host) {
    host = document.createElement('div');
    host.id = 'vt-global-drawer';
    document.body.appendChild(host);
  }
  globalDrawerRoot = createRoot(host);
  globalDrawerRoot.render(<GlobalDrawerHost />);
}

// ============================================================================
// DOM INJECTION & YOUTUBE SPA OBSERVER
// ============================================================================

const VT_ROOT_ID = 'vt-root';
let reactRoot: Root | null = null;
let currentVideoId: string | null = null;

function getVideoIdFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

/**
 * Locate the optimal injection anchor in YouTube's DOM.
 */
function findInjectionTarget(): HTMLElement | null {
  const selectors = [
    '#owner #subscribe-button',
    '#subscribe-button',
    '#top-row #owner',
    '#owner.ytd-watch-metadata',
    'ytd-watch-metadata #owner',
    '#actions-inner',
    '#above-the-fold #title',
  ];

  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && el.isConnected) {
      return el;
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
      reactRoot.unmount();
      reactRoot = null;
      document.getElementById(VT_ROOT_ID)?.remove();
    }
    currentVideoId = null;
    return;
  }

  // If video changed, notify existing mounted React component
  if (currentVideoId && currentVideoId !== videoId) {
    currentVideoId = videoId;
    window.dispatchEvent(
      new CustomEvent('vt-video-changed', { detail: { videoId } })
    );
  }

  // Check if our container already exists and is attached
  let container = document.getElementById(VT_ROOT_ID);
  if (container && container.isConnected) {
    return;
  }

  // Find target anchor in YouTube DOM
  const target = findInjectionTarget();
  if (!target) {
    return;
  }

  // Create clean host container
  if (!container) {
    container = document.createElement('div');
    container.id = VT_ROOT_ID;
  }

  // Insert next to the target element (after subscribe button or next to owner)
  if (target.nextSibling) {
    target.parentNode?.insertBefore(container, target.nextSibling);
  } else {
    target.parentNode?.appendChild(container);
  }

  // Mount React Root
  if (!reactRoot) {
    currentVideoId = videoId;
    reactRoot = createRoot(container);
    reactRoot.render(<App initialVideoId={videoId} />);
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
    if (!thumb) continue;

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
  }
}

// 1. Listen for YouTube's custom navigation events (SPA routing)
window.addEventListener('yt-navigate-finish', () => {
  setTimeout(() => {
    injectWidget();
    scanVideoCards();
  }, 400);
});

window.addEventListener('yt-page-data-updated', () => {
  setTimeout(() => {
    injectWidget();
    scanVideoCards();
  }, 400);
});

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
  }, 400);
});

// Start observing document body
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// Initial execution
setTimeout(() => {
  injectWidget();
  scanVideoCards();
}, 600);

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
