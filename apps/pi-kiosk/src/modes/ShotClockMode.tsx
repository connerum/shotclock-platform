// Shot Clock Mode - compact display for calibrated LED viewport.

import { useEffect, useState } from 'react';
import ShotClock from '../components/ShotClock';

interface ShotClockModeProps {
  state?: {
    mode?: { type: string };
    timerState?: {
      shotClock: number;
      gameClock: number;
      homeScore: number;
      awayScore: number;
      period?: number;
      isRunning: boolean;
      lastUpdated?: number;
    };
  };
}

export default function ShotClockMode({ state }: ShotClockModeProps) {
  const [now, setNow] = useState(Date.now());
  const timerState = state?.timerState;

  useEffect(() => {
    if (!timerState?.isRunning) return;

    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timerState?.isRunning, timerState?.lastUpdated]);

  const elapsedSeconds = timerState?.isRunning
    ? Math.floor((now - (timerState.lastUpdated || now)) / 1000)
    : 0;
  const shotClock = Math.max(0, (timerState?.shotClock ?? 24) - elapsedSeconds);
  const gameClock = Math.max(0, (timerState?.gameClock ?? 720) - elapsedSeconds);
  const homeScore = timerState?.homeScore ?? 0;
  const awayScore = timerState?.awayScore ?? 0;
  const period = timerState?.period ?? 1;
  const isRunning = timerState?.isRunning ?? false;

  const formatGameClock = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isWarning = shotClock <= 5 && shotClock > 0;
  const isExpired = shotClock === 0;

  return (
    <div
      className="grid h-full w-full grid-rows-[13%_54%_17%_16%] overflow-hidden bg-black px-2 py-1 text-white"
      style={{ containerType: 'size' }}
    >
      <div className="flex items-center justify-between overflow-hidden font-mono text-[min(7cqh,5cqw)] font-bold leading-none text-gray-400">
        <span>P{period}</span>
        <span className={isRunning ? 'text-green-500' : 'text-yellow-500'}>
          {isRunning ? 'RUN' : 'HOLD'}
        </span>
      </div>

      <div className="min-h-0">
        <ShotClock
          value={shotClock}
          isWarning={isWarning}
          isExpired={isExpired}
          isRunning={isRunning}
        />
      </div>

      <div className="flex items-center justify-center overflow-hidden font-mono text-[min(14cqh,15cqw)] font-black leading-none tabular-nums text-white">
        {formatGameClock(gameClock)}
      </div>

      <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-1 overflow-hidden font-mono leading-none">
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-1 overflow-hidden">
          <span className="text-[min(5cqh,4cqw)] font-bold text-red-400">H</span>
          <span className="text-right text-[min(13cqh,12cqw)] font-black tabular-nums text-red-500">{homeScore}</span>
        </div>
        <span className="text-[min(5cqh,4cqw)] font-bold text-gray-600">-</span>
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-1 overflow-hidden">
          <span className="text-[min(13cqh,12cqw)] font-black tabular-nums text-blue-500">{awayScore}</span>
          <span className="text-[min(5cqh,4cqw)] font-bold text-blue-400">A</span>
        </div>
      </div>
    </div>
  );
}
