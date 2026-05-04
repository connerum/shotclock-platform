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
    <div className={`relative ${glowClass}`}>
      {/* Main display */}
      <div className={`font-mono font-bold ${colorClass}`} style={{ fontSize: '20rem', lineHeight: 1 }}>
        {displayValue}
      </div>
      
      {/* Decorative border */}
      <div className={`absolute inset-0 border-4 ${isExpired ? 'border-red-500' : isWarning ? 'border-yellow-400' : 'border-gray-700'} rounded-lg`} />
      
      {/* Running indicator */}
      {isRunning && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
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
