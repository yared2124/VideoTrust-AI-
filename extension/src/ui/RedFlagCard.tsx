import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface InsightCardProps {
  type: 'redflag' | 'praise';
  text: string;
}

export const RedFlagCard: React.FC<InsightCardProps> = ({ type, text }) => {
  const isRedFlag = type === 'redflag';

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
      <p className="text-[13px] leading-snug font-normal">
        {text}
      </p>
    </div>
  );
};
