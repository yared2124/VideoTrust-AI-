import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Shield } from 'lucide-react';
import type { CompleteAnalysisReport, Recommendation } from '../types/index.js';
import { SlidingDrawer } from './SlidingDrawer.js';

interface TrustBadgeProps {
  report: CompleteAnalysisReport | null;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({
  report,
  isLoading,
  error,
  onRetry,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 1. Loading State: Displays brand name with clean spinner
  if (isLoading) {
    return (
      <div className="vt-badge-wrapper select-none">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-950/95 border border-indigo-500/50 text-indigo-200 text-sm shadow-lg vt-shimmer">
          <Shield className="h-4 w-4 text-indigo-400 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white tracking-tight text-[13.5px]">VideoTrust AI</span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 leading-none">v1.0</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-white/20 pl-2.5 text-xs text-indigo-300">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            <span>Analyzing...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Retry State: Clear brand badge with retry action
  if (error || !report) {
    return (
      <div className="vt-badge-wrapper select-none">
        <button
          onClick={onRetry}
          className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-950/95 border border-rose-500/50 text-rose-300 text-sm shadow-lg hover:bg-slate-900 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          title={error || 'Could not analyze video. Click to retry.'}
        >
          <Shield className="h-4 w-4 text-rose-400 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white tracking-tight text-[13.5px]">VideoTrust AI</span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-rose-500/25 border border-rose-400/40 text-rose-200 leading-none">v1.0</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-white/20 pl-2.5 text-xs text-rose-300">
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
            <span>Retry</span>
          </div>
        </button>
      </div>
    );
  }

  const { verdict } = report;

  // Compute status badge styles based on recommendation and trustScore
  const getStatusConfig = (recommendation: Recommendation, score: number) => {
    const commentsCount = report.telemetry.commentsSampled;
    const commentsNote = commentsCount > 0
      ? `Verified across ${commentsCount} community comments (up to 2,000 max)`
      : 'Evaluated video metadata, engagement & transcript';

    switch (recommendation) {
      case 'WATCH':
        return {
          dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
          border: 'border-emerald-500/50 hover:border-emerald-400',
          chipBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          glow: 'hover:shadow-[0_0_16px_rgba(16,185,129,0.3)]',
          tooltip: `${score}% Trust Score: ${commentsNote} • Safe to watch.`,
        };
      case 'MAYBE':
        return {
          dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
          border: 'border-amber-500/50 hover:border-amber-400',
          chipBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          glow: 'hover:shadow-[0_0_16px_rgba(245,158,11,0.3)]',
          tooltip: `${score}% Trust Score: ${commentsNote} • Mixed community signals.`,
        };
      case 'SKIP':
        return {
          dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
          border: 'border-rose-500/50 hover:border-rose-400',
          chipBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          glow: 'hover:shadow-[0_0_16px_rgba(244,63,94,0.3)]',
          tooltip: `${score}% Trust Score: Clickbait warning • Significant divergence from title.`,
        };
    }
  };

  const status = getStatusConfig(verdict.recommendation, verdict.trustScore);

  return (
    <>
      <div className="vt-badge-wrapper relative select-none inline-flex items-center">
        <button
          onClick={() => setIsDrawerOpen(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0A0D14]/95 backdrop-blur-md border text-sm text-white transition-all duration-200 cursor-pointer transform hover:scale-[1.03] active:scale-[0.98] shadow-xl ${status.border} ${status.glow}`}
          aria-label={`VideoTrust AI score ${verdict.trustScore}%, recommendation: ${verdict.recommendation}. Click to open full intelligence report.`}
        >
          {/* Status Indicator Pulse Dot */}
          <span className={`h-2.5 w-2.5 rounded-full ${status.dot} animate-pulse shrink-0`} />

          {/* Prominent Brand Name + v1.0 Pill */}
          <div className="flex items-center gap-1.5 font-bold text-slate-100 tracking-tight text-[13.5px]">
            <Shield className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>VideoTrust AI</span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 leading-none">v1.0</span>
          </div>

          {/* Numeric Trust Score */}
          <div className="flex items-center border-l border-white/25 pl-2.5 font-mono font-extrabold text-sm text-white">
            <span>{verdict.trustScore}%</span>
          </div>

          {/* Recommendation Chip (WATCH / MAYBE / SKIP) */}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${status.chipBg}`}
          >
            {verdict.recommendation}
          </span>
        </button>

        {/* Hover Tooltip (Progressive Disclosure) */}
        {isHovered && !isDrawerOpen && (
          <div className="absolute left-0 bottom-full mb-2 z-[99999] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 rounded-lg bg-[#0B0F19]/95 backdrop-blur-md border border-white/15 text-[11px] text-slate-200 shadow-2xl whitespace-nowrap">
              <div className="font-semibold text-white flex items-center gap-1 mb-0.5">
                <Shield className="h-3 w-3 text-indigo-400" />
                <span>VideoTrust AI Report</span>
              </div>
              <div>{status.tooltip}</div>
              <div className="text-[10px] text-indigo-300 mt-1 flex items-center gap-1">
                <span>Click to open full summary & takeaways</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sliding Intelligence Drawer */}
      <SlidingDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        report={report}
        onRefresh={onRetry}
      />
    </>
  );
};
