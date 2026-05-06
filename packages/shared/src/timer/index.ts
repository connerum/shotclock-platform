import type { TimerState } from '../types/index.js';

export const DEFAULT_SHOT_CLOCK_SECONDS = 24;
export const DEFAULT_GAME_CLOCK_SECONDS = 720;
export const MAX_SHOT_CLOCK_SECONDS = 99;
export const MAX_GAME_CLOCK_SECONDS = 3600;

export function clampSeconds(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function createDefaultTimerState(now = Date.now()): TimerState {
  return {
    mode: 'stop',
    homeScore: 0,
    awayScore: 0,
    period: 1,
    shotClock: DEFAULT_SHOT_CLOCK_SECONDS,
    gameClock: DEFAULT_GAME_CLOCK_SECONDS,
    isRunning: false,
    isPaused: false,
    lastUpdated: now,
  };
}

export function normalizeTimerState(state: Partial<TimerState> | null | undefined, now = Date.now()): TimerState {
  const fallback = createDefaultTimerState(now);

  return {
    mode: state?.mode ?? fallback.mode,
    homeScore: clampSeconds(state?.homeScore ?? fallback.homeScore, 0),
    awayScore: clampSeconds(state?.awayScore ?? fallback.awayScore, 0),
    period: clampSeconds(state?.period ?? fallback.period ?? 1, 1, 99),
    shotClock: clampSeconds(state?.shotClock ?? fallback.shotClock, 0, MAX_SHOT_CLOCK_SECONDS),
    gameClock: clampSeconds(state?.gameClock ?? fallback.gameClock, 0, MAX_GAME_CLOCK_SECONDS),
    isRunning: Boolean(state?.isRunning),
    isPaused: Boolean(state?.isPaused),
    lastUpdated: typeof state?.lastUpdated === 'number' && Number.isFinite(state.lastUpdated)
      ? state.lastUpdated
      : now,
  };
}

export function projectTimerState(state: TimerState, now = Date.now()): TimerState {
  const normalized = normalizeTimerState(state, now);
  if (!normalized.isRunning) return normalized;

  const elapsedSeconds = Math.max(0, Math.floor((now - normalized.lastUpdated) / 1000));

  return {
    ...normalized,
    shotClock: Math.max(0, normalized.shotClock - elapsedSeconds),
    gameClock: Math.max(0, normalized.gameClock - elapsedSeconds),
  };
}

export function startTimerState(state: TimerState, now = Date.now()): TimerState {
  const projected = projectTimerState(state, now);

  return {
    ...projected,
    mode: 'run',
    isRunning: true,
    isPaused: false,
    lastUpdated: now,
  };
}

export function pauseTimerState(state: TimerState, now = Date.now()): TimerState {
  const projected = projectTimerState(state, now);

  return {
    ...projected,
    mode: 'pause',
    isRunning: false,
    isPaused: true,
    lastUpdated: now,
  };
}

export function stopTimerState(state: Partial<TimerState> | null | undefined, now = Date.now()): TimerState {
  const normalized = normalizeTimerState(state, now);

  return {
    ...normalized,
    mode: 'stop',
    shotClock: DEFAULT_SHOT_CLOCK_SECONDS,
    gameClock: DEFAULT_GAME_CLOCK_SECONDS,
    isRunning: false,
    isPaused: false,
    lastUpdated: now,
  };
}

export function rebaseTimerStateToLocalClock(state: TimerState, now = Date.now()): TimerState {
  const normalized = normalizeTimerState(state, now);

  return {
    ...normalized,
    lastUpdated: now,
  };
}
