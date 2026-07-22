import { useEffect, useMemo, useState } from 'react';
import type {
  PracticeBoardAssignment,
  PracticeBoardDrill,
  PracticeBoardState,
} from '@shotclock/shared/types';

const SCHEDULE_PREVIEW_DURATION_MS = 5000;
const SCHEDULE_PREVIEW_INTERVAL_MS = 20000;
const SCHEDULE_PREVIEW_PAGE_SIZE = 4;

type SchedulePreviewState = {
  until: number;
  pageIndex: number;
};

export default function PracticeBoardMode({ board }: { board?: PracticeBoardState }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const previewActive = typeof board?.overviewUntil === 'number' && board.overviewUntil > Date.now();
    const interval = setInterval(
      () => setNow(Date.now()),
      board?.timerStatus === 'running' || previewActive ? 200 : 1000
    );
    return () => clearInterval(interval);
  }, [board?.overviewUntil, board?.timerStatus]);

  const periods = board?.drills?.slice(0, 24) || [];
  const activeIndex = periods.findIndex((period) => period.id === board?.activeDrillId);
  const activePeriod = activeIndex >= 0 ? periods[activeIndex] : undefined;
  const activeUnitPeriods = activePeriod
    ? periods.filter((period) => getPeriodUnit(period) === getPeriodUnit(activePeriod))
    : [];
  const activeUnitIndex = activePeriod
    ? activeUnitPeriods.findIndex((period) => period.id === activePeriod.id)
    : -1;
  const previewPageCount = getPreviewPageCount(periods);
  const previewDurationMs = previewPageCount * SCHEDULE_PREVIEW_DURATION_MS;
  const remainingSeconds = projectRemainingSeconds(board, now);
  const timezone = board?.weather?.timezone;
  const clock = useMemo(() => formatLocationTime(now, timezone), [now, timezone]);
  const manualPreview = getManualPreviewState(board?.overviewUntil, now, previewDurationMs, previewPageCount);
  const automaticPreview = activePeriod
    ? getAutomaticPreviewState(board, activePeriod, now, previewDurationMs, previewPageCount)
    : undefined;
  const previewState = !manualPreview
    ? automaticPreview
    : !automaticPreview || manualPreview.until >= automaticPreview.until
      ? manualPreview
      : automaticPreview;
  const previewPageIndex = previewState?.pageIndex
    ?? (!activePeriod && previewPageCount > 1
      ? Math.floor(now / SCHEDULE_PREVIEW_DURATION_MS) % previewPageCount
      : 0);
  const showOverview = !activePeriod || Boolean(previewState);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#050816] font-sans text-white"
      style={{ containerType: 'size' }}
    >
      <div className="pointer-events-none absolute -left-[18cqw] -top-[22cqh] h-[60cqw] w-[60cqw] rounded-full bg-cyan-500/[0.10] blur-[9cqw]" />
      <div className="pointer-events-none absolute -bottom-[34cqh] right-[-12cqw] h-[70cqw] w-[70cqw] rounded-full bg-violet-500/[0.13] blur-[10cqw]" />
      <div className="relative grid h-full w-full grid-rows-[15%_85%]">
        <StatusBar
          board={board}
          clock={clock}
          remainingSeconds={remainingSeconds}
          showPeriodTimer={Boolean(activePeriod)}
        />
        {showOverview ? (
          <ScheduleOverview
            periods={periods}
            activePeriodId={activePeriod?.id}
            remainingSeconds={remainingSeconds}
            schoolLogoUrl={board?.schoolLogoUrl}
            pageIndex={previewPageIndex}
          />
        ) : (
          <ActivePeriod
            period={activePeriod}
            periodNumber={activeUnitIndex + 1}
            remainingSeconds={remainingSeconds}
            timerStatus={board?.timerStatus}
          />
        )}
      </div>
    </div>
  );
}

function StatusBar({
  board,
  clock,
  remainingSeconds,
  showPeriodTimer,
}: {
  board?: PracticeBoardState;
  clock: { dayAndDate: string };
  remainingSeconds: number;
  showPeriodTimer: boolean;
}) {
  return (
    <header className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-[1.6cqw] border-b border-white/[0.08] bg-[#070b1a]/80 px-[2.5cqw] backdrop-blur-xl">
      <div className="min-w-0">
        <div className="truncate text-[min(4.3cqh,3.1cqw)] font-black tracking-[-0.035em] text-white/90">
          {clock.dayAndDate}
        </div>
      </div>

      <div
        className={`min-w-[19cqw] text-center text-[min(10.2cqh,7cqw)] font-black leading-none tracking-[-0.06em] tabular-nums ${
          showPeriodTimer ? 'text-white' : 'invisible'
        }`}
        aria-hidden={!showPeriodTimer}
      >
        {formatDuration(remainingSeconds)}
      </div>

      <div className="flex min-w-0 items-stretch justify-end gap-[1cqw]">
        <div className="min-w-0 flex-1 rounded-[1.3cqw] border border-white/[0.08] bg-white/[0.045] px-[1.5cqw] py-[1.1cqh] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="text-[min(1.9cqh,1.35cqw)] font-bold uppercase tracking-[0.16em] text-white/35">Conditions</div>
          <div className="mt-[0.8cqh] truncate text-[min(3.1cqh,2.2cqw)] font-extrabold text-white/90">
            {board?.weather ? `${board.weather.description} · ${Math.round(board.weather.temperatureF)}°` : 'Weather not set'}
          </div>
        </div>

        <div className="min-w-[11cqw] rounded-[1.3cqw] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.12] to-violet-500/[0.10] px-[1.5cqw] py-[1.1cqh] text-right leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
          <div className="text-[min(1.8cqh,1.3cqw)] font-bold uppercase tracking-[0.1em] text-cyan-200/60">Wet bulb</div>
          <div className="mt-[0.65cqh] text-[min(4cqh,2.9cqw)] font-black tabular-nums text-white">
            {board?.weather ? `${Math.round(board.weather.wetBulbF)}°` : '--'}
          </div>
        </div>
      </div>
    </header>
  );
}

function ScheduleOverview({
  periods,
  activePeriodId,
  remainingSeconds,
  schoolLogoUrl,
  pageIndex,
}: {
  periods: PracticeBoardDrill[];
  activePeriodId?: string;
  remainingSeconds: number;
  schoolLogoUrl?: string;
  pageIndex: number;
}) {
  if (periods.length === 0) {
    return (
      <div className="flex min-h-0 flex-col items-center justify-center px-[8cqw] text-center">
        <img
          src="/images/legacy1-performance-logo.png"
          alt="Legacy 1 Performance"
          className="h-auto max-h-[20cqh] w-auto max-w-[48cqw] object-contain drop-shadow-[0_0_3cqw_rgba(239,68,68,0.16)]"
        />
        <div className="mt-[3cqh] text-[min(10cqh,7cqw)] font-black tracking-[-0.06em] text-white">Build today&apos;s plan</div>
        <div className="mt-[2cqh] text-[min(4cqh,3cqw)] font-medium text-white/35">Add periods and position assignments from the WebUI.</div>
      </div>
    );
  }

  const offensePeriods = periods.filter((period) => getPeriodUnit(period) === 'offense');
  const defensePeriods = periods.filter((period) => getPeriodUnit(period) === 'defense');
  const offensePageCount = Math.ceil(offensePeriods.length / SCHEDULE_PREVIEW_PAGE_SIZE);
  const showingOffense = pageIndex < offensePageCount;
  const visibleUnitPeriods = showingOffense ? offensePeriods : defensePeriods;
  const unitPageIndex = showingOffense ? pageIndex : pageIndex - offensePageCount;
  const showUnitLabel = offensePeriods.length > 0 && defensePeriods.length > 0;
  const visibleUnitLabel = showingOffense ? 'Offense' : 'Defense';

  return (
    <section className="grid min-h-0 grid-rows-[auto_1fr] gap-[1.5cqh] p-[2cqh_2cqw]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[2cqw] px-[0.5cqw]">
        <div>
          <div className="text-[min(2.5cqh,1.8cqw)] font-black uppercase tracking-[0.24em] text-cyan-300/65">Schedule preview</div>
          <div className="mt-[0.5cqh] text-[min(5cqh,3.6cqw)] font-black tracking-[-0.04em] text-white">Today&apos;s practice</div>
        </div>
        <div className="flex h-[9cqh] min-w-0 items-center justify-center">
          {schoolLogoUrl && (
            <img
              src={schoolLogoUrl}
              alt=""
              className="max-h-full max-w-[28cqw] object-contain drop-shadow-[0_0_2cqw_rgba(255,255,255,0.10)]"
            />
          )}
        </div>
        {showUnitLabel && (
          <div className={`text-[min(3.2cqh,2.4cqw)] font-black uppercase tracking-[0.22em] ${
            showingOffense ? 'text-cyan-200/80' : 'text-violet-200/85'
          }`}>
            {visibleUnitLabel}
          </div>
        )}
      </div>

      <ScheduleCardGrid
        periods={visibleUnitPeriods}
        activePeriodId={activePeriodId}
        remainingSeconds={remainingSeconds}
        pageIndex={unitPageIndex}
      />
    </section>
  );
}

function ScheduleCardGrid({
  periods,
  activePeriodId,
  remainingSeconds,
  pageIndex,
}: {
  periods: PracticeBoardDrill[];
  activePeriodId?: string;
  remainingSeconds: number;
  pageIndex: number;
}) {
  const pageStart = pageIndex * SCHEDULE_PREVIEW_PAGE_SIZE;
  const visiblePeriods = periods.slice(pageStart, pageStart + SCHEDULE_PREVIEW_PAGE_SIZE);
  const activeIndex = periods.findIndex((period) => period.id === activePeriodId);

  if (visiblePeriods.length === 0) {
    return (
      <div className="flex min-h-0 items-center justify-center rounded-[1.8cqw] border border-dashed border-white/[0.08] bg-white/[0.02] text-[min(3.2cqh,2.2cqw)] font-black uppercase tracking-[0.15em] text-white/20">
        Schedule complete
      </div>
    );
  }

  return (
    <div
      className="grid min-h-0 gap-[0.8cqh] overflow-hidden"
      style={{ gridTemplateRows: `repeat(${visiblePeriods.length}, minmax(0, 1fr))` }}
    >
      {visiblePeriods.map((period, visibleIndex) => {
        const index = pageStart + visibleIndex;
        const isActive = period.id === activePeriodId;
        const isComplete = activeIndex >= 0 && index < activeIndex;
        const assignmentCount = period.assignments?.length || 0;
        return (
          <div
            key={period.id}
            style={{ containerType: 'size' }}
            className={`relative grid min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[1.8cqw] overflow-hidden rounded-[1.5cqw] border px-[1.6cqw] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ${
              isActive
                ? 'border-cyan-300/35 bg-gradient-to-r from-cyan-400/[0.14] to-violet-500/[0.09]'
                : isComplete
                  ? 'border-white/[0.05] bg-white/[0.025] text-white/30'
                  : 'border-white/[0.08] bg-white/[0.045]'
            }`}
          >
            <div className={`flex h-[min(82cqh,8cqw)] w-[min(82cqh,8cqw)] items-center justify-center rounded-[1.2cqw] text-[min(54cqh,5cqw)] font-black leading-none ${
              isActive
                ? 'bg-gradient-to-br from-cyan-300 to-violet-400 text-[#07101d] shadow-[0_0_22px_rgba(34,211,238,0.25)]'
                : isComplete
                  ? 'bg-white/[0.04] text-cyan-300/45'
                  : 'bg-white/[0.07] text-white/50'
            }`}>
              {isComplete ? '✓' : String(index + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0">
              <div className={`truncate text-[min(56cqh,7cqw)] font-black leading-none tracking-[-0.045em] ${isActive ? 'text-white' : ''}`}>
                {period.title || `Period ${index + 1}`}
              </div>
              <div className={`mt-[5cqh] truncate text-[min(22cqh,2.4cqw)] font-bold uppercase leading-none tracking-[0.08em] ${isActive ? 'text-cyan-200/70' : 'text-white/25'}`}>
                {assignmentCount} assignment{assignmentCount === 1 ? '' : 's'}
              </div>
            </div>
            <div className={`text-[min(68cqh,7.2cqw)] font-black leading-none tracking-[-0.05em] tabular-nums ${isActive ? 'text-cyan-100' : isComplete ? 'text-white/20' : 'text-white/85'}`}>
              {formatDuration(isActive ? remainingSeconds : period.durationSeconds)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivePeriod({
  period,
  periodNumber,
  remainingSeconds,
  timerStatus,
}: {
  period: PracticeBoardDrill;
  periodNumber: number;
  remainingSeconds: number;
  timerStatus: PracticeBoardState['timerStatus'] | undefined;
}) {
  const assignments = period.assignments?.slice(0, 12) || [];
  const progress = period.durationSeconds > 0
    ? Math.max(0, Math.min(100, (remainingSeconds / period.durationSeconds) * 100))
    : 0;
  const expired = remainingSeconds === 0;

  return (
    <main className="grid min-h-0 grid-rows-[36%_minmax(0,1fr)] gap-[1.5cqh] p-[2cqh_2cqw]">
      <section className="relative flex min-h-0 items-center overflow-hidden rounded-[2.2cqw] border border-white/[0.10] bg-gradient-to-br from-white/[0.075] via-white/[0.04] to-violet-500/[0.08] px-[3cqw] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2cqh_7cqw_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute -left-[12cqw] -top-[20cqh] h-[45cqw] w-[45cqw] rounded-full bg-cyan-400/[0.12] blur-[7cqw]" />
        <div className="relative w-full min-w-0">
          <div className="flex items-center gap-[1cqw] text-[min(2.7cqh,2cqw)] font-black uppercase tracking-[0.2em] text-cyan-200/65">
            <span>Period {String(periodNumber).padStart(2, '0')}</span>
            <span className="h-[0.55cqh] w-[0.55cqh] rounded-full bg-cyan-300" />
            <span>{expired ? 'Time' : timerStatusLabel(timerStatus)}</span>
          </div>
          <h1 className="mt-[1.2cqh] truncate text-[min(13cqh,10cqw)] font-black leading-[0.9] tracking-[-0.065em] text-white">
            {period.title || `Period ${periodNumber}`}
          </h1>
          <div className="mt-[2.8cqh] h-[1cqh] overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-200 ${expired ? 'from-rose-400 to-orange-300' : 'from-cyan-300 via-sky-400 to-violet-400'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid min-h-0 grid-rows-[auto_1fr] gap-[1cqh] overflow-hidden">
        <div className="flex items-center justify-between px-[0.8cqw]">
          <div className="text-[min(3.2cqh,2.35cqw)] font-black uppercase tracking-[0.16em] text-white/65">Position plan</div>
          <div className="text-[min(3cqh,2.2cqw)] font-extrabold text-white/50">{assignments.length} assignment{assignments.length === 1 ? '' : 's'}</div>
        </div>

        {assignments.length === 0 ? (
          <div className="flex min-h-0 items-center justify-center rounded-[2cqw] border border-dashed border-white/[0.10] bg-white/[0.025] text-[min(4cqh,3cqw)] font-bold text-white/25">
            No position assignments for this period
          </div>
        ) : (
          <div
            className="grid min-h-0 gap-[0.8cqh] overflow-hidden"
            style={{ gridTemplateRows: `repeat(${assignments.length}, minmax(0, 1fr))` }}
          >
            {assignments.map((assignment, index) => (
              <AssignmentCard key={assignment.id || index} assignment={assignment} index={index} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function AssignmentCard({ assignment, index }: { assignment: PracticeBoardAssignment; index: number }) {
  const position = assignment.position === 'Other'
    ? assignment.customPosition?.trim() || 'Other'
    : assignment.position;
  const accentClasses = index % 3 === 0
    ? 'border-cyan-300/15 bg-cyan-300/[0.055] text-cyan-100'
    : index % 3 === 1
      ? 'border-violet-300/15 bg-violet-300/[0.055] text-violet-100'
      : 'border-sky-300/15 bg-sky-300/[0.055] text-sky-100';

  return (
    <div
      className={`grid min-h-0 grid-cols-[minmax(18%,max-content)_1px_minmax(0,1fr)] items-center gap-[2cqw] overflow-hidden rounded-[1.6cqw] border px-[2cqw] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ${accentClasses}`}
      style={{ containerType: 'size' }}
    >
      <div className="truncate text-center text-[min(88cqh,8cqw)] font-black leading-none tracking-[-0.05em]">{position}</div>
      <div className="h-[52%] w-px bg-white/[0.10]" />
      <div className="truncate text-[min(88cqh,6.4cqw)] font-black leading-none tracking-[-0.04em] text-white/95">
        {assignment.drillName || 'Assignment not entered'}
      </div>
    </div>
  );
}

function projectRemainingSeconds(board: PracticeBoardState | undefined, now: number): number {
  if (!board) return 0;
  if (board.timerStatus !== 'running' || typeof board.startedAt !== 'number') {
    return Math.max(0, Math.round(board.remainingSeconds || 0));
  }
  const elapsedSeconds = Math.max(0, (now - board.startedAt) / 1000);
  return Math.max(0, Math.ceil(board.remainingSeconds - elapsedSeconds));
}

function getManualPreviewState(
  overviewUntil: number | undefined,
  now: number,
  previewDurationMs: number,
  pageCount: number
): SchedulePreviewState | undefined {
  if (typeof overviewUntil !== 'number' || overviewUntil <= now) return undefined;
  const previewStartedAt = overviewUntil - previewDurationMs;
  const elapsedMs = Math.max(0, now - previewStartedAt);
  return {
    until: overviewUntil,
    pageIndex: Math.min(pageCount - 1, Math.floor(elapsedMs / SCHEDULE_PREVIEW_DURATION_MS)),
  };
}

function getAutomaticPreviewState(
  board: PracticeBoardState | undefined,
  period: PracticeBoardDrill,
  now: number,
  previewDurationMs: number,
  pageCount: number
): SchedulePreviewState | undefined {
  if (board?.timerStatus !== 'running' || typeof board.startedAt !== 'number') return undefined;

  const remainingAtSnapshotMs = Math.max(0, board.remainingSeconds) * 1000;
  const elapsedSinceSnapshotMs = Math.max(0, now - board.startedAt);
  const projectedRemainingMs = remainingAtSnapshotMs - elapsedSinceSnapshotMs;
  if (projectedRemainingMs <= 0) return undefined;

  const elapsedPeriodMs = Math.max(0, period.durationSeconds * 1000 - projectedRemainingMs);
  if (elapsedPeriodMs < SCHEDULE_PREVIEW_INTERVAL_MS) return undefined;

  const previewCycleMs = Math.max(
    SCHEDULE_PREVIEW_INTERVAL_MS,
    previewDurationMs + SCHEDULE_PREVIEW_DURATION_MS
  );
  const intervalPositionMs = (elapsedPeriodMs - SCHEDULE_PREVIEW_INTERVAL_MS) % previewCycleMs;
  if (intervalPositionMs >= previewDurationMs) return undefined;

  return {
    until: now + previewDurationMs - intervalPositionMs,
    pageIndex: Math.min(pageCount - 1, Math.floor(intervalPositionMs / SCHEDULE_PREVIEW_DURATION_MS)),
  };
}

function getPreviewPageCount(periods: PracticeBoardDrill[]): number {
  const offenseCount = periods.filter((period) => getPeriodUnit(period) === 'offense').length;
  const defenseCount = periods.filter((period) => getPeriodUnit(period) === 'defense').length;
  const offensePages = Math.ceil(offenseCount / SCHEDULE_PREVIEW_PAGE_SIZE);
  const defensePages = Math.ceil(defenseCount / SCHEDULE_PREVIEW_PAGE_SIZE);
  return Math.max(1, offensePages + defensePages);
}

function getPeriodUnit(period: PracticeBoardDrill): 'offense' | 'defense' {
  return period.unit === 'defense' ? 'defense' : 'offense';
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatLocationTime(now: number, timezone?: string) {
  try {
    return { dayAndDate: buildLocationTime(now, timezone ? { timeZone: timezone } : {}) };
  } catch {
    return { dayAndDate: buildLocationTime(now, {}) };
  }
}

function buildLocationTime(now: number, options: Intl.DateTimeFormatOptions): string {
  const weekday = new Intl.DateTimeFormat('en-US', { ...options, weekday: 'short' }).format(now);
  const date = new Intl.DateTimeFormat('en-US', { ...options, month: 'numeric', day: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-US', { ...options, hour: 'numeric', minute: '2-digit' })
    .format(now)
    .replace(' ', '');
  return `${weekday} ${date} · ${time}`;
}

function timerStatusLabel(status: PracticeBoardState['timerStatus'] | undefined): string {
  if (status === 'running') return 'In progress';
  if (status === 'paused') return 'Stopped';
  if (status === 'complete') return 'Complete';
  return 'Ready';
}
