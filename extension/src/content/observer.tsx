import React, { useState, useEffect, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { CompleteAnalysisReport } from '../types/index.js';
import { getCachedReport, setCachedReport } from '../utils/storage.js';
import { TrustBadge } from '../ui/TrustBadge.js';
import './content.css';

console.log('[VideoTrust AI] Content script loaded on YouTube.');

/**
 * Root React application component injected into YouTube DOM.
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
  // Selector priority list for YouTube's evolving DOM
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
 * Mount or update the VideoTrust AI widget in the YouTube DOM.
 */
function injectWidget() {
  const videoId = getVideoIdFromUrl();

  // If not on a watch page, clean up existing root
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

// 1. Listen for YouTube's custom navigation events (SPA routing)
window.addEventListener('yt-navigate-finish', () => {
  setTimeout(injectWidget, 400);
});

window.addEventListener('yt-page-data-updated', () => {
  setTimeout(injectWidget, 400);
});

// 2. MutationObserver fallback for dynamic loading and Theater Mode toggles
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
  }, 500);
});

// Start observing document body
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// Initial injection attempt
setTimeout(injectWidget, 600);

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
