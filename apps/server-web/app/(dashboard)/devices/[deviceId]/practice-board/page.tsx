'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DeviceMode,
  PracticeBoardDrill,
  PracticeBoardState,
  PracticeBoardWeather,
} from '@shotclock/shared/types';
import { SyncTargetBanner, useDeviceCommandDispatcher } from '../../../SelectedDevicesProvider';

type EditableDrill = {
  id: string;
  title: string;
  durationText: string;
};

type DeviceResponse = {
  device: {
    name: string;
    displayState?: { deviceMode?: DeviceMode };
  };
};

const MAX_DRILLS = 12;

export default function PracticeBoardPage({ params }: { params: { deviceId: string } }) {
  const { deviceId } = params;
  const { sendCommand } = useDeviceCommandDispatcher(deviceId);
  const [deviceName, setDeviceName] = useState('Practice Board');
  const [drills, setDrills] = useState<EditableDrill[]>([]);
  const [board, setBoard] = useState<PracticeBoardState>(emptyBoard());
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/devices/${deviceId}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load this display.');
        const data = await response.json() as DeviceResponse;
        const saved = data.device.displayState?.deviceMode?.practiceBoard;
        const nextBoard = normalizeBoard(saved);
        setDeviceName(data.device.name);
        setBoard(nextBoard);
        setDrills(nextBoard.drills.map(toEditableDrill));
        setLocation(nextBoard.weather?.locationLabel || '');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load this display.');
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [deviceId]);

  useEffect(() => {
    if (board.timerStatus !== 'running') return;
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, [board.startedAt, board.timerStatus]);

  const remainingSeconds = projectRemainingSeconds(board, now);
  const activeIndex = drills.findIndex((drill) => drill.id === board.activeDrillId);
  const activeDrill = activeIndex >= 0 ? drills[activeIndex] : null;
  const isActivelyRunning = board.timerStatus === 'running' && remainingSeconds > 0;
  const totalPracticeSeconds = useMemo(
    () => drills.reduce((total, drill) => total + parseDuration(drill.durationText), 0),
    [drills]
  );

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  };

  const dispatchBoard = async (nextBoard: PracticeBoardState, successMessage?: string) => {
    const previousBoard = board;
    const outgoing = snapshotBoard(nextBoard);
    setBoard(outgoing);
    setNow(Date.now());
    setSending(true);
    setError(null);

    try {
      const { response, data } = await sendCommand('set_mode', {
        mode: { type: 'practice-board', practiceBoard: outgoing } satisfies DeviceMode,
      });
      if (!response.ok) throw new Error(data?.error || 'The display did not accept the practice board.');
      setDirty(false);
      if (successMessage) showNotice(successMessage);
      return true;
    } catch (dispatchError) {
      setBoard(previousBoard);
      setNow(Date.now());
      setError(dispatchError instanceof Error ? dispatchError.message : 'Unable to update the display.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const boardWithCurrentDrills = (overrides: Partial<PracticeBoardState> = {}): PracticeBoardState => {
    const serializedDrills = serializeDrills(drills);
    const activeStillExists = serializedDrills.some((drill) => drill.id === board.activeDrillId);
    const base = snapshotBoard(board);
    return {
      ...base,
      drills: serializedDrills,
      ...(activeStillExists ? {} : { activeDrillId: undefined, timerStatus: 'idle', remainingSeconds: 0, startedAt: undefined }),
      ...overrides,
    };
  };

  const saveBoard = () => {
    const next = boardWithCurrentDrills();
    if (next.timerStatus === 'idle' && next.activeDrillId) {
      const active = next.drills.find((drill) => drill.id === next.activeDrillId);
      next.remainingSeconds = active?.durationSeconds || 0;
    }
    void dispatchBoard(next, 'Practice board updated.');
  };

  const addDrill = () => {
    if (drills.length >= MAX_DRILLS) return;
    setDrills((current) => [...current, { id: createId(), title: '', durationText: '05:00' }]);
    setDirty(true);
  };

  const updateDrill = (id: string, updates: Partial<EditableDrill>) => {
    setDrills((current) => current.map((drill) => drill.id === id ? { ...drill, ...updates } : drill));
    setDirty(true);
  };

  const removeDrill = (id: string) => {
    setDrills((current) => current.filter((drill) => drill.id !== id));
    setDirty(true);
  };

  const moveDrill = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= drills.length) return;
    setDrills((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDirty(true);
  };

  const startDrill = (id: string) => {
    const drill = serializeDrills(drills).find((item) => item.id === id);
    if (!drill || drill.durationSeconds <= 0) {
      setError('Give the drill a duration greater than 0:00 before starting it.');
      return;
    }
    void dispatchBoard(boardWithCurrentDrills({
      activeDrillId: id,
      timerStatus: 'running',
      remainingSeconds: drill.durationSeconds,
      startedAt: Date.now(),
    }), `Started ${drill.title || 'drill'}.`);
  };

  const resumeDrill = () => {
    if (!activeDrill || remainingSeconds <= 0) return;
    void dispatchBoard(boardWithCurrentDrills({
      timerStatus: 'running',
      remainingSeconds,
      startedAt: Date.now(),
    }), 'Drill resumed.');
  };

  const stopDrill = () => {
    if (!activeDrill) return;
    void dispatchBoard(boardWithCurrentDrills({
      timerStatus: 'paused',
      remainingSeconds,
      startedAt: undefined,
    }), 'Drill stopped.');
  };

  const restartDrill = () => {
    if (!activeDrill) return;
    startDrill(activeDrill.id);
  };

  const advanceDrill = (direction: 1 | -1) => {
    if (drills.length === 0) return;
    const targetIndex = activeIndex < 0
      ? (direction === 1 ? 0 : drills.length - 1)
      : activeIndex + direction;

    if (targetIndex < 0) return;
    if (targetIndex >= drills.length) {
      void dispatchBoard(boardWithCurrentDrills({
        timerStatus: 'complete',
        remainingSeconds: 0,
        startedAt: undefined,
      }), 'Practice plan complete.');
      return;
    }
    startDrill(drills[targetIndex].id);
  };

  const refreshWeather = async () => {
    const query = location.trim();
    if (query.length < 2) {
      setError('Enter a city, town, or postal code for weather.');
      return;
    }
    setWeatherLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/weather/current?location=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to load weather.');
      const weather = data.weather as PracticeBoardWeather;
      setLocation(weather.locationLabel);
      await dispatchBoard(boardWithCurrentDrills({ weather }), `Weather updated for ${weather.locationLabel}.`);
    } catch (weatherError) {
      setError(weatherError instanceof Error ? weatherError.message : 'Unable to load weather.');
    } finally {
      setWeatherLoading(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading practice board...</div>;
  }

  return (
    <div className="pb-12">
      <Link href={`/devices/${deviceId}`} className="mb-4 inline-block text-gray-400 hover:text-white">
        ← Back to Sports
      </Link>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">Football practice</div>
          <h1 className="mt-1 text-3xl font-bold">Practice Board</h1>
          <p className="mt-1 text-sm text-white/50">{deviceName} · Build the plan, set the conditions, then run each period.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/60">
            {drills.length} drill{drills.length === 1 ? '' : 's'} · {formatDuration(totalPracticeSeconds)} total
          </span>
          {dirty && <span className="font-semibold text-amber-300">Unsaved changes</span>}
        </div>
      </div>

      <SyncTargetBanner deviceId={deviceId} />

      {error && <div className="mb-4 rounded-lg border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">{error}</div>}
      {notice && <div className="mb-4 rounded-lg border border-green-600/50 bg-green-950/50 p-3 text-sm text-green-200">{notice}</div>}

      <section className="cc-card mb-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="practice-location" className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Practice location</label>
            <p className="mb-2 mt-1 text-sm text-white/50">Used for the kiosk clock, current conditions, and wet-bulb temperature.</p>
            <input
              id="practice-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void refreshWeather();
              }}
              placeholder="City, state or postal code"
              className="w-full rounded-lg px-4 py-3"
            />
          </div>
          <button
            type="button"
            onClick={() => void refreshWeather()}
            disabled={weatherLoading || sending}
            className="rounded-lg bg-cyan-600 px-5 py-3 font-bold text-white hover:bg-cyan-500 disabled:cursor-wait disabled:opacity-60"
          >
            {weatherLoading ? 'Loading conditions...' : board.weather ? 'Refresh conditions' : 'Set location & weather'}
          </button>
          {board.weather && (
            <div className="min-w-48 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm">
              <div className="font-bold text-white">{board.weather.description} · {Math.round(board.weather.temperatureF)}°F</div>
              <div className="mt-1 text-cyan-300">Wet bulb {Math.round(board.weather.wetBulbF)}°F</div>
            </div>
          )}
        </div>
      </section>

      <section className="cc-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Practice plan</h2>
            <p className="mt-1 text-sm text-white/50">Drag the grip to reorder. Times use MM:SS.</p>
          </div>
          <button
            type="button"
            onClick={addDrill}
            disabled={drills.length >= MAX_DRILLS}
            className="rounded-lg border border-green-500/40 bg-green-950/50 px-4 py-2.5 font-bold text-green-300 hover:bg-green-900/60 disabled:opacity-40"
          >
            + Add drill
          </button>
        </div>

        <div className="space-y-2 p-3 sm:p-5">
          {drills.length === 0 && (
            <button type="button" onClick={addDrill} className="w-full rounded-xl border border-dashed border-white/15 px-6 py-10 text-center text-white/50 hover:border-green-500/40 hover:text-green-300">
              No drills yet. Add the first period.
            </button>
          )}

          {drills.map((drill, index) => {
            const isActive = board.activeDrillId === drill.id;
            return (
              <div
                key={drill.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedIndex !== null) moveDrill(draggedIndex, index);
                  setDraggedIndex(null);
                }}
                className={`grid grid-cols-[auto_1fr_auto] gap-2 rounded-xl border p-2 sm:grid-cols-[auto_minmax(0,1fr)_8rem_auto_auto] ${
                  isActive ? 'border-green-500/60 bg-green-950/30' : 'border-white/10 bg-black/15'
                }`}
              >
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDraggedIndex(index)}
                  onDragEnd={() => setDraggedIndex(null)}
                  onKeyDown={(event) => {
                    if (event.altKey && event.key === 'ArrowUp') moveDrill(index, index - 1);
                    if (event.altKey && event.key === 'ArrowDown') moveDrill(index, index + 1);
                  }}
                  title="Drag to reorder. Alt+Up/Down also moves this row."
                  aria-label={`Reorder drill ${index + 1}`}
                  className="row-span-2 flex w-10 cursor-grab touch-none items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg font-black tracking-[-0.35em] text-white/40 hover:text-white active:cursor-grabbing sm:row-span-1"
                >
                  ⋮⋮
                </button>
                <input
                  value={drill.title}
                  maxLength={48}
                  onChange={(event) => updateDrill(drill.id, { title: event.target.value })}
                  placeholder={`Drill or period ${index + 1}`}
                  aria-label={`Drill ${index + 1} title`}
                  className="min-w-0 rounded-lg px-3 py-2.5 font-semibold"
                />
                <input
                  value={drill.durationText}
                  inputMode="numeric"
                  onChange={(event) => updateDrill(drill.id, { durationText: cleanDurationInput(event.target.value) })}
                  onBlur={() => updateDrill(drill.id, { durationText: formatDuration(parseDuration(drill.durationText)) })}
                  placeholder="MM:SS"
                  aria-label={`Drill ${index + 1} duration in minutes and seconds`}
                  className="w-24 rounded-lg px-3 py-2.5 text-center font-mono font-bold tabular-nums sm:w-auto"
                />
                <button
                  type="button"
                  onClick={() => startDrill(drill.id)}
                  disabled={sending}
                  className="col-start-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-white/70 hover:border-green-500/40 hover:text-green-300 sm:col-start-auto"
                >
                  {isActive ? 'Start over' : 'Run'}
                </button>
                <button
                  type="button"
                  onClick={() => removeDrill(drill.id)}
                  disabled={sending}
                  aria-label={`Delete drill ${index + 1}`}
                  className="rounded-lg px-3 py-2 text-xl font-bold text-white/30 hover:bg-red-950/50 hover:text-red-300"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 bg-black/20 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">On the clock</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="truncate text-xl font-bold text-white">{activeDrill?.title || 'No drill selected'}</span>
              <span className={`font-mono text-2xl font-black tabular-nums ${remainingSeconds === 0 && activeDrill ? 'text-red-400' : 'text-green-400'}`}>
                {activeDrill ? formatDuration(remainingSeconds) : '--:--'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => advanceDrill(-1)} disabled={sending || activeIndex <= 0} className="rounded-lg border border-white/10 px-4 py-2.5 font-bold text-white/70 hover:bg-white/5 disabled:opacity-30">Previous</button>
            {isActivelyRunning ? (
              <button type="button" onClick={stopDrill} disabled={sending} className="rounded-lg bg-amber-500 px-5 py-2.5 font-black text-black hover:bg-amber-400 disabled:opacity-50">Stop</button>
            ) : (
              <button
                type="button"
                onClick={() => activeDrill && remainingSeconds > 0 ? resumeDrill() : advanceDrill(1)}
                disabled={sending || drills.length === 0 || (Boolean(activeDrill) && remainingSeconds === 0 && activeIndex === drills.length - 1)}
                className="rounded-lg bg-green-500 px-5 py-2.5 font-black text-black hover:bg-green-400 disabled:opacity-50"
              >
                {activeDrill && remainingSeconds > 0
                  ? 'Start / Resume'
                  : activeDrill
                    ? 'Start next drill'
                    : 'Start first drill'}
              </button>
            )}
            <button type="button" onClick={restartDrill} disabled={sending || !activeDrill} className="rounded-lg border border-blue-500/35 bg-blue-950/30 px-4 py-2.5 font-bold text-blue-200 hover:bg-blue-900/40 disabled:opacity-30">Restart</button>
            <button type="button" onClick={() => advanceDrill(1)} disabled={sending || drills.length === 0} className="rounded-lg border border-white/10 px-4 py-2.5 font-bold text-white/70 hover:bg-white/5 disabled:opacity-30">Complete & next</button>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 mt-5 flex justify-end">
        <button
          type="button"
          onClick={saveBoard}
          disabled={sending}
          className="rounded-xl bg-green-500 px-6 py-3.5 text-base font-black text-black shadow-lg shadow-green-950/50 hover:bg-green-400 disabled:cursor-wait disabled:opacity-60"
        >
          {sending ? 'Updating display...' : dirty ? 'Update display' : 'Send board to display'}
        </button>
      </div>
    </div>
  );
}

function emptyBoard(): PracticeBoardState {
  return { drills: [], timerStatus: 'idle', remainingSeconds: 0 };
}

function normalizeBoard(value: PracticeBoardState | undefined): PracticeBoardState {
  if (!value || !Array.isArray(value.drills)) return emptyBoard();
  const drills = value.drills.slice(0, MAX_DRILLS).map((drill, index) => ({
    id: typeof drill.id === 'string' && drill.id ? drill.id : `drill-${index + 1}`,
    title: typeof drill.title === 'string' ? drill.title.slice(0, 48) : '',
    durationSeconds: clampDuration(drill.durationSeconds),
  }));
  const timerStatus = ['idle', 'running', 'paused', 'complete'].includes(value.timerStatus)
    ? value.timerStatus
    : 'idle';
  return {
    drills,
    activeDrillId: drills.some((drill) => drill.id === value.activeDrillId) ? value.activeDrillId : undefined,
    timerStatus,
    remainingSeconds: clampDuration(value.remainingSeconds),
    ...(typeof value.startedAt === 'number' ? { startedAt: value.startedAt } : {}),
    ...(value.weather ? { weather: value.weather } : {}),
  };
}

function serializeDrills(drills: EditableDrill[]): PracticeBoardDrill[] {
  return drills.slice(0, MAX_DRILLS).map((drill) => ({
    id: drill.id,
    title: drill.title.trim().slice(0, 48),
    durationSeconds: parseDuration(drill.durationText),
  }));
}

function toEditableDrill(drill: PracticeBoardDrill): EditableDrill {
  return { id: drill.id, title: drill.title, durationText: formatDuration(drill.durationSeconds) };
}

function snapshotBoard(board: PracticeBoardState, now = Date.now()): PracticeBoardState {
  const remainingSeconds = projectRemainingSeconds(board, now);
  return {
    ...board,
    remainingSeconds,
    ...(board.timerStatus === 'running' && remainingSeconds > 0 ? { startedAt: now } : { startedAt: undefined }),
  };
}

function projectRemainingSeconds(board: PracticeBoardState, now = Date.now()): number {
  if (board.timerStatus !== 'running' || typeof board.startedAt !== 'number') {
    return clampDuration(board.remainingSeconds);
  }
  return Math.max(0, Math.ceil(board.remainingSeconds - (now - board.startedAt) / 1000));
}

function cleanDurationInput(value: string): string {
  return value.replace(/[^0-9:]/g, '').slice(0, 5);
}

function parseDuration(value: string): number {
  const parts = value.split(':');
  if (parts.length === 1) return clampDuration(Number(parts[0]) * 60);
  const minutes = Number(parts[0]) || 0;
  const seconds = Math.min(59, Number(parts[1]) || 0);
  return clampDuration(minutes * 60 + seconds);
}

function clampDuration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(99 * 60 + 59, Math.round(value))) : 0;
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = clampDuration(totalSeconds);
  return `${Math.floor(safeSeconds / 60)}:${(safeSeconds % 60).toString().padStart(2, '0')}`;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `drill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
