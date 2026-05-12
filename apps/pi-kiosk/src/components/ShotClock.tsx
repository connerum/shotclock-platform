// ShotClock component - Shot clock digit renderer

import { useMemo } from 'react';
import { formatShotClockDisplay } from '@shotclock/shared/timer';

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
      
      {/* Decorative border */}
      <div className={`absolute inset-0 border-2 ${shouldStrobe ? 'border-white' : isExpired ? 'border-red-500' : isWarning ? 'border-yellow-400' : 'border-gray-700'}`} />
      
      {/* Running indicator */}
      {isRunning && (
        <div className="absolute right-1 top-1">
          <div className="flex items-center gap-1 font-mono text-[7px] text-green-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
            </span>
            LIVE
          </div>
        </div>
      )}
      
      {/* Warning flash effect */}
      {shouldStrobe && <div className="absolute inset-0 bg-red-500 opacity-15 pointer-events-none" />}
    </div>
  );
}
