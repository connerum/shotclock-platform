// Shot Clock Mode - compact display for calibrated LED viewport.

import { useEffect, useState } from 'react';
import type { ScoreboardBranding } from '@shotclock/shared/types';
import { DEFAULT_SHOT_CLOCK_SECONDS, formatShotClockDisplay, projectPreciseTimerState } from '@shotclock/shared/timer';
import ShotClock from '../components/ShotClock';

const FINAL_COUNTDOWN_SECONDS = 10;

interface ShotClockModeProps {
  state?: {
    mode?: { type: string; subMode?: string; scoreboardBranding?: ScoreboardBranding };
    timerState?: {
      shotClock: number;
      gameClock: number;
      homeScore: number;
      awayScore: number;
      homeTimeouts?: number;
      awayTimeouts?: number;
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
    homeTimeouts: timerState.homeTimeouts,
    awayTimeouts: timerState.awayTimeouts,
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
  const homeTimeouts = projectedTimerState?.homeTimeouts ?? 0;
  const awayTimeouts = projectedTimerState?.awayTimeouts ?? 0;
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
    now >= timerState.lastUpdated + timerState.shotClock * 1000 &&
    now - (timerState.lastUpdated + timerState.shotClock * 1000) <= 3000
  );
  const isWarning = shotClock > 0 && shotClock <= FINAL_COUNTDOWN_SECONDS;
  const shouldStrobe = isRunning && shotClock === 0 && expiredStrobeActive;
  const isExpired = shotClock === 0;
  const isShotClockOnly = state?.mode?.subMode === 'shot-clock-only';
  const isScoreboardFocused = state?.mode?.subMode === 'scoreboard';
  const scoreboardBranding = state?.mode?.scoreboardBranding;
  const homeLabel = scoreboardBranding?.enabled ? normalizeScoreboardLabel(scoreboardBranding.homeLabel, 'Home') : 'Home';
  const awayLabel = scoreboardBranding?.enabled ? normalizeScoreboardLabel(scoreboardBranding.awayLabel, 'Away') : 'Away';
  const showLogos = Boolean(scoreboardBranding?.enabled && (scoreboardBranding.homeLogoUrl || scoreboardBranding.awayLogoUrl));

  if (isShotClockOnly) {
    return (
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden bg-black p-1 text-white"
        style={{ containerType: 'size' }}
      >
        <div className="relative h-full w-full overflow-hidden bg-black">
          <ShotClock
            value={shotClock}
            isWarning={isWarning}
            shouldStrobe={shouldStrobe}
            isExpired={isExpired}
            isRunning={isRunning}
          />
        </div>
      </div>
    );
  }

  if (isScoreboardFocused) {
    return (
      <div
        className="grid h-full w-full grid-rows-[14%_14%_38%_14%_20%] overflow-hidden bg-black px-2 py-1 font-mono text-white"
        style={{ containerType: 'size' }}
      >
        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-hidden leading-none">
          <div className="text-[min(7cqh,5cqw)] font-black text-gray-400">Q{period}</div>
          <div className="text-[min(13cqh,12cqw)] font-black tabular-nums text-white">
            {formatGameClock(gameClock)}
          </div>
          <div />
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-hidden leading-none">
          <div className="truncate text-center text-[min(7cqh,5cqw)] font-black uppercase text-red-400">{homeLabel}</div>
          <div className="text-[min(5cqh,4cqw)] font-black text-gray-700">-</div>
          <div className="truncate text-center text-[min(7cqh,5cqw)] font-black uppercase text-blue-400">{awayLabel}</div>
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-hidden leading-none">
          <div className="flex min-w-0 items-center justify-center overflow-hidden text-[min(41cqh,26cqw)] font-black tabular-nums text-red-500">
            {homeScore}
          </div>
          <div className="text-[min(14cqh,6cqw)] font-black text-gray-700">-</div>
          <div className="flex min-w-0 items-center justify-center overflow-hidden text-[min(41cqh,26cqw)] font-black tabular-nums text-blue-500">
            {awayScore}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-hidden leading-none">
          <div className="flex h-full items-center justify-center overflow-hidden">
            {showLogos && scoreboardBranding?.homeLogoUrl ? (
              <img src={scoreboardBranding.homeLogoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : null}
          </div>
          <div />
          <div className="flex h-full items-center justify-center overflow-hidden">
            {showLogos && scoreboardBranding?.awayLogoUrl ? (
              <img src={scoreboardBranding.awayLogoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : null}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-start gap-2 overflow-hidden pt-2 leading-none">
          <div className="flex items-center justify-end gap-1 text-[min(7cqh,5cqw)] font-black text-red-300">
            <span className="text-[min(4cqh,3cqw)] uppercase text-gray-500">TO</span>
            <span className="tabular-nums">{homeTimeouts}</span>
          </div>
          <div className="flex h-[74%] min-w-[20cqw] max-w-[32cqw] items-center justify-center overflow-hidden border-2 border-gray-700 px-2">
            <div className={`translate-y-[0.04em] text-[min(10cqh,8cqw)] font-black leading-[0.82] tabular-nums ${colorClassForShotClock(isWarning, isExpired, shouldStrobe)}`}>
              {formatShotClockDisplay(shotClock)}
            </div>
          </div>
          <div className="flex items-center justify-start gap-1 text-[min(7cqh,5cqw)] font-black text-blue-300">
            <span className="tabular-nums">{awayTimeouts}</span>
            <span className="text-[min(4cqh,3cqw)] uppercase text-gray-500">TO</span>
          </div>
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
        <span>Q{period}</span>
      </div>

      <div className="min-h-0">
        <ShotClock
          value={shotClock}
          isWarning={isWarning}
          shouldStrobe={shouldStrobe}
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

function colorClassForShotClock(isWarning: boolean, isExpired: boolean, shouldStrobe: boolean): string {
  if (shouldStrobe) return 'text-white drop-shadow-[0_0_20px_rgba(239,68,68,0.9)]';
  if (isWarning) return 'text-yellow-300 drop-shadow-[0_0_18px_rgba(250,204,21,0.75)]';
  if (isExpired) return 'text-red-500 drop-shadow-[0_0_18px_rgba(239,68,68,0.8)]';
  return 'text-white';
}

function normalizeScoreboardLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 18) : fallback;
}
