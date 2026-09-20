import React from 'react';
import type { Recommendation } from '../types/index.js';

interface RadialGaugeProps {
  score: number;
  recommendation?: Recommendation;
  size?: number;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  score,
  recommendation,
  size = 72,
}) => {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const getColor = () => {
    if (recommendation === 'WATCH' || clampedScore >= 75) {
      return {
        stroke: '#10B981', // Emerald-500
        glow: 'rgba(16, 185, 129, 0.35)',
        text: 'text-emerald-400',
      };
    }
    if (recommendation === 'MAYBE' || clampedScore >= 50) {
      return {
        stroke: '#F59E0B', // Amber-500
        glow: 'rgba(245, 158, 11, 0.35)',
        text: 'text-amber-400',
      };
    }
    return {
      stroke: '#F43F5E', // Rose-500
      glow: 'rgba(244, 63, 94, 0.35)',
      text: 'text-rose-400',
    };
  };

  const { stroke, glow, text } = getColor();

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
        style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: 'stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`font-mono text-lg font-bold leading-none ${text}`}>
          {clampedScore}
          <span className="text-[10px] opacity-75">%</span>
        </span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">
          Score
        </span>
      </div>
    </div>
  );
};
