'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  DeviceMode,
  PrimaryClockResetAction,
  ScoreboardBranding,
  SportDisplayAdMode,
  SportDisplayLayout,
  SportType,
  TimerState,
} from '@shotclock/shared/types';
import {
  createDefaultTimerState,
  pauseTimerState,
  projectTimerState,
  startTimerState,
  stopTimerState,
} from '@shotclock/shared/timer';
import GamePresentationControls from './GamePresentationControls';
import SportDisplayLayoutControls, {
  buildThreePanelSportLayout,
  createPrimaryClockResetAction,
  DEFAULT_SPORT_DISPLAY_AD_MODE,
  getActiveSportAdPlaylist,
  getSportDisplayAdMode,
} from './SportDisplayLayoutControls';
import { SyncTargetBanner, useDeviceCommandDispatcher } from '../../SelectedDevicesProvider';

const DEFAULT_HOME_COLOR = '#ef4444';
const DEFAULT_AWAY_COLOR = '#3b82f6';
const DEFAULT_WRESTLING_AWAY_COLOR = '#22c55e';

type SportConfig = {
  sport: SportType;
  title: string;
  clockLabel: string;
  periodLabel: string;
  homeLabel: string;
  awayLabel: string;
  showSets?: boolean;
};

type VolleyballTopDisplay = 'empty' | 'school-logo' | 'ads';

type DeviceMediaAsset = {
  id: string;
  slot: string;
  url: string;
  mimeType: string;
  isActive: boolean;
};

interface Device {
  deviceId: string;
  name: string;
  isOnline: boolean;
  timerState?: TimerState | null;
  displayState?: {
    deviceMode?: DeviceMode;
    sportDisplayLayoutPreference?: SportDisplayLayout | null;
  } | null;
  capabilities?: string[];
}

export default function SportControlPage({ deviceId, config }: { deviceId: string; config: SportConfig }) {
  const [device, setDevice] = useState<Device | null>(null);
  const [loadedSport, setLoadedSport] = useState<SportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [timerState, setTimerState] = useState<TimerState>(() => ({
    ...createDefaultTimerState(),
    mode: 'pause',
    isPaused: true,
  }));
  const [now, setNow] = useState(Date.now());
  const [brandingEnabled, setBrandingEnabled] = useState(false);
  const [homeLabel, setHomeLabel] = useState(config.homeLabel);
  const [awayLabel, setAwayLabel] = useState(config.awayLabel);
  const [homeColor, setHomeColor] = useState(() => getDefaultHomeColor(config.sport));
  const [awayColor, setAwayColor] = useState(() => getDefaultAwayColor(config.sport));
  const [volleyballTopDisplay, setVolleyballTopDisplay] = useState<VolleyballTopDisplay>('empty');
  const [mediaAssets, setMediaAssets] = useState<DeviceMediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [threePanelEnabled, setThreePanelEnabled] = useState(false);
  const [sportDisplayAdMode, setSportDisplayAdMode] = useState<SportDisplayAdMode>(DEFAULT_SPORT_DISPLAY_AD_MODE);
  const [hydratedSportDisplayLayout, setHydratedSportDisplayLayout] = useState<SportDisplayLayout | undefined>();
  const [layoutSaving, setLayoutSaving] = useState(false);
  const modeUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isSyncActive, sendCommand: dispatchCommand } = useDeviceCommandDispatcher(deviceId);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setCommandError(null);
    setDevice(null);
    setLoadedSport(null);
    setThreePanelEnabled(false);
    setSportDisplayAdMode(DEFAULT_SPORT_DISPLAY_AD_MODE);
    setHydratedSportDisplayLayout(undefined);

    const fetchDevice = async () => {
      try {
        const response = await fetch(`/api/devices/${deviceId}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Device not found');
        const data = await response.json();
        const loadedMode = data.device.displayState?.deviceMode as DeviceMode | undefined;
        const loadedBranding = loadedMode?.scoreboardBranding;
        const loadedTimerState = hydrateTimerState(data.device.timerState);

        setTimerState(loadedTimerState);
        setNow(loadedTimerState.lastUpdated);
        if (supportsTeamBranding(config.sport)) {
          setBrandingEnabled(Boolean(loadedBranding?.enabled));
          setHomeLabel(loadedBranding?.homeLabel || config.homeLabel);
          setAwayLabel(loadedBranding?.awayLabel || config.awayLabel);
          setHomeColor(isHexColor(loadedBranding?.homeColor) ? loadedBranding.homeColor : getDefaultHomeColor(config.sport));
          setAwayColor(isHexColor(loadedBranding?.awayColor) ? loadedBranding.awayColor : getDefaultAwayColor(config.sport));
        }
        if (config.sport === 'volleyball') {
          setVolleyballTopDisplay(isVolleyballTopDisplay(loadedBranding?.volleyballTopDisplay)
            ? loadedBranding.volleyballTopDisplay
            : 'empty');
        }
        const savedLayoutPreference = data.device.displayState?.sportDisplayLayoutPreference as SportDisplayLayout | undefined;
        const loadedSportDisplayLayout = loadedMode?.sportDisplayLayout?.type === 'three-panel'
          ? loadedMode.sportDisplayLayout
          : savedLayoutPreference?.type === 'three-panel'
            ? savedLayoutPreference
            : undefined;
        setHydratedSportDisplayLayout(loadedSportDisplayLayout);
        setThreePanelEnabled(Boolean(loadedSportDisplayLayout));
        setSportDisplayAdMode(getSportDisplayAdMode(loadedSportDisplayLayout));
        setDevice(data.device);
        setLoadedSport(config.sport);
      } catch (error) {
        if (!controller.signal.aborted) {
          setCommandError(error instanceof Error ? error.message : 'Unable to load display');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void fetchDevice();
    return () => controller.abort();
  }, [deviceId, config.sport]);

  useEffect(() => {
    const controller = new AbortController();
    setMediaAssets([]);
    setMediaLoading(true);
    setMediaError(null);

    const fetchMediaAssets = async () => {
      try {
        const response = await fetch(`/api/devices/${deviceId}/media`, { signal: controller.signal });
        if (!response.ok) throw new Error('Unable to load active ads');
        const data = await response.json();
        setMediaAssets(data.mediaAssets || []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setMediaError(error instanceof Error ? error.message : 'Unable to load active ads');
        }
      } finally {
        if (!controller.signal.aborted) setMediaLoading(false);
      }
    };

    void fetchMediaAssets();
    return () => controller.abort();
  }, [deviceId]);

  useEffect(() => {
    if (
      device?.deviceId !== deviceId ||
      loadedSport !== config.sport ||
      mediaLoading ||
      (threePanelEnabled && mediaError && !hydratedSportDisplayLayout)
    ) return;

    if (modeUpdateTimeoutRef.current) clearTimeout(modeUpdateTimeoutRef.current);
    const timeout = setTimeout(() => {
      modeUpdateTimeoutRef.current = null;
      void setSportMode();
    }, 250);
    modeUpdateTimeoutRef.current = timeout;

    return () => {
      clearTimeout(timeout);
      if (modeUpdateTimeoutRef.current === timeout) modeUpdateTimeoutRef.current = null;
    };
  }, [device?.deviceId, loadedSport, config.sport, brandingEnabled, homeLabel, awayLabel, homeColor, awayColor, volleyballTopDisplay, mediaAssets, mediaError, mediaLoading]);

  useEffect(() => {
    if (!timerState.isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timerState.isRunning]);

  const projectedState = projectTimerState(timerState, now);

  const buildTeamBranding = (): ScoreboardBranding => ({
    enabled: brandingEnabled,
    homeLabel: normalizeTeamLabel(homeLabel, config.homeLabel),
    awayLabel: normalizeTeamLabel(awayLabel, config.awayLabel),
    homeColor,
    awayColor,
    ...(config.sport === 'volleyball' ? buildVolleyballTopMediaPayload(volleyballTopDisplay, mediaAssets) : {}),
  });

  const resolveSportDisplayLayout = (
    enabled = threePanelEnabled,
    adMode = sportDisplayAdMode
  ): SportDisplayLayout | undefined => {
    if (!enabled) return undefined;
    const localLayout = buildThreePanelSportLayout(mediaAssets, adMode);
    const sourceLayout = mediaLoading || mediaError
      ? hydratedSportDisplayLayout
      : localLayout.adPlaylist.length === 0 && hydratedSportDisplayLayout?.adPlaylist.length
        ? hydratedSportDisplayLayout
        : localLayout;
    return sourceLayout ? { ...sourceLayout, adMode } : undefined;
  };

  const buildSportMode = (
    layoutEnabled = threePanelEnabled,
    adMode = sportDisplayAdMode
  ): DeviceMode => {
    const sportDisplayLayout = resolveSportDisplayLayout(layoutEnabled, adMode);
    return {
      type: config.sport,
      ...(supportsTeamBranding(config.sport) ? { scoreboardBranding: buildTeamBranding() } : {}),
      ...(sportDisplayLayout ? { sportDisplayLayout } : {}),
    };
  };

  const setSportMode = async () => {
    const mode = buildSportMode();
    await sendCommand('set_mode', { mode });
  };

  const sendCommandWithResult = async (type: string, payload?: unknown) => {
    setCommandError(null);
    try {
      const { response, data } = await dispatchCommand(type, payload);
      if (!response.ok) {
        setCommandError(data?.error || `Command failed with HTTP ${response.status}`);
        return { success: false, data };
      }
      return { success: true, data };
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : 'Command failed');
      return { success: false, data: null };
    }
  };

  const sendCommand = async (type: string, payload?: unknown) => {
    return (await sendCommandWithResult(type, payload)).success;
  };

  const changeThreePanelLayout = async (enabled: boolean) => {
    if (enabled === threePanelEnabled || layoutSaving) return;

    const previousValue = threePanelEnabled;
    if (modeUpdateTimeoutRef.current) {
      clearTimeout(modeUpdateTimeoutRef.current);
      modeUpdateTimeoutRef.current = null;
    }
    setThreePanelEnabled(enabled);
    setLayoutSaving(true);
    const mode = buildSportMode(enabled);
    const success = await sendCommand('set_mode', { mode });
    if (!success) {
      setThreePanelEnabled(previousValue);
    } else {
      setHydratedSportDisplayLayout(mode.sportDisplayLayout);
    }
    setLayoutSaving(false);
  };

  const changeSportDisplayAdMode = async (adMode: SportDisplayAdMode) => {
    if (adMode === sportDisplayAdMode || layoutSaving) return;

    const previousMode = sportDisplayAdMode;
    if (modeUpdateTimeoutRef.current) {
      clearTimeout(modeUpdateTimeoutRef.current);
      modeUpdateTimeoutRef.current = null;
    }
    setSportDisplayAdMode(adMode);
    setLayoutSaving(true);
    const mode = buildSportMode(true, adMode);
    const success = await sendCommand('set_mode', { mode });
    if (!success) {
      setSportDisplayAdMode(previousMode);
    } else {
      setHydratedSportDisplayLayout(mode.sportDisplayLayout);
    }
    setLayoutSaving(false);
  };

  const sendTimerState = async (
    nextState: TimerState,
    timerAction?: PrimaryClockResetAction
  ) => {
    const mode = buildSportMode();
    const result = await sendCommandWithResult('set_timer', { timerState: nextState, mode, timerAction });
    if (result.success) {
      const appliedState = hydrateTimerState(result.data?.timerState || nextState);
      setTimerState(appliedState);
      setNow(appliedState.lastUpdated);
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
      homeTimeouts: 0,
      awayTimeouts: 0,
      period: 1,
    }), createPrimaryClockResetAction());
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

      <SyncTargetBanner deviceId={deviceId} />

      <SportDisplayLayoutControls
        deviceId={deviceId}
        enabled={threePanelEnabled}
        adMode={sportDisplayAdMode}
        activeAdCount={threePanelEnabled
          ? resolveSportDisplayLayout()?.adPlaylist.length ?? 0
          : getActiveSportAdPlaylist(mediaAssets).length}
        mediaLoading={mediaLoading}
        mediaError={mediaError}
        capabilities={device?.capabilities}
        isSyncActive={isSyncActive}
        layoutSaving={layoutSaving}
        onEnabledChange={changeThreePanelLayout}
        onAdModeChange={changeSportDisplayAdMode}
      />

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
              label={brandingEnabled ? normalizeTeamLabel(homeLabel, config.homeLabel) : config.homeLabel}
              value={projectedState.homeScore}
              onChange={(homeScore) => updateTimerState({ homeScore })}
            />
            <ScoreControl
              label={brandingEnabled ? normalizeTeamLabel(awayLabel, config.awayLabel) : config.awayLabel}
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

          {config.sport === 'volleyball' && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <ScoreControl
                label="Home Timeouts"
                value={projectedState.homeTimeouts ?? 0}
                onChange={(homeTimeouts) => updateTimerState({ homeTimeouts: Math.min(2, homeTimeouts) })}
              />
              <ScoreControl
                label="Away Timeouts"
                value={projectedState.awayTimeouts ?? 0}
                onChange={(awayTimeouts) => updateTimerState({ awayTimeouts: Math.min(2, awayTimeouts) })}
              />
            </div>
          )}
        </div>
      </div>

      {config.sport === 'volleyball' && (
        <section className="cc-card mt-4 p-4 md:p-5">
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Top Display</div>
            <p className="mt-1 text-sm text-gray-400">Choose what appears in the top-center volleyball display area.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['empty', 'school-logo', 'ads'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVolleyballTopDisplay(option)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  volleyballTopDisplay === option
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/15'
                }`}
              >
                {option === 'school-logo' ? 'School Logo' : option}
              </button>
            ))}
          </div>
        </section>
      )}

      {supportsTeamBranding(config.sport) && (
        <section className="cc-card mt-4 p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">{formatSportLabel(config.sport)} Branding</div>
              <p className="mt-1 text-sm text-gray-400">Custom team labels and colors apply to the {formatSportLabel(config.sport).toLowerCase()} display.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="text-sm font-semibold text-gray-300">Show custom labels/colors</span>
              <input
                type="checkbox"
                checked={brandingEnabled}
                onChange={(event) => setBrandingEnabled(event.target.checked)}
                className="h-5 w-5 accent-green-600"
              />
            </label>
          </div>

          {brandingEnabled && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TeamBrandingControl
                title="Home Team"
                label={homeLabel}
                color={homeColor}
                defaultColor={getDefaultHomeColor(config.sport)}
                fallbackLabel={config.homeLabel}
                onLabelChange={setHomeLabel}
                onColorChange={setHomeColor}
                onColorReset={() => setHomeColor(getDefaultHomeColor(config.sport))}
              />
              <TeamBrandingControl
                title="Away Team"
                label={awayLabel}
                color={awayColor}
                defaultColor={getDefaultAwayColor(config.sport)}
                fallbackLabel={config.awayLabel}
                onLabelChange={setAwayLabel}
                onColorChange={setAwayColor}
                onColorReset={() => setAwayColor(getDefaultAwayColor(config.sport))}
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

function TeamBrandingControl({
  title,
  label,
  color,
  defaultColor,
  fallbackLabel,
  onLabelChange,
  onColorChange,
  onColorReset,
}: {
  title: string;
  label: string;
  color: string;
  defaultColor: string;
  fallbackLabel: string;
  onLabelChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onColorReset: () => void;
}) {
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
        placeholder={fallbackLabel}
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
    </div>
  );
}

function normalizeTeamLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 18) : fallback;
}

function isHexColor(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
}

function supportsTeamBranding(sport: SportType) {
  return sport === 'volleyball' || sport === 'wrestling';
}

function getDefaultHomeColor(_sport: SportType) {
  return DEFAULT_HOME_COLOR;
}

function getDefaultAwayColor(sport: SportType) {
  return sport === 'wrestling' ? DEFAULT_WRESTLING_AWAY_COLOR : DEFAULT_AWAY_COLOR;
}

function formatSportLabel(sport: SportType) {
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

function isVolleyballTopDisplay(value: string | undefined): value is VolleyballTopDisplay {
  return value === 'empty' || value === 'school-logo' || value === 'ads';
}

function buildVolleyballTopMediaPayload(
  topDisplay: VolleyballTopDisplay,
  mediaAssets: DeviceMediaAsset[]
): Partial<ScoreboardBranding> {
  if (topDisplay === 'empty') {
    return { volleyballTopDisplay: 'empty' };
  }

  if (topDisplay === 'school-logo') {
    const logo = mediaAssets.find((asset) => asset.slot === 'logo' && asset.isActive && isVisualMedia(asset));
    return {
      volleyballTopDisplay: 'school-logo',
      ...(logo ? {
        volleyballTopMediaUrl: getPublicMediaUrl(logo.url),
        volleyballTopMediaMimeType: logo.mimeType,
      } : {}),
    };
  }

  const playlist = mediaAssets
    .filter((asset) => asset.slot === 'ads' && asset.isActive && isVisualMedia(asset))
    .map((asset) => ({
      mediaUrl: getPublicMediaUrl(asset.url),
      mediaMimeType: asset.mimeType,
    }));

  return {
    volleyballTopDisplay: 'ads',
    ...(playlist[0] ? {
      volleyballTopMediaUrl: playlist[0].mediaUrl,
      volleyballTopMediaMimeType: playlist[0].mediaMimeType,
    } : {}),
    ...(playlist.length > 1 ? {
      volleyballTopMediaPlaylist: playlist,
      volleyballTopRotationIntervalMs: 8000,
    } : {}),
  };
}

function isVisualMedia(asset: DeviceMediaAsset) {
  return asset.mimeType.startsWith('image/') || asset.mimeType.startsWith('video/');
}

function getPublicMediaUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
}
