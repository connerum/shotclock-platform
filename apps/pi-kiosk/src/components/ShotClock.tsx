// ShotClock component - Shot clock digit renderer

import { useMemo } from 'react';
import { formatShotClockDisplay } from '@shotclock/shared/timer';

const FINAL_COUNTDOWN_SECONDS = 10;

interface ShotClockProps {
  value: number;
  isWarning?: boolean;
  shouldStrobe?: boolean;
  isExpired?: boolean;
  isRunning?: boolean;
}

export default function ShotClock({ 
  value, 
  isWarning = false, 
  shouldStrobe = false,
  isExpired = false,
  isRunning = false 
}: ShotClockProps) {
  const displayValue = useMemo(() => {
    return formatShotClockDisplay(value);
  }, [value]);

  const colorClass = useMemo(() => {
    if (shouldStrobe || isWarning) return 'text-white';
    if (isExpired) return 'text-red-500';
    return 'text-white';
  }, [shouldStrobe, isWarning, isExpired]);

  const glowClass = useMemo(() => {
    if (shouldStrobe) return 'drop-shadow-[0_0_24px_rgba(239,68,68,0.9)]';
    if (isWarning) return 'drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]';
    if (isExpired) return 'drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]';
    if (isRunning) return 'drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]';
    return '';
  }, [shouldStrobe, isWarning, isExpired, isRunning]);

  const borderColor = useMemo(() => {
    if (shouldStrobe) return '#ffffff';
    if (isExpired) return '#ef4444';
    if (isWarning) return '#facc15';
    return '#374151';
  }, [shouldStrobe, isWarning, isExpired]);

  const countdownBorderProgress = Math.max(
    0,
    Math.min(1, (FINAL_COUNTDOWN_SECONDS - value) / FINAL_COUNTDOWN_SECONDS)
  );
  const countdownBorderVisible = Math.max(0, 1 - countdownBorderProgress);

  return (
    <div className={`relative flex h-full w-full items-center justify-center ${shouldStrobe ? 'shotclock-strobe' : ''} ${glowClass}`}>
      {/* Main display */}
      <div
        className={`font-mono font-black tabular-nums ${colorClass}`}
        style={{
          fontSize: displayValue.includes('.') ? 'min(28cqw, 42cqh)' : 'min(48cqw, 64cqh)',
          lineHeight: 0.82,
          letterSpacing: 0,
          transform: 'translateY(0.06em)',
        }}
      >
        {displayValue}
      </div>
      
      {/* Countdown border */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M 50 100 H 0 V 0 H 50"
          pathLength={1}
          fill="none"
          stroke={borderColor}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          style={{
            strokeDasharray: `${countdownBorderVisible} 1`,
            transition: isRunning ? 'stroke-dasharray 50ms linear' : undefined,
          }}
        />
        <path
          d="M 50 100 H 100 V 0 H 50"
          pathLength={1}
          fill="none"
          stroke={borderColor}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          style={{
            strokeDasharray: `${countdownBorderVisible} 1`,
            transition: isRunning ? 'stroke-dasharray 50ms linear' : undefined,
          }}
        />
      </svg>
      
      {/* Warning flash effect */}
      {shouldStrobe && <div className="absolute inset-0 bg-red-500 opacity-15 pointer-events-none" />}
    </div>
  );
}
