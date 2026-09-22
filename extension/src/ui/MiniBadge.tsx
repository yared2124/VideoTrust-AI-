import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import type { CompleteAnalysisReport, Recommendation } from '../types/index.js';
import { getCachedReport, setCachedReport } from '../utils/storage.js';

interface MiniBadgeProps {
  videoId: string;
}

export const MiniBadge: React.FC<MiniBadgeProps> = ({ videoId }) => {
  const [report, setReport] = useState<CompleteAnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [checkedCache, setCheckedCache] = useState<boolean>(false);

  // Check local and remote cache on mount
  useEffect(() => {
    let isMounted = true;

    async function checkCache() {
      // 1. Check local Chrome storage first (< 5ms)
      const local = await getCachedReport(videoId);
      if (local && isMounted) {
        setReport(local);
        setCheckedCache(true);
        return;
      }

      // 2. Query backend Redis / DB cache
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { type: 'GET_CACHED_REPORT', payload: { videoId } },
          (response) => {
            if (isMounted && response?.success && response.data) {
              setReport(response.data);
              setCachedReport(videoId, response.data).catch(() => {});
            }
            if (isMounted) setCheckedCache(true);
          }
        );
      } else {
        if (isMounted) setCheckedCache(true);
      }
    }

    checkCache();
    return () => {
      isMounted = false;
    };
  }, [videoId]);

  const handleAnalyze = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;
    setIsLoading(true);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: 'ANALYZE_VIDEO', payload: { videoId } },
        (response) => {
          setIsLoading(false);
          if (response?.success && response.data) {
            setReport(response.data);
            setCachedReport(videoId, response.data).catch(() => {});
            // Open drawer with newly analyzed report
            window.dispatchEvent(
              new CustomEvent('vt-open-drawer', { detail: { report: response.data } })
            );
          }
        }
      );
    }
  };

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (report) {
      window.dispatchEvent(
        new CustomEvent('vt-open-drawer', { detail: { report } })
      );
    } else {
      handleAnalyze(e);
    }
  };

  if (!checkedCache) {
    return null; // Silent while checking cache to avoid UI flicker
  }

  // State 1: Loading
  if (isLoading) {
    return (
      <div
        className="vt-mini-badge pointer-events-auto select-none"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950/90 border border-indigo-500/40 text-indigo-300 text-[10.5px] font-mono shadow-md backdrop-blur-md">
          <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
          <span>Analyzing...</span>
        </div>
      </div>
    );
  }

  // State 2: Analyzed & Scored
  if (report) {
    const { verdict } = report;
    const score = verdict.trustScore;

    const getStatusStyle = (rec: Recommendation, s: number) => {
      if (rec === 'WATCH' || s >= 75) {
        return {
          bg: 'bg-[#0A0D14]/90 border-emerald-500/50 text-emerald-300 hover:border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.35)]',
          dot: 'bg-emerald-400',
        };
      }
      if (rec === 'MAYBE' || s >= 50) {
        return {
          bg: 'bg-[#0A0D14]/90 border-amber-500/50 text-amber-300 hover:border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.35)]',
          dot: 'bg-amber-400',
        };
      }
      return {
        bg: 'bg-[#0A0D14]/90 border-rose-500/50 text-rose-300 hover:border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.35)]',
        dot: 'bg-rose-400',
      };
    };

    const style = getStatusStyle(verdict.recommendation, score);

    return (
      <div
        className="vt-mini-badge pointer-events-auto select-none"
        onClick={handleBadgeClick}
        title={`${score}% Trust Score (${verdict.recommendation}). Click to view AI report.`}
      >
        <button
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono font-bold transition-transform hover:scale-105 active:scale-95 backdrop-blur-md cursor-pointer ${style.bg}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot} animate-pulse`} />
          <span>{score}%</span>
          <span className="text-[9px] font-sans font-semibold opacity-85 uppercase tracking-tight">
            {verdict.recommendation}
          </span>
        </button>
      </div>
    );
  }

  // State 3: Unanalyzed (hoverable on-demand score button)
  return (
    <div
      className="vt-mini-badge pointer-events-auto select-none opacity-80 hover:opacity-100 transition-opacity"
      onClick={handleAnalyze}
      title="Click to analyze trust score with VideoTrust AI"
    >
      <button
        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0A0D14]/80 hover:bg-slate-900 border border-white/20 hover:border-indigo-400/60 text-slate-300 hover:text-white text-[10px] font-medium backdrop-blur-md transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
      >
        <Shield className="h-3 w-3 text-indigo-400" />
        <span>Score</span>
      </button>
    </div>
  );
};
