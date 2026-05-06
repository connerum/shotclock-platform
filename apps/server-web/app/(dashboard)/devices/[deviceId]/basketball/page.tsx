'use client';

import { useEffect, useState } from 'react';
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

  const updateShotClock = (value: number) => {
    const now = Date.now();
    setShotClock(clampSeconds(value, 0, 99));
    setTimerLastUpdated(now);
    setTimerNow(now);
  };

  const updateGameClock = (value: number) => {
    const now = Date.now();
    setGameClock(clampSeconds(value, 0, 3600));
    setTimerLastUpdated(now);
    setTimerNow(now);
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="mb-4 text-xl font-semibold">Timer Controls</h2>

          <div className="mb-4">
            <label className="mb-2 block text-sm text-gray-400">Shot Clock (seconds)</label>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => updateShotClock(displayedShotClock - 1)}
                disabled={timerRunning}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 disabled:opacity-50"
              >
                -
              </button>
              <span className="w-16 text-center font-mono text-3xl">{displayedShotClock}</span>
              <button
                onClick={() => updateShotClock(displayedShotClock + 1)}
                disabled={timerRunning}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 disabled:opacity-50"
              >
                +
              </button>
              <input
                type="number"
                value={displayedShotClock}
                onChange={(e) => updateShotClock(parseInt(e.target.value, 10) || 0)}
                disabled={timerRunning}
                className="w-20 rounded bg-gray-800 px-2 py-1 text-center font-mono disabled:opacity-50"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm text-gray-400">Game Clock (seconds)</label>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => updateGameClock(displayedGameClock - 30)}
                disabled={timerRunning}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 disabled:opacity-50"
              >
                -30
              </button>
              <span className="w-24 text-center font-mono text-3xl">
                {Math.floor(displayedGameClock / 60)}:{String(displayedGameClock % 60).padStart(2, '0')}
              </span>
              <button
                onClick={() => updateGameClock(displayedGameClock + 30)}
                disabled={timerRunning}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 disabled:opacity-50"
              >
                +30
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm text-gray-400">Period</label>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setPeriod(Math.max(1, period - 1))}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700"
              >
                -
              </button>
              <span className="w-12 text-center text-2xl">{period}</span>
              <button
                onClick={() => setPeriod(Math.min(10, period + 1))}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            {!timerRunning ? (
              <button onClick={startTimer} className="flex-1 rounded bg-green-600 py-3 font-medium hover:bg-green-700">
                Start
              </button>
            ) : (
              <button onClick={pauseTimer} className="flex-1 rounded bg-yellow-600 py-3 font-medium hover:bg-yellow-700">
                Pause
              </button>
            )}
            <button onClick={resetTimer} className="flex-1 rounded bg-red-600 py-3 font-medium hover:bg-red-700">
              Reset
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="mb-4 text-xl font-semibold">Score</h2>
          <div className="grid grid-cols-2 gap-8">
            <ScoreControl label="Home" value={homeScore} onChange={setHomeScore} />
            <ScoreControl label="Away" value={awayScore} onChange={setAwayScore} />
          </div>
        </div>
      </div>

      <GamePresentationControls deviceId={deviceId} />
    </div>
  );
}

function ScoreControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="text-center">
      <p className="mb-3 text-gray-400">{label}</p>
      <div className="flex items-center justify-center space-x-3">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="rounded bg-gray-800 px-4 py-2 text-xl hover:bg-gray-700"
        >
          -
        </button>
        <span className="w-20 text-center font-mono text-5xl">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="rounded bg-gray-800 px-4 py-2 text-xl hover:bg-gray-700"
        >
          +
        </button>
      </div>
    </div>
  );
}
