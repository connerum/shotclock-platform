// ShotClock component - Shot clock digit renderer

import { useMemo } from 'react';

interface ShotClockProps {
  value: number;
  isWarning?: boolean;
  isExpired?: boolean;
  isRunning?: boolean;
}

export default function ShotClock({ 
  value, 
  isWarning = false, 
  isExpired = false,
  isRunning = false 
}: ShotClockProps) {
  const displayValue = useMemo(() => {
    return Math.max(0, Math.floor(value)).toString().padStart(2, '0');
  }, [value]);

  const colorClass = useMemo(() => {
    if (isExpired) return 'text-red-500';
    if (isWarning) return 'text-yellow-400';
    return 'text-white';
  }, [isWarning, isExpired]);

  const glowClass = useMemo(() => {
    if (isExpired) return 'drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]';
    if (isWarning) return 'drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]';
    if (isRunning) return 'drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]';
    return '';
  }, [isWarning, isExpired, isRunning]);

  return (
    <div className={`relative flex h-full w-full items-center justify-center ${glowClass}`}>
      {/* Main display */}
      <div
        className={`font-mono font-black tabular-nums ${colorClass}`}
        style={{
          fontSize: 'min(48cqw, 64cqh)',
          lineHeight: 0.82,
          letterSpacing: 0,
          transform: 'translateY(0.06em)',
        }}
      >
        {displayValue}
      </div>
      
      {/* Decorative border */}
      <div className={`absolute inset-0 border-2 ${isExpired ? 'border-red-500' : isWarning ? 'border-yellow-400' : 'border-gray-700'}`} />
      
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
      {isWarning && !isExpired && (
        <div className="absolute inset-0 animate-pulse bg-yellow-500 opacity-10 rounded-lg pointer-events-none" />
      )}
    </div>
  );
}
