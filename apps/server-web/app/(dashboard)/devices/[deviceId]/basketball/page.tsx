'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { DeviceMode, ScoreboardBranding, TimerState } from '@shotclock/shared/types';
import {
  clampSeconds,
  createDefaultTimerState,
  DEFAULT_SHOT_CLOCK_SECONDS,
  formatShotClockDisplay,
  pausePreciseTimerState,
  projectPreciseTimerState,
  startTimerState,
  stopTimerState,
} from '@shotclock/shared/timer';
import GamePresentationControls from '../GamePresentationControls';
import { SyncTargetBanner, useDeviceCommandDispatcher } from '../../../SelectedDevicesProvider';

type BasketballPreviewMode = 'regular' | 'advanced' | 'scoreboard';

const DEFAULT_HOME_COLOR = '#ef4444';
const DEFAULT_AWAY_COLOR = '#3b82f6';

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
  displayState?: {
    deviceMode?: DeviceMode;
  } | null;
}

export default function BasketballPage({ params }: { params: { deviceId: string } }) {
  const deviceId = params.deviceId;

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  const [shotClock, setShotClock] = useState(DEFAULT_SHOT_CLOCK_SECONDS);
  const [gameClock, setGameClock] = useState(720);
  const [period, setPeriod] = useState(1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [homeTimeouts, setHomeTimeouts] = useState(0);
  const [awayTimeouts, setAwayTimeouts] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLastUpdated, setTimerLastUpdated] = useState(Date.now());
  const [timerNow, setTimerNow] = useState(Date.now());
  const [previewMode, setPreviewMode] = useState<BasketballPreviewMode>('regular');
  const [scoreboardBrandingEnabled, setScoreboardBrandingEnabled] = useState(false);
  const [scoreboardTimeoutsVisible, setScoreboardTimeoutsVisible] = useState(true);
  const [homeLabel, setHomeLabel] = useState('Home');
  const [awayLabel, setAwayLabel] = useState('Away');
  const [homeLogoUrl, setHomeLogoUrl] = useState('');
  const [awayLogoUrl, setAwayLogoUrl] = useState('');
  const [homeColor, setHomeColor] = useState(DEFAULT_HOME_COLOR);
  const [awayColor, setAwayColor] = useState(DEFAULT_AWAY_COLOR);
  const [uploadingLogo, setUploadingLogo] = useState<'home' | 'away' | null>(null);
  const { sendCommand: dispatchCommand } = useDeviceCommandDispatcher(deviceId);

  useEffect(() => {
    void fetchDevice();
  }, [deviceId]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTimerNow(Date.now()), 50);
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (!device) return;
    const timeout = setTimeout(() => {
      void sendCommand('set_mode', { mode: buildBasketballMode(previewMode) });
    }, 250);
    return () => clearTimeout(timeout);
  }, [
    device?.deviceId,
    previewMode,
    scoreboardBrandingEnabled,
    scoreboardTimeoutsVisible,
    homeLabel,
    awayLabel,
    homeLogoUrl,
    awayLogoUrl,
    homeColor,
    awayColor,
  ]);

  const fetchDevice = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Device not found');
      const data = await res.json();
      const loadedMode = data.device.displayState?.deviceMode as DeviceMode | undefined;
      const loadedBranding = loadedMode?.scoreboardBranding;

      const loadedTimerState = hydrateTimerState(data.device.timerState);
      setShotClock(loadedTimerState.shotClock);
      setGameClock(loadedTimerState.gameClock);
      setPeriod(loadedTimerState.period ?? 1);
      setHomeScore(loadedTimerState.homeScore);
      setAwayScore(loadedTimerState.awayScore);
      setHomeTimeouts(loadedTimerState.homeTimeouts ?? 0);
      setAwayTimeouts(loadedTimerState.awayTimeouts ?? 0);
      setPreviewMode(getPreviewModeFromDeviceMode(loadedMode));
      setScoreboardBrandingEnabled(Boolean(loadedBranding?.enabled));
      setScoreboardTimeoutsVisible(loadedBranding?.showTimeouts !== false);
      setHomeLabel(loadedBranding?.homeLabel || 'Home');
      setAwayLabel(loadedBranding?.awayLabel || 'Away');
      setHomeLogoUrl(loadedBranding?.homeLogoUrl || '');
      setAwayLogoUrl(loadedBranding?.awayLogoUrl || '');
      setHomeColor(isHexColor(loadedBranding?.homeColor) ? loadedBranding.homeColor : DEFAULT_HOME_COLOR);
      setAwayColor(isHexColor(loadedBranding?.awayColor) ? loadedBranding.awayColor : DEFAULT_AWAY_COLOR);
      setTimerRunning(loadedTimerState.isRunning);
      setTimerLastUpdated(loadedTimerState.lastUpdated);
      setTimerNow(Date.now());
      setDevice(data.device);
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
      const { response, data } = await dispatchCommand(type, payload);
      if (!response.ok) {
        const message = data?.error || `Command failed with HTTP ${response.status}`;
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
    homeTimeouts,
    awayTimeouts,
    period,
    shotClock,
    gameClock,
    isRunning: timerRunning,
    isPaused: !timerRunning,
    lastUpdated: timerLastUpdated,
  });

  const projectedTimerState = projectPreciseTimerState(buildCurrentTimerState(), timerNow);
  const displayedShotClock = projectedTimerState.shotClock;
  const displayedGameClock = Math.floor(projectedTimerState.gameClock);
  const displayedShotClockText = formatShotClockDisplay(displayedShotClock);
  const shotClockStatus = timerRunning ? 'Running' : 'Stopped';
  const shotClockTone = displayedShotClock === 0
    ? 'text-red-400 drop-shadow-[0_0_32px_rgba(239,68,68,0.45)]'
    : displayedShotClock <= 5
      ? 'text-orange-300 drop-shadow-[0_0_32px_rgba(249,115,22,0.35)]'
      : 'text-white drop-shadow-[0_0_32px_rgba(255,255,255,0.12)]';

  const commitTimerUpdates = (updates: Partial<TimerState>) => {
    const now = Date.now();
    const currentState = projectPreciseTimerState(buildCurrentTimerState(), now);
    const timerState: TimerState = {
      ...currentState,
      ...updates,
      gameClock: Math.floor(updates.gameClock ?? currentState.gameClock),
      mode: currentState.isRunning ? 'run' : 'pause',
      isRunning: currentState.isRunning,
      isPaused: !currentState.isRunning,
      lastUpdated: now,
    };

    applyTimerState(timerState);
    void sendCommand('set_timer', { timerState, mode: buildBasketballMode() });
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

  const updateHomeTimeouts = (value: number) => {
    commitTimerUpdates({ homeTimeouts: clampSeconds(value, 0, 9) });
  };

  const updateAwayTimeouts = (value: number) => {
    commitTimerUpdates({ awayTimeouts: clampSeconds(value, 0, 9) });
  };

  const startTimer = async () => {
    const timerState = startTimerState(buildCurrentTimerState());
    const success = await sendCommand('set_timer', { timerState, mode: buildBasketballMode() });
    if (success) {
      applyTimerState(timerState);
      setTimerRunning(true);
    }
  };

  const pauseTimer = async () => {
    const timerState = pausePreciseTimerState(buildCurrentTimerState());
    const success = await sendCommand('set_timer', { timerState, mode: buildBasketballMode() });
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
      homeTimeouts: 0,
      awayTimeouts: 0,
      period: 1,
    });
    const success = await sendCommand('set_timer', { timerState, mode: buildBasketballMode() });
    if (success) {
      applyTimerState(timerState);
      setPeriod(timerState.period ?? 1);
      setHomeScore(timerState.homeScore);
      setAwayScore(timerState.awayScore);
      setHomeTimeouts(timerState.homeTimeouts ?? 0);
      setAwayTimeouts(timerState.awayTimeouts ?? 0);
      setTimerRunning(false);
    }
  };

  const applyTimerState = (timerState: TimerState) => {
    setShotClock(timerState.shotClock);
    setGameClock(timerState.gameClock);
    setPeriod(timerState.period ?? 1);
    setHomeScore(timerState.homeScore);
    setAwayScore(timerState.awayScore);
    setHomeTimeouts(timerState.homeTimeouts ?? 0);
    setAwayTimeouts(timerState.awayTimeouts ?? 0);
    setTimerRunning(timerState.isRunning);
    setTimerLastUpdated(timerState.lastUpdated);
    setTimerNow(timerState.lastUpdated);
  };

  const buildScoreboardBranding = (): ScoreboardBranding => ({
    enabled: scoreboardBrandingEnabled,
    showTimeouts: scoreboardTimeoutsVisible,
    homeLabel: normalizeScoreboardLabel(homeLabel, 'Home'),
    awayLabel: normalizeScoreboardLabel(awayLabel, 'Away'),
    homeColor,
    awayColor,
    ...(homeLogoUrl ? { homeLogoUrl } : {}),
    ...(awayLogoUrl ? { awayLogoUrl } : {}),
  });

  const buildBasketballMode = (mode: BasketballPreviewMode = previewMode): DeviceMode => ({
    type: 'basketball',
    subMode: mode === 'regular' ? 'shot-clock-only' : mode,
    ...(mode !== 'regular' ? { scoreboardBranding: buildScoreboardBranding() } : {}),
  });

  const switchPreviewMode = (mode: BasketballPreviewMode) => {
    setPreviewMode(mode);
    void sendCommand('set_mode', { mode: buildBasketballMode(mode) });
  };

  const uploadScoreboardLogo = async (team: 'home' | 'away', file: File | null) => {
    if (!file) return;

    setUploadingLogo(team);
    setCommandError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('slot', team === 'home' ? 'scoreboard-home-logo' : 'scoreboard-away-logo');

      const response = await fetch(`/api/devices/${deviceId}/media`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setCommandError(data?.error || `Upload failed with HTTP ${response.status}`);
        return;
      }

      const publicUrl = getPublicMediaUrl(data.mediaAsset.url);
      if (team === 'home') {
        setHomeLogoUrl(publicUrl);
      } else {
        setAwayLogoUrl(publicUrl);
      }
    } catch (err) {
      setCommandError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingLogo(null);
    }
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
      <div className="mb-5">
        <Link href={`/devices/${deviceId}`} className="mb-3 inline-block text-sm text-gray-400 hover:text-white">
          ← Back to Sports
        </Link>
        {commandError && (
          <div className="mb-4 rounded border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
            {commandError}
          </div>
        )}
        <SyncTargetBanner deviceId={deviceId} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Basketball Controls</h1>
            <p className="mt-1 font-mono text-sm text-gray-400">{device.deviceId}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            device.isOnline ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {device.isOnline ? '● Online' : '○ Offline'}
          </span>
        </div>
      </div>

      <section className="cc-card mb-4 p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Shot Clock Preview</div>
            <p className="mt-1 text-sm text-gray-400">
              {previewMode === 'regular'
                ? 'Large countdown-only view.'
                : previewMode === 'scoreboard'
                  ? 'Score-first view with a compact shot clock.'
                  : 'Mirrors the current Pi display layout.'}
            </p>
          </div>
          <div className="flex rounded-lg border border-white/10 bg-black/30 p-1">
            {(['regular', 'advanced', 'scoreboard'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchPreviewMode(mode)}
                className={`rounded-md px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  previewMode === mode
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {previewMode === 'advanced' ? (
          <AdvancedBasketballPreview
            shotClockText={displayedShotClockText}
            gameClock={displayedGameClock}
            homeScore={homeScore}
            awayScore={awayScore}
            period={period}
            shotClockTone={shotClockTone}
            branding={buildScoreboardBranding()}
          />
        ) : previewMode === 'scoreboard' ? (
          <ScoreboardBasketballPreview
            shotClockText={displayedShotClockText}
            gameClock={displayedGameClock}
            homeScore={homeScore}
            awayScore={awayScore}
            homeTimeouts={homeTimeouts}
            awayTimeouts={awayTimeouts}
            period={period}
            shotClockTone={shotClockTone}
            branding={buildScoreboardBranding()}
          />
        ) : (
          <RegularShotClockPreview
            shotClockText={displayedShotClockText}
            shotClockTone={shotClockTone}
          />
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm font-semibold text-gray-300">
          <span className={`h-3 w-3 rounded-full ${
            timerRunning ? 'bg-green-400 shadow-[0_0_14px_rgba(34,197,94,0.7)]' : 'bg-gray-600'
          }`} />
          <span>{shotClockStatus}</span>
          <span className="text-gray-600">/</span>
          <span>Game {formatGameClock(displayedGameClock)}</span>
          <span className="text-gray-600">/</span>
          <span>Quarter {period}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
              onClick={() => updateShotClock(35)}
              disabled={timerRunning}
              className="cc-btn cc-btn-blue px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset 35
            </button>
            <button
              onClick={() => updateShotClock(25)}
              disabled={timerRunning}
              className="cc-btn cc-btn-blue px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset 25
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
              Custom Shot Clock
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateShotClock(Math.floor(displayedShotClock) - 1)}
                disabled={timerRunning}
                className="rounded-lg bg-white/10 px-4 py-2 text-xl font-black hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                -
              </button>
              <input
                type="number"
                value={Math.floor(displayedShotClock)}
                onChange={(e) => updateShotClock(parseInt(e.target.value, 10) || 0)}
                disabled={timerRunning}
                className="min-w-0 flex-1 rounded-lg px-3 py-2 text-center font-mono text-2xl font-black disabled:opacity-50"
              />
              <button
                onClick={() => updateShotClock(Math.floor(displayedShotClock) + 1)}
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
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Quarter</span>
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
            <ScoreControl label="Home Timeouts" value={homeTimeouts} onChange={updateHomeTimeouts} tone="text-red-200" />
            <ScoreControl label="Away Timeouts" value={awayTimeouts} onChange={updateAwayTimeouts} tone="text-blue-200" />
          </div>
        </ControlCard>
      </div>

      {(previewMode === 'advanced' || previewMode === 'scoreboard') && (
        <section className="cc-card mt-4 p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
                {previewMode === 'scoreboard' ? 'Scoreboard Branding' : 'Advanced Branding'}
              </div>
              <p className="mt-1 text-sm text-gray-400">
                {previewMode === 'scoreboard'
                  ? 'Custom team labels, colors, and logos apply to scoreboard display mode.'
                  : 'Custom team labels and colors apply to advanced display mode.'}
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="text-sm font-semibold text-gray-300">
                {previewMode === 'scoreboard' ? 'Show custom labels/logos' : 'Show custom labels/colors'}
              </span>
              <input
                type="checkbox"
                checked={scoreboardBrandingEnabled}
                onChange={(event) => setScoreboardBrandingEnabled(event.target.checked)}
                className="h-5 w-5 accent-green-600"
              />
            </label>
          </div>

          {previewMode === 'scoreboard' && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-gray-300">Timeout Counts</div>
                <div className="mt-1 text-xs text-gray-500">Show or hide timeout counts on the scoreboard display.</div>
              </div>
              <label className="flex cursor-pointer items-center gap-3">
                <span className="text-sm font-semibold text-gray-400">{scoreboardTimeoutsVisible ? 'Visible' : 'Hidden'}</span>
                <input
                  type="checkbox"
                  checked={scoreboardTimeoutsVisible}
                  onChange={(event) => setScoreboardTimeoutsVisible(event.target.checked)}
                  className="h-5 w-5 accent-green-600"
                />
              </label>
            </div>
          )}

          {scoreboardBrandingEnabled && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TeamBrandingControl
                team="home"
                label={homeLabel}
                logoUrl={homeLogoUrl}
                color={homeColor}
                defaultColor={DEFAULT_HOME_COLOR}
                uploading={uploadingLogo === 'home'}
                showLogo={previewMode === 'scoreboard'}
                onLabelChange={setHomeLabel}
                onColorChange={setHomeColor}
                onColorReset={() => setHomeColor(DEFAULT_HOME_COLOR)}
                onLogoChange={(file) => uploadScoreboardLogo('home', file)}
                onLogoClear={() => setHomeLogoUrl('')}
              />
              <TeamBrandingControl
                team="away"
                label={awayLabel}
                logoUrl={awayLogoUrl}
                color={awayColor}
                defaultColor={DEFAULT_AWAY_COLOR}
                uploading={uploadingLogo === 'away'}
                showLogo={previewMode === 'scoreboard'}
                onLabelChange={setAwayLabel}
                onColorChange={setAwayColor}
                onColorReset={() => setAwayColor(DEFAULT_AWAY_COLOR)}
                onLogoChange={(file) => uploadScoreboardLogo('away', file)}
                onLogoClear={() => setAwayLogoUrl('')}
              />
            </div>
          )}
        </section>
      )}

      <GamePresentationControls deviceId={deviceId} />
    </div>
  );
}

function hydrateTimerState(timerState?: TimerState | null): TimerState {
  const now = Date.now();
  const projectedTimerState = timerState
    ? projectPreciseTimerState(timerState, now)
    : createDefaultTimerState(now);

  return {
    ...projectedTimerState,
    mode: projectedTimerState.isRunning ? 'run' : 'pause',
    isPaused: !projectedTimerState.isRunning,
    lastUpdated: now,
  };
}

function RegularShotClockPreview({
  shotClockText,
  shotClockTone,
}: {
  shotClockText: string;
  shotClockTone: string;
}) {
  const shotClockSize = shotClockText.includes('.')
    ? 'text-[5.5rem] md:text-[8rem]'
    : 'text-[10rem] md:text-[15rem]';

  return (
    <div className="rounded-2xl border-4 border-gray-700 bg-black p-4 shadow-inner shadow-black/60">
      <div className="grid min-h-[18rem] place-items-center rounded-xl border-2 border-gray-800 bg-black md:min-h-[22rem]">
        <div className="text-center">
          <div className={`font-mono font-black leading-none tabular-nums ${shotClockSize} ${shotClockTone}`}>
            {shotClockText}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedBasketballPreview({
  shotClockText,
  gameClock,
  homeScore,
  awayScore,
  period,
  shotClockTone,
  branding,
}: {
  shotClockText: string;
  gameClock: number;
  homeScore: number;
  awayScore: number;
  period: number;
  shotClockTone: string;
  branding: ScoreboardBranding;
}) {
  const shotClockSize = shotClockText.includes('.')
    ? 'text-[5.5rem] md:text-[7rem]'
    : 'text-[10rem] md:text-[13rem]';
  const homeDisplayLabel = branding.enabled ? normalizeScoreboardLabel(branding.homeLabel, 'H') : 'H';
  const awayDisplayLabel = branding.enabled ? normalizeScoreboardLabel(branding.awayLabel, 'A') : 'A';
  const homeColor = branding.enabled && isHexColor(branding.homeColor) ? branding.homeColor : DEFAULT_HOME_COLOR;
  const awayColor = branding.enabled && isHexColor(branding.awayColor) ? branding.awayColor : DEFAULT_AWAY_COLOR;

  return (
    <div className="rounded-2xl border-4 border-gray-700 bg-black p-4 shadow-inner shadow-black/60">
      <div className="mx-auto grid aspect-[4/3] max-h-[28rem] min-h-[20rem] w-full max-w-[38rem] grid-rows-[13%_50%_15%_22%] overflow-hidden rounded-xl border-2 border-gray-800 bg-black px-4 py-3 font-mono text-white">
        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center overflow-hidden leading-none">
          <span className="text-2xl font-bold text-gray-400">Q{period}</span>
          <span className="text-5xl font-black tabular-nums text-white">{formatGameClock(gameClock)}</span>
          <span />
        </div>

        <div className="grid min-h-0 place-items-center border-2 border-gray-700">
          <div className={`translate-y-[0.06em] font-mono font-black leading-[0.82] tabular-nums ${shotClockSize} ${shotClockTone}`}>
            {shotClockText}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-4 overflow-hidden leading-tight">
          <div className="whitespace-normal text-center text-2xl font-black uppercase" style={{ color: homeColor }}>{homeDisplayLabel}</div>
          <div className="w-10" />
          <div className="whitespace-normal text-center text-2xl font-black uppercase" style={{ color: awayColor }}>{awayDisplayLabel}</div>
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-hidden leading-none">
          <div className="flex min-h-0 items-center justify-center overflow-hidden">
            <span className="text-center text-6xl font-black leading-none tabular-nums" style={{ color: homeColor }}>{homeScore}</span>
          </div>
          <span className="text-2xl font-bold text-gray-600">-</span>
          <div className="flex min-h-0 items-center justify-center overflow-hidden">
            <span className="text-center text-6xl font-black leading-none tabular-nums" style={{ color: awayColor }}>{awayScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreboardBasketballPreview({
  shotClockText,
  gameClock,
  homeScore,
  awayScore,
  homeTimeouts,
  awayTimeouts,
  period,
  shotClockTone,
  branding,
}: {
  shotClockText: string;
  gameClock: number;
  homeScore: number;
  awayScore: number;
  homeTimeouts: number;
  awayTimeouts: number;
  period: number;
  shotClockTone: string;
  branding: ScoreboardBranding;
}) {
  const homeDisplayLabel = branding.enabled ? normalizeScoreboardLabel(branding.homeLabel, 'Home') : 'Home';
  const awayDisplayLabel = branding.enabled ? normalizeScoreboardLabel(branding.awayLabel, 'Away') : 'Away';
  const showLogos = branding.enabled && (branding.homeLogoUrl || branding.awayLogoUrl);
  const showTimeouts = branding.showTimeouts !== false;
  const homeColor = branding.enabled && isHexColor(branding.homeColor) ? branding.homeColor : DEFAULT_HOME_COLOR;
  const awayColor = branding.enabled && isHexColor(branding.awayColor) ? branding.awayColor : DEFAULT_AWAY_COLOR;

  return (
    <div className="rounded-2xl border-4 border-gray-700 bg-black p-4 shadow-inner shadow-black/60">
      <div className="mx-auto grid aspect-[4/3] max-h-[28rem] min-h-[20rem] w-full max-w-[38rem] grid-rows-[13%_13%_34%_13%_27%] overflow-hidden rounded-xl border-2 border-gray-800 bg-black px-4 py-3 font-mono text-white">
        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-3 overflow-hidden leading-none">
          <div className="text-2xl font-black text-gray-400">Q{period}</div>
          <div className="text-5xl font-black tabular-nums text-white">{formatGameClock(gameClock)}</div>
          <div />
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-hidden leading-none">
          <div className="truncate text-center text-2xl font-black uppercase" style={{ color: homeColor }}>{homeDisplayLabel}</div>
          <div className="text-xl font-black text-gray-700">-</div>
          <div className="truncate text-center text-2xl font-black uppercase" style={{ color: awayColor }}>{awayDisplayLabel}</div>
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-3 overflow-hidden leading-none">
          <div className="flex min-w-0 items-center justify-center overflow-hidden text-[8rem] font-black tabular-nums" style={{ color: homeColor }}>
            {homeScore}
          </div>
          <div className="text-5xl font-black text-gray-700">-</div>
          <div className="flex min-w-0 items-center justify-center overflow-hidden text-[8rem] font-black tabular-nums" style={{ color: awayColor }}>
            {awayScore}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-3 overflow-hidden leading-none">
          <div className="flex h-full items-center justify-center overflow-hidden">
            {showLogos && branding.homeLogoUrl ? (
              <img src={branding.homeLogoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : null}
          </div>
          <div />
          <div className="flex h-full items-center justify-center overflow-hidden">
            {showLogos && branding.awayLogoUrl ? (
              <img src={branding.awayLogoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : null}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-3 overflow-hidden leading-none">
          <div className="grid w-full grid-cols-[auto_1fr] items-center gap-3">
            {showTimeouts ? (
              <div className="flex items-center gap-2 text-2xl font-black" style={{ color: homeColor }}>
                <span className="text-sm uppercase text-gray-500">TO</span>
                <span className="tabular-nums">{homeTimeouts}</span>
              </div>
            ) : <div />}
            <div className="h-[2px] bg-gray-800" />
          </div>
          <div className="flex h-[90%] aspect-square items-center justify-center overflow-hidden border-2 border-gray-700 px-4">
            <div className={`translate-y-[0.04em] text-7xl font-black leading-[0.82] tabular-nums ${shotClockTone}`}>
              {shotClockText}
            </div>
          </div>
          <div className="grid w-full grid-cols-[1fr_auto] items-center gap-3">
            <div className="h-[2px] bg-gray-800" />
            {showTimeouts ? (
              <div className="flex items-center gap-2 text-2xl font-black" style={{ color: awayColor }}>
                <span className="tabular-nums">{awayTimeouts}</span>
                <span className="text-sm uppercase text-gray-500">TO</span>
              </div>
            ) : <div />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamBrandingControl({
  team,
  label,
  logoUrl,
  uploading,
  showLogo,
  onLabelChange,
  color,
  defaultColor,
  onColorChange,
  onColorReset,
  onLogoChange,
  onLogoClear,
}: {
  team: 'home' | 'away';
  label: string;
  logoUrl: string;
  uploading: boolean;
  showLogo: boolean;
  onLabelChange: (value: string) => void;
  color: string;
  defaultColor: string;
  onColorChange: (value: string) => void;
  onColorReset: () => void;
  onLogoChange: (file: File | null) => void;
  onLogoClear: () => void;
}) {
  const title = team === 'home' ? 'Home Team' : 'Away Team';

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
        {title} Label
      </label>
      <input
        type="text"
        value={label}
        maxLength={18}
        onChange={(event) => onLabelChange(event.target.value)}
        className="w-full rounded-lg px-3 py-2 font-semibold"
        placeholder={team === 'home' ? 'Home' : 'Away'}
      />

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
            Team Color
          </label>
          <button
            type="button"
            onClick={onColorReset}
            disabled={color.toLowerCase() === defaultColor.toLowerCase()}
            className="text-xs font-semibold text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(event) => onColorChange(event.target.value)}
            className="h-11 w-14 cursor-pointer rounded border border-white/10 bg-transparent p-1"
          />
          <span className="font-mono text-sm font-semibold uppercase text-gray-300">{color}</span>
        </div>
      </div>

      {showLogo && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <label className="cc-btn cc-btn-secondary cursor-pointer px-4 py-2 text-sm">
              {uploading ? 'Uploading...' : 'Upload Logo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  onLogoChange(event.currentTarget.files?.[0] || null);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            {logoUrl && (
              <button type="button" onClick={onLogoClear} className="text-sm font-semibold text-gray-400 hover:text-white">
                Clear
              </button>
            )}
          </div>

          <div className="mt-3 grid h-20 place-items-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs font-semibold text-gray-600">No logo selected</span>
            )}
          </div>
        </>
      )}
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
    <section className="cc-card cc-card-hover p-5">
      <div className="mb-4 flex items-center gap-3">
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

function getPreviewModeFromDeviceMode(mode?: DeviceMode): BasketballPreviewMode {
  if (mode?.subMode === 'advanced' || mode?.subMode === 'scoreboard') return mode.subMode;
  return 'regular';
}

function normalizeScoreboardLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 18) : fallback;
}

function isHexColor(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
}

function getPublicMediaUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
}
