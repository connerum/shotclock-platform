import { useEffect, useState } from 'react';
import { projectTimerState } from '@shotclock/shared/timer';

interface SportModeProps {
  state?: {
    timerState?: {
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

export default function WrestlingMode({ state }: SportModeProps) {
  const [now, setNow] = useState(Date.now());
  const timerState = state?.timerState;

  useEffect(() => {
    if (!timerState?.isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timerState?.isRunning, timerState?.lastUpdated]);

  const projectedState = timerState ? projectTimerState({
    mode: timerState.isRunning ? 'run' : timerState.isPaused ? 'pause' : 'stop',
    homeScore: timerState.homeScore,
    awayScore: timerState.awayScore,
    period: timerState.period,
    shotClock: 24,
    gameClock: timerState.gameClock,
    isRunning: timerState.isRunning,
    isPaused: Boolean(timerState.isPaused),
    lastUpdated: timerState.lastUpdated ?? now,
  }, now) : null;

  const clock = formatClock(projectedState?.gameClock ?? 720);
  const period = projectedState?.period ?? 1;
  const redScore = projectedState?.homeScore ?? 0;
  const greenScore = projectedState?.awayScore ?? 0;
  const isRunning = projectedState?.isRunning ?? false;

  return (
    <div className="grid h-full w-full grid-rows-[16%_42%_42%] overflow-hidden bg-black px-2 py-1 font-mono text-white">
      <div className="flex items-center justify-between overflow-hidden text-[min(7cqh,5cqw)] font-black leading-none text-gray-400">
        <span>WRESTLING</span>
        <span className={isRunning ? 'text-green-500' : 'text-yellow-500'}>{isRunning ? 'RUN' : 'HOLD'}</span>
        <span>P{period}</span>
      </div>
      <div className="flex items-center justify-center overflow-hidden text-[min(28cqh,24cqw)] font-black leading-none tabular-nums">
        {clock}
      </div>
      <div className="grid min-h-0 grid-cols-2 gap-2 overflow-hidden leading-none">
        <ScorePane label="RED" value={redScore} className="text-red-500" />
        <ScorePane label="GREEN" value={greenScore} className="text-green-500" />
      </div>
    </div>
  );
}

function ScorePane({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="grid min-h-0 grid-rows-[20%_80%] overflow-hidden border border-gray-800 px-1">
      <div className={`flex items-center justify-center text-[min(6cqh,5cqw)] font-black ${className}`}>{label}</div>
      <div className={`flex items-center justify-center text-[min(30cqh,24cqw)] font-black tabular-nums ${className}`}>{value}</div>
    </div>
  );
}

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
