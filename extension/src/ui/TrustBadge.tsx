import React, { useState } from 'react';
import { Sparkles, RefreshCw, AlertCircle, Shield } from 'lucide-react';
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

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="vt-badge-wrapper select-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/30 text-indigo-200 text-xs shadow-md vt-shimmer">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
          <span className="font-medium tracking-tight">Analyzing integrity...</span>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error || !report) {
    return (
      <div className="vt-badge-wrapper select-none">
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-rose-500/40 text-rose-300 text-xs shadow-md hover:bg-slate-800 transition-colors"
          title={error || 'Could not analyze video'}
        >
          <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
          <span className="font-medium">VideoTrust (Retry)</span>
        </button>
      </div>
    );
  }

  const { verdict } = report;

  // Compute status badge styles based on recommendation and trustScore
  const getStatusConfig = (recommendation: Recommendation, score: number) => {
    switch (recommendation) {
      case 'WATCH':
        return {
          dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
          border: 'border-emerald-500/40 hover:border-emerald-400',
          chipBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          glow: 'hover:shadow-[0_0_16px_rgba(16,185,129,0.25)]',
          tooltip: `${score}% Trust: Verified by ${report.telemetry.commentsSampled}+ community comments • Safe to watch.`,
        };
      case 'MAYBE':
        return {
          dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
          border: 'border-amber-500/40 hover:border-amber-400',
          chipBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          glow: 'hover:shadow-[0_0_16px_rgba(245,158,11,0.25)]',
          tooltip: `${score}% Trust: Caution advised • Mixed community signals or missing steps.`,
        };
      case 'SKIP':
        return {
          dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
          border: 'border-rose-500/40 hover:border-rose-400',
          chipBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          glow: 'hover:shadow-[0_0_16px_rgba(244,63,94,0.25)]',
          tooltip: `${score}% Trust: Clickbait warning • Significant divergence from title.`,
        };
    }
  };

  const status = getStatusConfig(verdict.recommendation, verdict.trustScore);

  return (
    <>
      <div className="vt-badge-wrapper relative select-none">
        <button
          onClick={() => setIsDrawerOpen(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A0D14]/90 backdrop-blur-md border text-xs text-white transition-all duration-200 cursor-pointer transform hover:scale-[1.03] active:scale-[0.98] ${status.border} ${status.glow}`}
          aria-label={`VideoTrust score ${verdict.trustScore}%, recommendation: ${verdict.recommendation}. Click to open full intelligence report.`}
        >
          {/* Status Indicator Dot */}
          <span className={`h-2 w-2 rounded-full ${status.dot} animate-pulse`} />

          {/* Numeric Trust Score */}
          <div className="flex items-center gap-1 font-mono font-bold tracking-tight">
            <Shield className="h-3.5 w-3.5 text-indigo-400" />
            <span>{verdict.trustScore}%</span>
          </div>

          {/* Recommendation Chip */}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${status.chipBg}`}
          >
            {verdict.recommendation}
          </span>
        </button>

        {/* Hover Tooltip (Progressive Disclosure Layer 2) */}
        {isHovered && !isDrawerOpen && (
          <div className="absolute left-0 bottom-full mb-2 z-[99999] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 rounded-lg bg-[#0B0F19]/95 backdrop-blur-md border border-white/15 text-[11px] text-slate-200 shadow-xl whitespace-nowrap">
              {status.tooltip}
              <div className="text-[10px] text-indigo-300 mt-0.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Click to view takeaways & red flags
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sliding Intelligence Drawer (Layer 3) */}
      <SlidingDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        report={report}
        onRefresh={onRetry}
      />
    </>
  );
};
