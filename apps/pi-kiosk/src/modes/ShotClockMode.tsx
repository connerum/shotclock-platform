// Shot Clock Mode - compact display for calibrated LED viewport.

import { useEffect, useState } from 'react';
import { DEFAULT_SHOT_CLOCK_SECONDS, projectPreciseTimerState } from '@shotclock/shared/timer';
import ShotClock from '../components/ShotClock';

interface ShotClockModeProps {
  state?: {
    mode?: { type: string; subMode?: string };
    timerState?: {
      shotClock: number;
      gameClock: number;
      homeScore: number;
      awayScore: number;
      period?: number;
      isRunning: boolean;
      isPaused?: boolean;
      lastUpdated?: number;
    };
  };
}

export default function ShotClockMode({ state }: ShotClockModeProps) {
  const [now, setNow] = useState(Date.now());
  const timerState = state?.timerState;

  useEffect(() => {
    if (!timerState?.isRunning) return;

    const interval = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(interval);
  }, [timerState?.isRunning, timerState?.lastUpdated]);

  const projectedTimerState = timerState ? projectPreciseTimerState({
    mode: timerState.isRunning ? 'run' : timerState.isPaused ? 'pause' : 'stop',
    homeScore: timerState.homeScore,
    awayScore: timerState.awayScore,
    period: timerState.period,
    shotClock: timerState.shotClock,
    gameClock: timerState.gameClock,
    isRunning: timerState.isRunning,
    isPaused: Boolean(timerState.isPaused),
    lastUpdated: timerState.lastUpdated ?? now,
  }, now) : null;

  const shotClock = projectedTimerState?.shotClock ?? DEFAULT_SHOT_CLOCK_SECONDS;
  const gameClock = Math.floor(projectedTimerState?.gameClock ?? 720);
  const homeScore = projectedTimerState?.homeScore ?? 0;
  const awayScore = projectedTimerState?.awayScore ?? 0;
  const period = projectedTimerState?.period ?? 1;
  const isRunning = projectedTimerState?.isRunning ?? false;

  const formatGameClock = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const expiredStrobeActive = Boolean(
    timerState?.isRunning &&
    typeof timerState.lastUpdated === 'number' &&
    timerState.shotClock <= 5 &&
    now - (timerState.lastUpdated + timerState.shotClock * 1000) <= 3000
  );
  const isWarning = isRunning && ((shotClock > 0 && shotClock <= 5) || (shotClock === 0 && expiredStrobeActive));
  const isExpired = shotClock === 0;
  const isShotClockOnly = state?.mode?.subMode === 'shot-clock-only';

  if (isShotClockOnly) {
    return (
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden bg-black p-1 text-white"
        style={{ containerType: 'size' }}
      >
        <div className="relative h-full w-full overflow-hidden border-2 border-gray-700 bg-black">
          <ShotClock
            value={shotClock}
            isWarning={isWarning}
            isExpired={isExpired}
            isRunning={isRunning}
          />
        </div>
      </div>
    );
  }

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
