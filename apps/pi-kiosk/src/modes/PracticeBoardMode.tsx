import { useEffect, useMemo, useState } from 'react';
import type {
  PracticeBoardAssignment,
  PracticeBoardDrill,
  PracticeBoardState,
} from '@shotclock/shared/types';

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

  const periods = board?.drills?.slice(0, 12) || [];
  const activeIndex = periods.findIndex((period) => period.id === board?.activeDrillId);
  const activePeriod = activeIndex >= 0 ? periods[activeIndex] : undefined;
  const remainingSeconds = projectRemainingSeconds(board, now);
  const timezone = board?.weather?.timezone;
  const clock = useMemo(() => formatLocationTime(now, timezone), [now, timezone]);
  const showOverview = !activePeriod || Boolean(board?.overviewUntil && now < board.overviewUntil);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#050816] font-sans text-white"
      style={{ containerType: 'size' }}
    >
      <div className="pointer-events-none absolute -left-[18cqw] -top-[22cqh] h-[60cqw] w-[60cqw] rounded-full bg-cyan-500/[0.10] blur-[9cqw]" />
      <div className="pointer-events-none absolute -bottom-[34cqh] right-[-12cqw] h-[70cqw] w-[70cqw] rounded-full bg-violet-500/[0.13] blur-[10cqw]" />
      <div className="relative grid h-full w-full grid-rows-[15%_85%]">
        <StatusBar board={board} clock={clock} />
        {showOverview ? (
          <ScheduleOverview
            periods={periods}
            activeIndex={activeIndex}
            remainingSeconds={remainingSeconds}
            secondsUntilFullView={activePeriod && board?.overviewUntil
              ? Math.max(0, Math.ceil((board.overviewUntil - now) / 1000))
              : null}
          />
        ) : (
          <ActivePeriod
            period={activePeriod}
            periodNumber={activeIndex + 1}
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
}: {
  board?: PracticeBoardState;
  clock: { dayAndDate: string };
}) {
  return (
    <header className="grid min-h-0 grid-cols-[1fr_auto_auto] items-center gap-[1.5cqw] border-b border-white/[0.08] bg-[#070b1a]/80 px-[2.5cqw] backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-[1.5cqw]">
        <div className="flex h-[min(7cqh,5cqw)] w-[min(7cqh,5cqw)] items-center justify-center rounded-[1.4cqw] bg-gradient-to-br from-cyan-300 to-violet-500 shadow-[0_0_26px_rgba(34,211,238,0.28)]">
          <span className="text-[min(3.8cqh,2.8cqw)] font-black text-[#07101d]">P</span>
        </div>
        <div className="min-w-0 leading-none">
          <div className="text-[min(2.5cqh,1.8cqw)] font-black uppercase tracking-[0.24em] text-cyan-300">Practice</div>
          <div className="mt-[1cqh] truncate text-[min(3.5cqh,2.6cqw)] font-bold tracking-[-0.02em] text-white/85">{clock.dayAndDate}</div>
        </div>
      </div>

      <div className="min-w-[20cqw] rounded-[1.3cqw] border border-white/[0.08] bg-white/[0.045] px-[2cqw] py-[1.3cqh] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="text-[min(2.2cqh,1.6cqw)] font-bold uppercase tracking-[0.18em] text-white/35">Conditions</div>
        <div className="mt-[1cqh] truncate text-[min(3.5cqh,2.5cqw)] font-extrabold text-white/90">
          {board?.weather ? `${board.weather.description} · ${Math.round(board.weather.temperatureF)}°` : 'Weather not set'}
        </div>
      </div>

      <div className="min-w-[14cqw] rounded-[1.3cqw] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.12] to-violet-500/[0.10] px-[2cqw] py-[1.3cqh] text-right leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
        <div className="text-[min(2cqh,1.45cqw)] font-bold uppercase tracking-[0.12em] text-cyan-200/60">Wet bulb</div>
        <div className="mt-[0.8cqh] text-[min(4.6cqh,3.3cqw)] font-black tabular-nums text-white">
          {board?.weather ? `${Math.round(board.weather.wetBulbF)}°` : '--'}
        </div>
      </div>
    </header>
  );
}

function ScheduleOverview({
  periods,
  activeIndex,
  remainingSeconds,
  secondsUntilFullView,
}: {
  periods: PracticeBoardDrill[];
  activeIndex: number;
  remainingSeconds: number;
  secondsUntilFullView: number | null;
}) {
  if (periods.length === 0) {
    return (
      <div className="flex min-h-0 flex-col items-center justify-center px-[8cqw] text-center">
        <div className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-[2.5cqw] py-[1.2cqh] text-[min(2.8cqh,2cqw)] font-black uppercase tracking-[0.24em] text-cyan-200">Board ready</div>
        <div className="mt-[3cqh] text-[min(10cqh,7cqw)] font-black tracking-[-0.06em] text-white">Build today&apos;s plan</div>
        <div className="mt-[2cqh] text-[min(4cqh,3cqw)] font-medium text-white/35">Add periods and position assignments from the WebUI.</div>
      </div>
    );
  }

  return (
    <section className="grid min-h-0 grid-rows-[auto_1fr] gap-[1.5cqh] p-[2cqh_2cqw]">
      <div className="flex items-end justify-between gap-[2cqw] px-[0.5cqw]">
        <div>
          <div className="text-[min(2.5cqh,1.8cqw)] font-black uppercase tracking-[0.24em] text-cyan-300/65">Schedule preview</div>
          <div className="mt-[0.5cqh] text-[min(5cqh,3.6cqw)] font-black tracking-[-0.04em] text-white">Today&apos;s practice</div>
        </div>
        {secondsUntilFullView !== null && (
          <div className="rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-[2cqw] py-[1cqh] text-[min(2.5cqh,1.8cqw)] font-extrabold uppercase tracking-[0.12em] text-violet-200">
            Full period view in {secondsUntilFullView}
          </div>
        )}
      </div>

      <div
        className="grid min-h-0 gap-[0.8cqh] overflow-hidden"
        style={{ gridTemplateRows: `repeat(${periods.length}, minmax(0, 1fr))` }}
      >
        {periods.map((period, index) => {
          const isActive = index === activeIndex;
          const isComplete = activeIndex >= 0 && index < activeIndex;
          const assignmentCount = period.assignments?.length || 0;
          return (
            <div
              key={period.id}
              className={`relative grid min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[1.8cqw] overflow-hidden rounded-[1.5cqw] border px-[1.6cqw] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ${
                isActive
                  ? 'border-cyan-300/35 bg-gradient-to-r from-cyan-400/[0.14] to-violet-500/[0.09]'
                  : isComplete
                    ? 'border-white/[0.05] bg-white/[0.025] text-white/30'
                    : 'border-white/[0.08] bg-white/[0.045]'
              }`}
            >
              <div className={`flex h-[min(7cqh,4.6cqw)] w-[min(7cqh,4.6cqw)] items-center justify-center rounded-[1.2cqw] text-[min(3.5cqh,2.5cqw)] font-black ${
                isActive
                  ? 'bg-gradient-to-br from-cyan-300 to-violet-400 text-[#07101d] shadow-[0_0_22px_rgba(34,211,238,0.25)]'
                  : isComplete
                    ? 'bg-white/[0.04] text-cyan-300/45'
                    : 'bg-white/[0.07] text-white/50'
              }`}>
                {isComplete ? '✓' : String(index + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0">
                <div className={`truncate text-[min(5.5cqh,4cqw)] font-black tracking-[-0.035em] ${isActive ? 'text-white' : ''}`}>
                  {period.title || `Period ${index + 1}`}
                </div>
                <div className={`mt-[0.6cqh] text-[min(2.2cqh,1.6cqw)] font-bold uppercase tracking-[0.14em] ${isActive ? 'text-cyan-200/70' : 'text-white/25'}`}>
                  {assignmentCount} position assignment{assignmentCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className={`text-[min(6.2cqh,4.6cqw)] font-black tracking-[-0.04em] tabular-nums ${isActive ? 'text-cyan-100' : isComplete ? 'text-white/20' : 'text-white/85'}`}>
                {formatDuration(isActive ? remainingSeconds : period.durationSeconds)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
    <main className="grid min-h-0 grid-rows-[36%_64%] gap-[1.5cqh] p-[2cqh_2cqw]">
      <section className="relative grid min-h-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[3cqw] overflow-hidden rounded-[2.2cqw] border border-white/[0.10] bg-gradient-to-br from-white/[0.075] via-white/[0.04] to-violet-500/[0.08] px-[3cqw] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2cqh_7cqw_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute -left-[12cqw] -top-[20cqh] h-[45cqw] w-[45cqw] rounded-full bg-cyan-400/[0.12] blur-[7cqw]" />
        <div className="relative min-w-0">
          <div className="flex items-center gap-[1cqw] text-[min(2.7cqh,2cqw)] font-black uppercase tracking-[0.2em] text-cyan-200/65">
            <span>Period {String(periodNumber).padStart(2, '0')}</span>
            <span className="h-[0.55cqh] w-[0.55cqh] rounded-full bg-cyan-300" />
            <span>{expired ? 'Time' : timerStatusLabel(timerStatus)}</span>
          </div>
          <h1 className="mt-[1.2cqh] truncate text-[min(11.5cqh,8.5cqw)] font-black leading-[0.9] tracking-[-0.065em] text-white">
            {period.title || `Period ${periodNumber}`}
          </h1>
          <div className="mt-[2.8cqh] h-[1cqh] overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-200 ${expired ? 'from-rose-400 to-orange-300' : 'from-cyan-300 via-sky-400 to-violet-400'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className={`relative rounded-[2cqw] border px-[3cqw] py-[2.2cqh] text-[min(11cqh,8cqw)] font-black leading-none tracking-[-0.06em] tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
          expired
            ? 'border-rose-300/25 bg-rose-400/[0.10] text-rose-200'
            : 'border-cyan-300/20 bg-[#070d20]/75 text-white'
        }`}>
          {formatDuration(remainingSeconds)}
        </div>
      </section>

      <section className="grid min-h-0 grid-rows-[auto_1fr] gap-[1cqh] overflow-hidden">
        <div className="flex items-center justify-between px-[0.8cqw]">
          <div className="text-[min(2.5cqh,1.8cqw)] font-black uppercase tracking-[0.2em] text-white/40">Position plan</div>
          <div className="text-[min(2.3cqh,1.7cqw)] font-bold text-white/25">{assignments.length} assignment{assignments.length === 1 ? '' : 's'}</div>
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
    <div className={`grid min-h-0 grid-cols-[18%_1px_minmax(0,1fr)] items-center gap-[2cqw] overflow-hidden rounded-[1.6cqw] border px-[2cqw] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ${accentClasses}`}>
      <div className="truncate text-center text-[min(5cqh,3.7cqw)] font-black tracking-[-0.04em]">{position}</div>
      <div className="h-[52%] w-px bg-white/[0.10]" />
      <div className="truncate text-[min(4.8cqh,3.6cqw)] font-extrabold tracking-[-0.025em] text-white/90">
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
