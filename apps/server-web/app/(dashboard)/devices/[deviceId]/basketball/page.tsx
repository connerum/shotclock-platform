'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { TimerState } from '@shotclock/shared/types';
import {
  clampSeconds,
  createDefaultTimerState,
  pauseTimerState,
  projectTimerState,
  startTimerState,
  stopTimerState,
} from '@shotclock/shared/timer';
import GamePresentationControls from '../GamePresentationControls';

interface Device {
  id: string;
  deviceId: string;
  name: string;
  status: string;
  mode: string;
  lastSeen: string | null;
  firmwareVersion: string | null;
  controllerType: string;
  isOnline: boolean;
  timerState?: TimerState | null;
}

export default function BasketballPage({ params }: { params: { deviceId: string } }) {
  const deviceId = params.deviceId;

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  const [shotClock, setShotClock] = useState(24);
  const [gameClock, setGameClock] = useState(720);
  const [period, setPeriod] = useState(1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLastUpdated, setTimerLastUpdated] = useState(Date.now());
  const [timerNow, setTimerNow] = useState(Date.now());

  useEffect(() => {
    void fetchDevice();
  }, [deviceId]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTimerNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const fetchDevice = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}`);
      if (!res.ok) throw new Error('Device not found');
      const data = await res.json();
      setDevice(data.device);

      const loadedTimerState = data.device.timerState
        ? projectTimerState(data.device.timerState, Date.now())
        : createDefaultTimerState();
      setShotClock(loadedTimerState.shotClock);
      setGameClock(loadedTimerState.gameClock);
      setPeriod(loadedTimerState.period ?? 1);
      setHomeScore(loadedTimerState.homeScore);
      setAwayScore(loadedTimerState.awayScore);
      setTimerRunning(loadedTimerState.isRunning);
      setTimerLastUpdated(loadedTimerState.lastUpdated);
      setTimerNow(Date.now());
    } catch (err) {
      setError('Failed to load device');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async (type: string, payload?: unknown) => {
    setCommandError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.error || `Command failed with HTTP ${res.status}`;
        setCommandError(message);
        return false;
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Command failed';
      setCommandError(message);
      return false;
    }
  };

  const buildCurrentTimerState = (): TimerState => ({
    mode: timerRunning ? 'run' : 'pause',
    homeScore,
    awayScore,
    period,
    shotClock,
    gameClock,
    isRunning: timerRunning,
    isPaused: !timerRunning,
    lastUpdated: timerLastUpdated,
  });

  const projectedTimerState = projectTimerState(buildCurrentTimerState(), timerNow);
  const displayedShotClock = projectedTimerState.shotClock;
  const displayedGameClock = projectedTimerState.gameClock;
  const shotClockStatus = timerRunning ? 'Running' : 'Stopped';
  const shotClockTone = displayedShotClock === 0
    ? 'text-red-400 drop-shadow-[0_0_32px_rgba(239,68,68,0.45)]'
    : displayedShotClock <= 5
      ? 'text-orange-300 drop-shadow-[0_0_32px_rgba(249,115,22,0.35)]'
      : 'text-white drop-shadow-[0_0_32px_rgba(255,255,255,0.12)]';

  const commitTimerUpdates = (updates: Partial<TimerState>) => {
    const now = Date.now();
    const currentState = projectTimerState(buildCurrentTimerState(), now);
    const timerState: TimerState = {
      ...currentState,
      ...updates,
      mode: currentState.isRunning ? 'run' : 'pause',
      isRunning: currentState.isRunning,
      isPaused: !currentState.isRunning,
      lastUpdated: now,
    };

    applyTimerState(timerState);
    void sendCommand('set_timer', { timerState, mode: { type: 'basketball' } });
  };

  const updateShotClock = (value: number) => {
    commitTimerUpdates({ shotClock: clampSeconds(value, 0, 99) });
  };

  const updateGameClock = (value: number) => {
    commitTimerUpdates({ gameClock: clampSeconds(value, 0, 3600) });
  };

  const updatePeriod = (value: number) => {
    commitTimerUpdates({ period: Math.max(1, Math.min(10, value)) });
  };

  const updateHomeScore = (value: number) => {
    commitTimerUpdates({ homeScore: Math.max(0, value) });
  };

  const updateAwayScore = (value: number) => {
    commitTimerUpdates({ awayScore: Math.max(0, value) });
  };

  const startTimer = async () => {
    const timerState = startTimerState(buildCurrentTimerState());
    const success = await sendCommand('set_timer', { timerState, mode: { type: 'basketball' } });
    if (success) {
      applyTimerState(timerState);
      setTimerRunning(true);
    }
  };

  const pauseTimer = async () => {
    const timerState = pauseTimerState(buildCurrentTimerState());
    const success = await sendCommand('set_timer', { timerState, mode: { type: 'basketball' } });
    if (success) {
      applyTimerState(timerState);
      setTimerRunning(false);
    }
  };

  const resetTimer = async () => {
    const timerState = stopTimerState({
      ...buildCurrentTimerState(),
      homeScore: 0,
      awayScore: 0,
      period: 1,
    });
    const success = await sendCommand('set_timer', { timerState, mode: { type: 'basketball' } });
    if (success) {
      applyTimerState(timerState);
      setPeriod(timerState.period ?? 1);
      setHomeScore(timerState.homeScore);
      setAwayScore(timerState.awayScore);
      setTimerRunning(false);
    }
  };

  const applyTimerState = (timerState: TimerState) => {
    setShotClock(timerState.shotClock);
    setGameClock(timerState.gameClock);
    setPeriod(timerState.period ?? 1);
    setHomeScore(timerState.homeScore);
    setAwayScore(timerState.awayScore);
    setTimerRunning(timerState.isRunning);
    setTimerLastUpdated(timerState.lastUpdated);
    setTimerNow(timerState.lastUpdated);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400">Loading basketball controls...</div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div>
        <Link href={`/devices/${deviceId}`} className="mb-4 inline-block text-gray-400 hover:text-white">
          ← Back to Sports
        </Link>
        <div className="rounded-lg border border-red-700 bg-red-900/50 p-4">
          <p className="text-red-400">{error || 'Device not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link href={`/devices/${deviceId}`} className="mb-4 inline-block text-gray-400 hover:text-white">
          ← Back to Sports
        </Link>
        {commandError && (
          <div className="mb-4 rounded border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
            {commandError}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Basketball Controls</h1>
            <p className="mt-1 font-mono text-sm text-gray-400">{device.deviceId}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            device.isOnline ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {device.isOnline ? '● Online' : '○ Offline'}
          </span>
        </div>
      </div>

      <section className="cc-card mb-6 p-8 text-center md:p-10">
        <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Shot Clock</div>
        <div className={`mt-4 font-mono text-8xl font-black leading-none tabular-nums md:text-[8rem] ${shotClockTone}`}>
          {displayedShotClock}
        </div>
        <div className="mt-6 flex items-center justify-center gap-3 text-sm font-semibold text-gray-300">
          <span className={`h-3 w-3 rounded-full ${
            timerRunning ? 'bg-green-400 shadow-[0_0_14px_rgba(34,197,94,0.7)]' : 'bg-gray-600'
          }`} />
          <span>{shotClockStatus}</span>
          <span className="text-gray-600">/</span>
          <span>Game {formatGameClock(displayedGameClock)}</span>
          <span className="text-gray-600">/</span>
          <span>Period {period}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ControlCard title="Timer Control" icon="PLAY" accentClass="bg-blue-500/15 text-blue-300">
          <button
            onClick={timerRunning ? pauseTimer : startTimer}
            className={`cc-btn w-full px-5 py-4 text-base ${timerRunning ? 'cc-btn-orange' : 'cc-btn-primary'}`}
          >
            {timerRunning ? 'Pause Clock' : 'Start Clock'}
          </button>
          <button onClick={resetTimer} className="cc-btn cc-btn-red mt-3 w-full px-5 py-4 text-base">
            Reset Game
          </button>
        </ControlCard>

        <ControlCard title="Time Settings" icon="TIME" accentClass="bg-purple-500/15 text-purple-300">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateShotClock(24)}
              disabled={timerRunning}
              className="cc-btn cc-btn-blue px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset 24s
            </button>
            <button
              onClick={() => updateShotClock(14)}
              disabled={timerRunning}
              className="cc-btn cc-btn-blue px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset 14s
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
              Custom Shot Clock
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateShotClock(displayedShotClock - 1)}
                disabled={timerRunning}
                className="rounded-lg bg-white/10 px-4 py-2 text-xl font-black hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                -
              </button>
              <input
                type="number"
                value={displayedShotClock}
                onChange={(e) => updateShotClock(parseInt(e.target.value, 10) || 0)}
                disabled={timerRunning}
                className="min-w-0 flex-1 rounded-lg px-3 py-2 text-center font-mono text-2xl font-black disabled:opacity-50"
              />
              <button
                onClick={() => updateShotClock(displayedShotClock + 1)}
                disabled={timerRunning}
                className="rounded-lg bg-white/10 px-4 py-2 text-xl font-black hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <button
              onClick={() => updateGameClock(displayedGameClock - 30)}
              disabled={timerRunning}
              className="rounded-lg bg-white/10 px-3 py-2 font-bold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              -30
            </button>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Game Clock</div>
              <div className="mt-1 font-mono text-2xl font-black">{formatGameClock(displayedGameClock)}</div>
            </div>
            <button
              onClick={() => updateGameClock(displayedGameClock + 30)}
              disabled={timerRunning}
              className="rounded-lg bg-white/10 px-3 py-2 font-bold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              +30
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Period</span>
            <div className="flex items-center gap-3">
              <button onClick={() => updatePeriod(period - 1)} className="rounded-lg bg-white/10 px-3 py-1 font-bold hover:bg-white/15">
                -
              </button>
              <span className="w-10 text-center text-2xl font-black">{period}</span>
              <button onClick={() => updatePeriod(period + 1)} className="rounded-lg bg-white/10 px-3 py-1 font-bold hover:bg-white/15">
                +
              </button>
            </div>
          </div>
        </ControlCard>

        <ControlCard title="Score" icon="PTS" accentClass="bg-green-500/15 text-green-300">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <ScoreControl label="Home" value={homeScore} onChange={updateHomeScore} tone="text-red-300" />
            <ScoreControl label="Away" value={awayScore} onChange={updateAwayScore} tone="text-blue-300" />
          </div>
        </ControlCard>
      </div>

      <GamePresentationControls deviceId={deviceId} />
    </div>
  );
}

function ControlCard({
  title,
  icon,
  accentClass,
  children,
}: {
  title: string;
  icon: string;
  accentClass: string;
  children: ReactNode;
}) {
  return (
    <section className="cc-card cc-card-hover p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-black ${accentClass}`}>
          {icon}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ScoreControl({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="rounded-lg bg-white/10 px-4 py-2 text-xl font-black hover:bg-white/15"
        >
          -
        </button>
        <span className={`w-20 text-center font-mono text-5xl font-black tabular-nums ${tone}`}>{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="rounded-lg bg-white/10 px-4 py-2 text-xl font-black hover:bg-white/15"
        >
          +
        </button>
      </div>
    </div>
  );
}

function formatGameClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
