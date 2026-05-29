import { useEffect, useState } from 'react';
import { projectTimerState } from '@shotclock/shared/timer';
import type { ScoreboardBranding } from '@shotclock/shared/types';

const DEFAULT_RED_COLOR = '#ef4444';
const DEFAULT_GREEN_COLOR = '#22c55e';

interface SportModeProps {
  state?: {
    mode?: { scoreboardBranding?: ScoreboardBranding };
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
  const branding = state?.mode?.scoreboardBranding;
  const redLabel = branding?.enabled ? normalizeLabel(branding.homeLabel, 'RED') : 'RED';
  const greenLabel = branding?.enabled ? normalizeLabel(branding.awayLabel, 'GRN') : 'GRN';
  const redColor = branding?.enabled && isHexColor(branding.homeColor) ? branding.homeColor : DEFAULT_RED_COLOR;
  const greenColor = branding?.enabled && isHexColor(branding.awayColor) ? branding.awayColor : DEFAULT_GREEN_COLOR;

  return (
    <div
      className="grid h-full w-full grid-rows-[13%_38%_49%] overflow-hidden bg-black px-1.5 py-1 font-mono text-white"
      style={{ containerType: 'size' }}
    >
      <div className="flex min-h-0 items-center justify-between gap-1 overflow-hidden text-[min(8cqh,4cqw)] font-black leading-none text-gray-400">
        <span>WRESTLE</span>
        <span>MATCH{period}</span>
      </div>
      <div className="flex min-h-0 items-center justify-center overflow-hidden text-[min(32cqh,22cqw)] font-black leading-none tabular-nums">
        {clock}
      </div>
      <div className="grid min-h-0 grid-cols-2 gap-1 overflow-hidden leading-none">
        <ScorePane label={redLabel} value={redScore} color={redColor} />
        <ScorePane label={greenLabel} value={greenScore} color={greenColor} />
      </div>
    </div>
  );
}

function ScorePane({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="grid min-h-0 grid-rows-[18%_82%] overflow-hidden border border-gray-800 px-0.5">
      <div className="flex min-h-0 items-center justify-center text-[min(7cqh,4cqw)] font-black leading-none" style={{ color }}>{label}</div>
      <div className="flex min-h-0 items-center justify-center text-[min(36cqh,24cqw)] font-black leading-none tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function normalizeLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 18) : fallback;
}

function isHexColor(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
}
