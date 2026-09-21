import React from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface InsightCardProps {
  type: 'redflag' | 'praise';
  text: string;
}

export const RedFlagCard: React.FC<InsightCardProps> = ({ type, text }) => {
  const isRedFlag = type === 'redflag';

  // Parse potential timestamp like [⏱️ 5:40] or 05:40
  const timeRegex = /\[⏱️\s*(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\]|\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/;
  const match = text.match(timeRegex);

  let timestampSeconds: number | null = null;
  let timestampLabel = '';
  let displayText = text;

  if (match) {
    const raw = match[0];
    const cleanTime = raw.replace(/[\[\]⏱️\s]/g, '');
    const parts = cleanTime.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      timestampSeconds = parts[0] * 60 + parts[1];
      timestampLabel = cleanTime;
    } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      timestampSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      timestampLabel = cleanTime;
    }

    // Clean leading [⏱️ ...] from text if present
    displayText = text.replace(/\[⏱️\s*[^\]]+\]\s*/, '').replace(/^⚠️\s*/, '');
  } else {
    displayText = text.replace(/^⚠️\s*/, '');
  }

  const handleSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timestampSeconds !== null) {
      window.dispatchEvent(
        new CustomEvent('vt-seek-video', { detail: { seconds: timestampSeconds } })
      );
    }
  };

  return (
    <div
      className={`group relative flex items-start gap-2.5 rounded-lg p-3 transition-all duration-200 ${
        isRedFlag
          ? 'bg-rose-500/10 border border-rose-500/25 text-rose-200 hover:border-rose-500/40 hover:bg-rose-500/15'
          : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 hover:border-emerald-500/40 hover:bg-emerald-500/15'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {isRedFlag ? (
          <AlertTriangle className="h-4 w-4 text-rose-400" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-snug font-normal">
          {displayText}
        </p>

        {timestampSeconds !== null && (
          <div className="mt-2">
            <button
              onClick={handleSeek}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-500/30 text-indigo-300 text-[11px] font-mono transition-colors shadow-sm cursor-pointer"
              title={`Jump directly to ${timestampLabel} in YouTube video`}
            >
              <Clock className="h-3 w-3 text-indigo-400" />
              <span>Jump to {timestampLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
