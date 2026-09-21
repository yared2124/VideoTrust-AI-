import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Check,
  ExternalLink,
  Info,
} from 'lucide-react';
import type { CompleteAnalysisReport } from '../types/index.js';
import { RadialGauge } from './RadialGauge.js';
import { RedFlagCard } from './RedFlagCard.js';

interface SlidingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  report: CompleteAnalysisReport | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

type TabType = 'overview' | 'audience' | 'metrics';

export const SlidingDrawer: React.FC<SlidingDrawerProps> = ({
  isOpen,
  onClose,
  report,
  onRefresh,
  isRefreshing = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [feedbackVote, setFeedbackVote] = useState<'agree' | 'disagree' | null>(null);

  // Trap Escape key & prevent YouTube keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      // Stop space, k, j, l, f, m from triggering YouTube player while in drawer
      if (['Space', 'KeyK', 'KeyJ', 'KeyL', 'KeyF', 'KeyM'].includes(e.code)) {
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  // Reset feedback state when video changes
  useEffect(() => {
    setFeedbackSubmitted(false);
    setFeedbackVote(null);
  }, [report?.videoId]);

  if (!isOpen || !report) return null;

  const { verdict, scoreBreakdown, insights, metadata, telemetry } = report;

  const getVerdictStyle = () => {
    switch (verdict.recommendation) {
      case 'WATCH':
        return {
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          title: 'Safe to Watch',
          desc: 'High community trust, authentic discussion, matches claims.',
        };
      case 'MAYBE':
        return {
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          title: 'Caution Advised',
          desc: 'Mixed community signals, promotional links, or missing steps.',
        };
      case 'SKIP':
        return {
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          title: 'Clickbait / Misleading',
          desc: 'Significant divergence from title, high spam or audience warnings.',
        };
    }
  };

  const verdictStyle = getVerdictStyle();

  const handleFeedback = (agree: boolean) => {
    setFeedbackVote(agree ? 'agree' : 'disagree');
    setFeedbackSubmitted(true);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SUBMIT_FEEDBACK',
        payload: {
          videoId: report.videoId,
          isHelpful: true,
          agreedWithVerdict: agree,
        },
      });
    }
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return createPortal(
    <div id="vt-drawer-portal" className="font-sans antialiased text-slate-100">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[2147483646] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sliding Drawer Container */}
      <aside
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[440px] bg-[#0B0F19]/98 backdrop-blur-2xl border-l border-white/10 z-[2147483647] shadow-2xl flex flex-col text-slate-100 font-sans transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        role="dialog"
        aria-modal="true"
        aria-label="VideoTrust AI Intelligence Report"
      >
        {/* Header Zone */}
        <header className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#0A0D14]/90">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white">VideoTrust AI</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                {metadata.channelTitle || 'YouTube Creator'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs"
              title="Close drawer (Esc)"
            >
              <X className="h-4 w-4" />
              <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">ESC</span>
            </button>
          </div>
        </header>

        {/* Video Title Banner */}
        <div className="px-4 py-2.5 bg-slate-900/60 border-b border-white/5 text-xs text-slate-300 truncate">
          <span className="text-slate-400 mr-1.5">Video:</span>
          <span className="font-medium text-white">{metadata.title}</span>
        </div>

        {/* Main Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Verdict Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-800/50 to-slate-900/80 border border-white/10 p-4 shadow-lg">
            <div className="flex items-center gap-4">
              <RadialGauge
                score={verdict.trustScore}
                recommendation={verdict.recommendation}
                size={76}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${verdictStyle.badge}`}
                  >
                    {verdict.recommendation}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {(verdict.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white leading-tight">
                  {verdictStyle.title}
                </h3>
                <p className="text-[12px] text-slate-300 mt-1 leading-snug line-clamp-2">
                  {verdictStyle.desc}
                </p>
              </div>
            </div>

            {/* Clickbait divergence telemetry chip */}
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Clickbait Divergence:</span>
              <span
                className={`font-mono font-semibold ${
                  verdict.isClickbait ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {verdict.isClickbait ? '⚠️ ' : '✓ '}
                {(verdict.clickbaitDivergence * 100).toFixed(0)}%
                {verdict.isClickbait ? ' (High)' : ' (Low)'}
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex rounded-lg bg-slate-950/70 p-1 border border-white/10">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('audience')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'audience'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Audience Truth
              {insights.audienceRedFlags.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/30 text-rose-300 font-mono">
                  {insights.audienceRedFlags.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'metrics'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Metrics
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Executive Summary */}
              <div className="rounded-lg bg-slate-900/50 border border-white/10 p-3.5">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-indigo-400" />
                  Video Summary
                </h4>
                <p className="text-[13px] text-slate-200 leading-relaxed">
                  {insights.summaryShort || 'No summary available.'}
                </p>
              </div>

              {/* 5-Bullet Key Takeaways */}
              {insights.keyTakeaways && insights.keyTakeaways.length > 0 && (
                <div className="rounded-lg bg-slate-900/50 border border-white/10 p-3.5">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
                    Key Takeaways
                  </h4>
                  <ul className="space-y-2">
                    {insights.keyTakeaways.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[12.5px] text-slate-300 leading-normal">
                        <span className="text-indigo-400 mt-1 shrink-0 font-bold">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Video Telemetry Stats */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-900/40 border border-white/5 p-2.5">
                  <span className="text-slate-400 block">Views / Likes</span>
                  <span className="font-mono text-white font-medium text-xs mt-0.5">
                    {formatNumber(metadata.views)} / {formatNumber(metadata.likes)}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-900/40 border border-white/5 p-2.5">
                  <span className="text-slate-400 block">Comments Sampled</span>
                  <span className="font-mono text-white font-medium text-xs mt-0.5">
                    {telemetry.commentsSampled} comments
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIENCE TRUTH */}
          {activeTab === 'audience' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Red Flags Section */}
              <div>
                <h4 className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                  Community Red Flags ({insights.audienceRedFlags.length})
                </h4>
                {insights.audienceRedFlags.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 rounded bg-slate-900/30 border border-white/5">
                    No community red flags detected. The comments are overwhelmingly positive.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {insights.audienceRedFlags.map((flag, idx) => (
                      <RedFlagCard key={idx} type="redflag" text={flag} />
                    ))}
                  </div>
                )}
              </div>

              {/* Top Audience Praise */}
              <div>
                <h4 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Audience Highlights ({insights.topAudiencePraise.length})
                </h4>
                {insights.topAudiencePraise.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 rounded bg-slate-900/30 border border-white/5">
                    No notable audience praise highlights found.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {insights.topAudiencePraise.map((praise, idx) => (
                      <RedFlagCard key={idx} type="praise" text={praise} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: METRICS */}
          {activeTab === 'metrics' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {[
                {
                  label: 'Authenticity',
                  score: scoreBreakdown.authenticity,
                  sub: 'Bot rings, spam patterns & duplicate copy detection',
                },
                {
                  label: 'Sentiment',
                  score: scoreBreakdown.sentiment,
                  sub: 'Ratio of viewer helpfulness vs complaints & corrections',
                },
                {
                  label: 'Integrity',
                  score: scoreBreakdown.integrity,
                  sub: 'Consistency between title claims and video content',
                },
                {
                  label: 'Engagement',
                  score: scoreBreakdown.engagement,
                  sub: 'Like-to-view ratio and community discussion depth',
                },
              ].map((item, idx) => {
                const barColor =
                  item.score >= 70
                    ? 'bg-emerald-500'
                    : item.score >= 45
                    ? 'bg-amber-500'
                    : 'bg-rose-500';

                return (
                  <div
                    key={idx}
                    className="rounded-lg bg-slate-900/50 border border-white/10 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white">{item.label}</span>
                      <span className="font-mono text-xs font-bold text-slate-200">
                        {item.score}%
                      </span>
                    </div>
                    {/* Progress Track */}
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.max(4, item.score)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">{item.sub}</p>
                  </div>
                );
              })}

              <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between px-1">
                <span>Analyzed At: {new Date(telemetry.analyzedAt).toLocaleDateString()}</span>
                <span>{telemetry.isCached ? '⚡ Cached (Sub-15ms)' : 'Fresh Analysis'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Zone: Feedback Loop */}
        <footer className="p-3.5 border-t border-white/10 bg-[#0A0D14]/90 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Was this accurate?</span>

            {feedbackSubmitted ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <Check className="h-4 w-4" />
                <span>Thanks! Recorded {feedbackVote === 'agree' ? '👍' : '👎'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFeedback(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 text-xs transition-colors"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Agree
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 text-xs transition-colors"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Disagree
                </button>
              </div>
            )}
          </div>
        </footer>
      </aside>
    </div>,
    document.body
  );
};
