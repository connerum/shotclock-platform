'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DeviceMode, SportType, TimerState } from '@shotclock/shared/types';
import {
  createDefaultTimerState,
  pauseTimerState,
  projectTimerState,
  startTimerState,
  stopTimerState,
} from '@shotclock/shared/timer';
import GamePresentationControls from './GamePresentationControls';

type SportConfig = {
  sport: SportType;
  title: string;
  clockLabel: string;
  periodLabel: string;
  homeLabel: string;
  awayLabel: string;
  showSets?: boolean;
};

interface Device {
  deviceId: string;
  name: string;
  isOnline: boolean;
  timerState?: TimerState | null;
}

export default function SportControlPage({ deviceId, config }: { deviceId: string; config: SportConfig }) {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [timerState, setTimerState] = useState<TimerState>(() => ({
    ...createDefaultTimerState(),
    mode: 'pause',
    isPaused: true,
  }));
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const fetchDevice = async () => {
      try {
        const response = await fetch(`/api/devices/${deviceId}`);
        if (!response.ok) throw new Error('Device not found');
        const data = await response.json();
        const loadedTimerState = hydrateTimerState(data.device.timerState);

        setDevice(data.device);
        setTimerState(loadedTimerState);
        setNow(loadedTimerState.lastUpdated);
      } finally {
        setLoading(false);
      }
    };

    void fetchDevice();
    void setSportMode();
  }, [deviceId, config.sport]);

  useEffect(() => {
    if (!timerState.isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timerState.isRunning]);

  const projectedState = projectTimerState(timerState, now);

  const setSportMode = async () => {
    const mode: DeviceMode = { type: config.sport };
    await sendCommand('set_mode', { mode });
  };

  const sendCommand = async (type: string, payload?: unknown) => {
    setCommandError(null);
    const response = await fetch(`/api/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setCommandError(data?.error || `Command failed with HTTP ${response.status}`);
      return false;
    }
    return true;
  };

  const sendTimerState = async (nextState: TimerState) => {
    const mode: DeviceMode = { type: config.sport };
    const success = await sendCommand('set_timer', { timerState: nextState, mode });
    if (success) {
      setTimerState(nextState);
      setNow(nextState.lastUpdated);
    }
  };

  const updateTimerState = (updates: Partial<TimerState>) => {
    const nextState = {
      ...projectedState,
      ...updates,
      isRunning: false,
      isPaused: true,
      mode: 'pause' as const,
      lastUpdated: Date.now(),
    };
    setTimerState(nextState);
    setNow(nextState.lastUpdated);
    void sendTimerState(nextState);
  };

  const start = () => {
    void sendTimerState(startTimerState(projectedState));
  };

  const pause = () => {
    void sendTimerState(pauseTimerState(timerState));
  };

  const reset = () => {
    void sendTimerState(stopTimerState({
      ...timerState,
      homeScore: 0,
      awayScore: 0,
      homeSets: 0,
      awaySets: 0,
      period: 1,
    }));
  };

  const formatClock = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading controls...</div>;
  }

  return (
    <div>
      <div className="mb-5">
        <Link href={`/devices/${deviceId}`} className="mb-3 inline-block text-sm text-gray-400 hover:text-white">
          ← Back to Sports
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{config.title}</h1>
            <p className="mt-1 font-mono text-sm text-gray-400">{device?.name || deviceId}</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${
            device?.isOnline ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {device?.isOnline ? '● Online' : '○ Offline'}
          </span>
        </div>
      </div>

      {commandError && (
        <div className="mb-4 rounded border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
          {commandError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="cc-card p-5">
          <h2 className="mb-3 text-lg font-semibold">{config.clockLabel}</h2>
          <div className="mb-5 font-mono text-5xl font-black tabular-nums md:text-6xl">
            {formatClock(projectedState.gameClock)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="cc-btn cc-btn-primary px-4 py-3" onClick={start} disabled={projectedState.isRunning}>
              Start
            </button>
            <button className="cc-btn cc-btn-orange px-4 py-3" onClick={pause} disabled={!projectedState.isRunning}>
              Pause
            </button>
            <button className="rounded bg-gray-800 px-4 py-3 font-semibold hover:bg-gray-700" onClick={() => updateTimerState({ gameClock: Math.max(0, projectedState.gameClock - 30) })}>
              -30
            </button>
            <button className="rounded bg-gray-800 px-4 py-3 font-semibold hover:bg-gray-700" onClick={() => updateTimerState({ gameClock: Math.min(3600, projectedState.gameClock + 30) })}>
              +30
            </button>
            <button className="cc-btn cc-btn-red col-span-2 px-4 py-3" onClick={reset}>
              Reset
            </button>
          </div>
        </div>

        <div className="cc-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Score</h2>
          <div className="mb-5 flex items-center justify-between">
            <span className="text-gray-400">{config.periodLabel}</span>
            <div className="flex items-center gap-3">
              <button className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700" onClick={() => updateTimerState({ period: Math.max(1, (projectedState.period ?? 1) - 1) })}>-</button>
              <span className="w-12 text-center text-3xl font-bold">{projectedState.period ?? 1}</span>
              <button className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700" onClick={() => updateTimerState({ period: Math.min(10, (projectedState.period ?? 1) + 1) })}>+</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ScoreControl
              label={config.homeLabel}
              value={projectedState.homeScore}
              onChange={(homeScore) => updateTimerState({ homeScore })}
            />
            <ScoreControl
              label={config.awayLabel}
              value={projectedState.awayScore}
              onChange={(awayScore) => updateTimerState({ awayScore })}
            />
          </div>

          {config.showSets && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <ScoreControl
                label="Home Sets"
                value={projectedState.homeSets ?? 0}
                onChange={(homeSets) => updateTimerState({ homeSets })}
              />
              <ScoreControl
                label="Away Sets"
                value={projectedState.awaySets ?? 0}
                onChange={(awaySets) => updateTimerState({ awaySets })}
              />
            </div>
          )}
        </div>
      </div>

      <GamePresentationControls deviceId={deviceId} />
    </div>
  );
}

function hydrateTimerState(timerState?: TimerState | null): TimerState {
  const now = Date.now();
  const projectedTimerState = timerState
    ? projectTimerState(timerState, now)
    : createDefaultTimerState(now);

  return {
    ...projectedTimerState,
    mode: projectedTimerState.isRunning ? 'run' : 'pause',
    isPaused: !projectedTimerState.isRunning,
    lastUpdated: now,
  };
}

function ScoreControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="text-center">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <div className="flex items-center justify-center gap-3">
        <button className="rounded bg-gray-800 px-4 py-2 text-xl hover:bg-gray-700" onClick={() => onChange(Math.max(0, value - 1))}>
          -
        </button>
        <span className="w-16 text-center font-mono text-4xl md:w-20 md:text-5xl">{value}</span>
        <button className="rounded bg-gray-800 px-4 py-2 text-xl hover:bg-gray-700" onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}
