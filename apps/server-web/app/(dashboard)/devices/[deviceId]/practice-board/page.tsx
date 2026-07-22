'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type {
  DeviceMode,
  PracticeBoardAssignment,
  PracticeBoardDrill,
  PracticeBoardPosition,
  PracticeBoardState,
  PracticeBoardUnit,
  PracticeBoardWeather,
} from '@shotclock/shared/types';
import { SyncTargetBanner, useDeviceCommandDispatcher } from '../../../SelectedDevicesProvider';

type EditableDrill = {
  id: string;
  unit: PracticeBoardUnit;
  title: string;
  durationText: string;
  assignments: PracticeBoardAssignment[];
};

type DeviceResponse = {
  device: {
    name: string;
    displayState?: { deviceMode?: DeviceMode };
  };
};

const MAX_DRILLS_PER_UNIT = 12;
const MAX_ASSIGNMENTS = 12;
const PREVIEW_PAGE_SIZE = 4;
const PREVIEW_PAGE_DURATION_MS = 5000;
const OFFENSE_POSITION_OPTIONS: PracticeBoardPosition[] = ['ALL', 'QB', 'WR', 'RB', 'TE', 'OL', 'Other'];
const DEFENSE_POSITION_OPTIONS: PracticeBoardPosition[] = ['ALL', 'DL', 'LB', 'Safety', 'Nickel', 'Corner', 'Other'];
const ALL_POSITION_OPTIONS = [...new Set([...OFFENSE_POSITION_OPTIONS, ...DEFENSE_POSITION_OPTIONS])];

export default function PracticeBoardPage({ params }: { params: { deviceId: string } }) {
  const { deviceId } = params;
  const { sendCommand } = useDeviceCommandDispatcher(deviceId);
  const [deviceName, setDeviceName] = useState('Practice Board');
  const [drills, setDrills] = useState<EditableDrill[]>([]);
  const [activeUnit, setActiveUnit] = useState<PracticeBoardUnit>('offense');
  const [board, setBoard] = useState<PracticeBoardState>(emptyBoard());
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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
        if (nextBoard.drills.length > 0 && nextBoard.drills.every((drill) => drill.unit === 'defense')) {
          setActiveUnit('defense');
        }
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
  const unitDrills = drills.filter((drill) => drill.unit === activeUnit);
  const activeUnitDrills = activeDrill
    ? drills.filter((drill) => drill.unit === activeDrill.unit)
    : unitDrills;
  const activeUnitIndex = activeDrill
    ? activeUnitDrills.findIndex((drill) => drill.id === activeDrill.id)
    : -1;
  const controlDrills = activeDrill ? activeUnitDrills : unitDrills;
  const isActivelyRunning = board.timerStatus === 'running' && remainingSeconds > 0;
  const totalPracticeSeconds = unitDrills.reduce(
    (total, drill) => total + parseDuration(drill.durationText),
    0
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
    if (unitDrills.length >= MAX_DRILLS_PER_UNIT) return;
    setDrills((current) => [...current, {
      id: createId(),
      unit: activeUnit,
      title: '',
      durationText: '05:00',
      assignments: [createAssignment('ALL')],
    }]);
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

  const addAssignment = (drillId: string) => {
    setDrills((current) => current.map((drill) => drill.id === drillId && drill.assignments.length < MAX_ASSIGNMENTS
      ? {
          ...drill,
          assignments: [...drill.assignments, createAssignment(drill.unit === 'defense' ? 'DL' : 'QB')],
        }
      : drill));
    setDirty(true);
  };

  const updateAssignment = (
    drillId: string,
    assignmentId: string,
    updates: Partial<PracticeBoardAssignment>
  ) => {
    setDrills((current) => current.map((drill) => drill.id === drillId
      ? {
          ...drill,
          assignments: drill.assignments.map((assignment) => assignment.id === assignmentId
            ? { ...assignment, ...updates }
            : assignment),
        }
      : drill));
    setDirty(true);
  };

  const removeAssignment = (drillId: string, assignmentId: string) => {
    setDrills((current) => current.map((drill) => drill.id === drillId
      ? { ...drill, assignments: drill.assignments.filter((assignment) => assignment.id !== assignmentId) }
      : drill));
    setDirty(true);
  };

  const moveDrill = (fromIndex: number, toIndex: number, unit: PracticeBoardUnit) => {
    const unitCount = drills.filter((drill) => drill.unit === unit).length;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= unitCount) return;
    setDrills((current) => {
      const unitIndexes = current.reduce<number[]>((indexes, drill, index) => {
        if (drill.unit === unit) indexes.push(index);
        return indexes;
      }, []);
      const reordered = unitIndexes.map((index) => current[index]);
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const next = [...current];
      unitIndexes.forEach((index, unitIndex) => {
        next[index] = reordered[unitIndex];
      });
      return next;
    });
    setDirty(true);
  };

  const startDrill = (id: string, showOverview = true) => {
    const drill = serializeDrills(drills).find((item) => item.id === id);
    if (!drill || drill.durationSeconds <= 0) {
      setError('Give the period a duration greater than 0:00 before starting it.');
      return;
    }
    const previewDurationMs = getPreviewDurationMs(serializeDrills(drills));
    const transitionEndsAt = Date.now() + (showOverview ? previewDurationMs : 0);
    void dispatchBoard(boardWithCurrentDrills({
      activeDrillId: id,
      timerStatus: 'running',
      remainingSeconds: drill.durationSeconds,
      startedAt: transitionEndsAt,
      overviewUntil: showOverview ? transitionEndsAt : undefined,
    }), `Started ${drill.title || 'period'}.`);
  };

  const resumeDrill = () => {
    if (!activeDrill || remainingSeconds <= 0) return;
    void dispatchBoard(boardWithCurrentDrills({
      timerStatus: 'running',
      remainingSeconds,
      startedAt: Date.now(),
      overviewUntil: undefined,
    }), 'Period resumed.');
  };

  const stopDrill = () => {
    if (!activeDrill) return;
    void dispatchBoard(boardWithCurrentDrills({
      timerStatus: 'paused',
      remainingSeconds,
      startedAt: undefined,
      overviewUntil: undefined,
    }), 'Period stopped.');
  };

  const restartDrill = () => {
    if (!activeDrill) return;
    startDrill(activeDrill.id, false);
  };

  const previewSchedule = () => {
    const previewDurationMs = getPreviewDurationMs(serializeDrills(drills));
    void dispatchBoard(boardWithCurrentDrills({
      overviewUntil: Date.now() + previewDurationMs,
    }), `Showing ${formatPreviewDuration(previewDurationMs)} of schedule previews.`);
  };

  const advanceDrill = (direction: 1 | -1) => {
    const sequence = activeDrill ? activeUnitDrills : unitDrills;
    if (sequence.length === 0) return;
    const targetIndex = activeUnitIndex < 0
      ? (direction === 1 ? 0 : sequence.length - 1)
      : activeUnitIndex + direction;

    if (targetIndex < 0) return;
    if (targetIndex >= sequence.length) {
      const previewDurationMs = getPreviewDurationMs(serializeDrills(drills));
      void dispatchBoard(boardWithCurrentDrills({
        timerStatus: 'complete',
        remainingSeconds: 0,
        startedAt: undefined,
        overviewUntil: Date.now() + previewDurationMs,
      }), 'Practice plan complete.');
      return;
    }
    startDrill(sequence[targetIndex].id);
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

  const uploadSchoolLogo = async (file: File | null) => {
    if (!file) return;

    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('slot', 'practice-school-logo');

      const response = await fetch(`/api/devices/${deviceId}/media`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Upload failed with HTTP ${response.status}`);

      const schoolLogoUrl = getPublicMediaUrl(data.mediaAsset.url);
      await dispatchBoard(boardWithCurrentDrills({ schoolLogoUrl }), 'School logo updated.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'School logo upload failed.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeSchoolLogo = () => {
    void dispatchBoard(boardWithCurrentDrills({ schoolLogoUrl: undefined }), 'School logo removed.');
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
            {unitDrills.length} {activeUnit} period{unitDrills.length === 1 ? '' : 's'} · {formatDuration(totalPracticeSeconds)} total
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

        <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/25 p-2">
              {board.schoolLogoUrl ? (
                <img src={board.schoolLogoUrl} alt="School logo preview" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-center text-xs font-bold uppercase tracking-[0.12em] text-white/25">No logo</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">School logo</div>
              <p className="mt-1 text-sm text-white/50">Displayed beside Today&apos;s Practice on the kiosk schedule preview.</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <label className={`cursor-pointer rounded-lg border border-cyan-500/35 bg-cyan-950/30 px-4 py-2.5 font-bold text-cyan-200 hover:bg-cyan-900/40 ${uploadingLogo || sending ? 'pointer-events-none opacity-50' : ''}`}>
              {uploadingLogo ? 'Uploading...' : board.schoolLogoUrl ? 'Replace logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                disabled={uploadingLogo || sending}
                onChange={(event) => {
                  void uploadSchoolLogo(event.currentTarget.files?.[0] || null);
                  event.currentTarget.value = '';
                }}
                className="sr-only"
              />
            </label>
            {board.schoolLogoUrl && (
              <button
                type="button"
                onClick={removeSchoolLogo}
                disabled={uploadingLogo || sending}
                className="rounded-lg border border-red-500/25 bg-red-950/20 px-4 py-2.5 font-bold text-red-200 hover:bg-red-900/30 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="cc-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Practice plan</h2>
            <p className="mt-1 text-sm text-white/50">Build separate offensive and defensive period schedules, then drag the grip to reorder each unit.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-black/25 p-1" role="tablist" aria-label="Practice unit">
              {(['offense', 'defense'] as PracticeBoardUnit[]).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  role="tab"
                  aria-selected={activeUnit === unit}
                  onClick={() => {
                    setActiveUnit(unit);
                    setDraggedIndex(null);
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-black uppercase tracking-[0.12em] transition ${
                    activeUnit === unit
                      ? unit === 'offense'
                        ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/40'
                        : 'bg-violet-400 text-slate-950 shadow-lg shadow-violet-950/40'
                      : 'text-white/45 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={previewSchedule}
              disabled={sending || drills.length === 0}
              className="rounded-lg border border-cyan-500/35 bg-cyan-950/30 px-4 py-2.5 font-bold text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-40"
            >
              Preview schedule
            </button>
            <button
              type="button"
              onClick={addDrill}
              disabled={unitDrills.length >= MAX_DRILLS_PER_UNIT}
              className="rounded-lg border border-green-500/40 bg-green-950/50 px-4 py-2.5 font-bold text-green-300 hover:bg-green-900/60 disabled:opacity-40"
            >
              + Add {activeUnit} period
            </button>
          </div>
        </div>

        <div className="space-y-2 p-3 sm:p-5">
          {unitDrills.length === 0 && (
            <button type="button" onClick={addDrill} className="w-full rounded-xl border border-dashed border-white/15 px-6 py-10 text-center text-white/50 hover:border-green-500/40 hover:text-green-300">
              No {activeUnit} periods yet. Add the first one.
            </button>
          )}

          {unitDrills.map((drill, index) => {
            const isActive = board.activeDrillId === drill.id;
            return (
              <article
                key={drill.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedIndex !== null) moveDrill(draggedIndex, index, activeUnit);
                  setDraggedIndex(null);
                }}
                className={`overflow-hidden rounded-2xl border ${
                  isActive ? 'border-cyan-400/55 bg-cyan-950/20' : 'border-white/10 bg-black/15'
                }`}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 p-3 sm:grid-cols-[auto_minmax(0,1fr)_8rem_auto_auto]">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => setDraggedIndex(index)}
                    onDragEnd={() => setDraggedIndex(null)}
                    onKeyDown={(event) => {
                      if (event.altKey && event.key === 'ArrowUp') moveDrill(index, index - 1, activeUnit);
                      if (event.altKey && event.key === 'ArrowDown') moveDrill(index, index + 1, activeUnit);
                    }}
                    title="Drag to reorder. Alt+Up/Down also moves this period."
                    aria-label={`Reorder period ${index + 1}`}
                    className="row-span-2 flex w-10 cursor-grab touch-none items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-black tracking-[-0.35em] text-white/40 hover:text-white active:cursor-grabbing sm:row-span-1"
                  >
                    ⋮⋮
                  </button>
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70">Period {index + 1}</div>
                    <input
                      value={drill.title}
                      maxLength={48}
                      onChange={(event) => updateDrill(drill.id, { title: event.target.value })}
                      placeholder={`Period ${index + 1} title`}
                      aria-label={`Period ${index + 1} title`}
                      className="min-w-0 w-full rounded-lg px-3 py-2.5 font-semibold"
                    />
                  </div>
                  <input
                    value={drill.durationText}
                    inputMode="numeric"
                    onChange={(event) => updateDrill(drill.id, { durationText: cleanDurationInput(event.target.value) })}
                    onBlur={() => updateDrill(drill.id, { durationText: formatDuration(parseDuration(drill.durationText)) })}
                    placeholder="MM:SS"
                    aria-label={`Period ${index + 1} duration in minutes and seconds`}
                    className="w-24 self-end rounded-lg px-3 py-2.5 text-center font-mono font-bold tabular-nums sm:w-auto"
                  />
                  <button
                    type="button"
                    onClick={() => startDrill(drill.id)}
                    disabled={sending}
                    className="col-start-2 self-end rounded-lg border border-white/10 px-3 py-2.5 text-sm font-bold text-white/70 hover:border-cyan-500/40 hover:text-cyan-200 sm:col-start-auto"
                  >
                    {isActive ? 'Start over' : 'Run period'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDrill(drill.id)}
                    disabled={sending}
                    aria-label={`Delete period ${index + 1}`}
                    className="self-end rounded-lg px-3 py-2 text-xl font-bold text-white/30 hover:bg-red-950/50 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>

                <div className="border-t border-white/[0.08] bg-black/20 px-3 py-3 sm:pl-[4.25rem]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-white/65">Position assignments</div>
                      <div className="mt-0.5 text-xs text-white/35">Select a group and enter what they are doing in this period.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addAssignment(drill.id)}
                      disabled={drill.assignments.length >= MAX_ASSIGNMENTS}
                      className="shrink-0 rounded-lg border border-cyan-500/25 bg-cyan-950/25 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-900/35 disabled:opacity-40"
                    >
                      + Position / drill
                    </button>
                  </div>

                  <div className="space-y-2">
                    {drill.assignments.length === 0 && (
                      <button
                        type="button"
                        onClick={() => addAssignment(drill.id)}
                        className="w-full rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-white/35 hover:border-cyan-500/30 hover:text-cyan-200"
                      >
                        Add the first position assignment
                      </button>
                    )}
                    {drill.assignments.map((assignment, assignmentIndex) => (
                      <div key={assignment.id} className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-2 md:flex-row">
                        <select
                          value={assignment.position}
                          onChange={(event) => updateAssignment(drill.id, assignment.id, {
                            position: event.target.value as PracticeBoardPosition,
                            ...(event.target.value !== 'Other' ? { customPosition: undefined } : {}),
                          })}
                          aria-label={`Period ${index + 1} assignment ${assignmentIndex + 1} position`}
                          className="rounded-lg px-3 py-2.5 font-bold md:w-32"
                        >
                          {(drill.unit === 'defense' ? DEFENSE_POSITION_OPTIONS : OFFENSE_POSITION_OPTIONS)
                            .map((position) => <option key={position} value={position}>{position}</option>)}
                        </select>
                        {assignment.position === 'Other' && (
                          <input
                            value={assignment.customPosition || ''}
                            maxLength={16}
                            onChange={(event) => updateAssignment(drill.id, assignment.id, { customPosition: event.target.value })}
                            placeholder="Position name"
                            aria-label={`Period ${index + 1} assignment ${assignmentIndex + 1} custom position`}
                            className="rounded-lg px-3 py-2.5 font-semibold md:w-44"
                          />
                        )}
                        <input
                          value={assignment.drillName}
                          maxLength={64}
                          onChange={(event) => updateAssignment(drill.id, assignment.id, { drillName: event.target.value })}
                          placeholder="Drill or responsibility"
                          aria-label={`Period ${index + 1} assignment ${assignmentIndex + 1} drill name`}
                          className="min-w-0 flex-1 rounded-lg px-3 py-2.5"
                        />
                        <button
                          type="button"
                          onClick={() => removeAssignment(drill.id, assignment.id)}
                          aria-label={`Delete period ${index + 1} assignment ${assignmentIndex + 1}`}
                          className="rounded-lg px-3 py-2 text-lg font-bold text-white/25 hover:bg-red-950/40 hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 bg-black/20 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Current period</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="truncate text-xl font-bold text-white">{activeDrill?.title || 'No period selected'}</span>
              <span className={`font-mono text-2xl font-black tabular-nums ${remainingSeconds === 0 && activeDrill ? 'text-red-400' : 'text-green-400'}`}>
                {activeDrill ? formatDuration(remainingSeconds) : '--:--'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => advanceDrill(-1)} disabled={sending || activeUnitIndex <= 0} className="rounded-lg border border-white/10 px-4 py-2.5 font-bold text-white/70 hover:bg-white/5 disabled:opacity-30">Previous</button>
            {isActivelyRunning ? (
              <button type="button" onClick={stopDrill} disabled={sending} className="rounded-lg bg-amber-500 px-5 py-2.5 font-black text-black hover:bg-amber-400 disabled:opacity-50">Stop</button>
            ) : (
              <button
                type="button"
                onClick={() => activeDrill && remainingSeconds > 0 ? resumeDrill() : advanceDrill(1)}
                disabled={sending || controlDrills.length === 0 || (Boolean(activeDrill) && remainingSeconds === 0 && activeUnitIndex === activeUnitDrills.length - 1)}
                className="rounded-lg bg-green-500 px-5 py-2.5 font-black text-black hover:bg-green-400 disabled:opacity-50"
              >
                {activeDrill && remainingSeconds > 0
                  ? 'Start / Resume'
                  : activeDrill
                    ? 'Start next period'
                    : 'Start first period'}
              </button>
            )}
            <button type="button" onClick={restartDrill} disabled={sending || !activeDrill} className="rounded-lg border border-blue-500/35 bg-blue-950/30 px-4 py-2.5 font-bold text-blue-200 hover:bg-blue-900/40 disabled:opacity-30">Restart period</button>
            <button type="button" onClick={() => advanceDrill(1)} disabled={sending || (activeDrill ? activeUnitDrills.length === 0 : unitDrills.length === 0)} className="rounded-lg border border-white/10 px-4 py-2.5 font-bold text-white/70 hover:bg-white/5 disabled:opacity-30">Complete & next</button>
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
  const normalizedDrills = value.drills.map((drill, index) => ({
    id: typeof drill.id === 'string' && drill.id ? drill.id : `drill-${index + 1}`,
    unit: drill.unit === 'defense' ? 'defense' as const : 'offense' as const,
    title: typeof drill.title === 'string' ? drill.title.slice(0, 48) : '',
    durationSeconds: clampDuration(drill.durationSeconds),
    assignments: normalizeAssignments(drill.assignments),
  }));
  const drills = (['offense', 'defense'] as PracticeBoardUnit[]).flatMap((unit) =>
    normalizedDrills.filter((drill) => drill.unit === unit).slice(0, MAX_DRILLS_PER_UNIT)
  );
  const timerStatus = ['idle', 'running', 'paused', 'complete'].includes(value.timerStatus)
    ? value.timerStatus
    : 'idle';
  return {
    drills,
    activeDrillId: drills.some((drill) => drill.id === value.activeDrillId) ? value.activeDrillId : undefined,
    timerStatus,
    remainingSeconds: clampDuration(value.remainingSeconds),
    ...(typeof value.startedAt === 'number' ? { startedAt: value.startedAt } : {}),
    ...(typeof value.overviewUntil === 'number' ? { overviewUntil: value.overviewUntil } : {}),
    ...(typeof value.schoolLogoUrl === 'string' && value.schoolLogoUrl.trim()
      ? { schoolLogoUrl: value.schoolLogoUrl.trim().slice(0, 512) }
      : {}),
    ...(value.weather ? { weather: value.weather } : {}),
  };
}

function serializeDrills(drills: EditableDrill[]): PracticeBoardDrill[] {
  return (['offense', 'defense'] as PracticeBoardUnit[]).flatMap((unit) =>
    drills.filter((drill) => drill.unit === unit).slice(0, MAX_DRILLS_PER_UNIT)
  ).map((drill) => ({
    id: drill.id,
    unit: drill.unit,
    title: drill.title.trim().slice(0, 48),
    durationSeconds: parseDuration(drill.durationText),
    assignments: drill.assignments.slice(0, MAX_ASSIGNMENTS).map((assignment) => ({
      id: assignment.id,
      position: assignment.position,
      ...(assignment.position === 'Other' && assignment.customPosition?.trim()
        ? { customPosition: assignment.customPosition.trim().slice(0, 16) }
        : {}),
      drillName: assignment.drillName.trim().slice(0, 64),
    })),
  }));
}

function toEditableDrill(drill: PracticeBoardDrill): EditableDrill {
  return {
    id: drill.id,
    unit: drill.unit === 'defense' ? 'defense' : 'offense',
    title: drill.title,
    durationText: formatDuration(drill.durationSeconds),
    assignments: normalizeAssignments(drill.assignments),
  };
}

function snapshotBoard(board: PracticeBoardState, now = Date.now()): PracticeBoardState {
  const remainingSeconds = projectRemainingSeconds(board, now);
  return {
    ...board,
    remainingSeconds,
    ...(board.timerStatus === 'running' && remainingSeconds > 0
      ? { startedAt: typeof board.startedAt === 'number' && board.startedAt > now ? board.startedAt : now }
      : { startedAt: undefined }),
  };
}

function projectRemainingSeconds(board: PracticeBoardState, now = Date.now()): number {
  if (board.timerStatus !== 'running' || typeof board.startedAt !== 'number') {
    return clampDuration(board.remainingSeconds);
  }
  const elapsedSeconds = Math.max(0, (now - board.startedAt) / 1000);
  return Math.max(0, Math.ceil(board.remainingSeconds - elapsedSeconds));
}

function normalizeAssignments(value: unknown): PracticeBoardAssignment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ASSIGNMENTS).map((assignment, index) => {
    const raw = assignment as Partial<PracticeBoardAssignment>;
    const position = ALL_POSITION_OPTIONS.includes(raw.position as PracticeBoardPosition)
      ? raw.position as PracticeBoardPosition
      : 'ALL';
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : `assignment-${index + 1}`,
      position,
      ...(position === 'Other' && typeof raw.customPosition === 'string'
        ? { customPosition: raw.customPosition.slice(0, 16) }
        : {}),
      drillName: typeof raw.drillName === 'string' ? raw.drillName.slice(0, 64) : '',
    };
  });
}

function createAssignment(position: PracticeBoardPosition = 'QB'): PracticeBoardAssignment {
  return { id: createId(), position, drillName: '' };
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

function getPreviewPageCount(drills: Pick<PracticeBoardDrill, 'unit'>[]): number {
  const offenseCount = drills.filter((drill) => drill.unit !== 'defense').length;
  const defenseCount = drills.filter((drill) => drill.unit === 'defense').length;
  return Math.max(1, Math.ceil(offenseCount / PREVIEW_PAGE_SIZE), Math.ceil(defenseCount / PREVIEW_PAGE_SIZE));
}

function getPreviewDurationMs(drills: Pick<PracticeBoardDrill, 'unit'>[]): number {
  return getPreviewPageCount(drills) * PREVIEW_PAGE_DURATION_MS;
}

function formatPreviewDuration(durationMs: number): string {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function getPublicMediaUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `drill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
