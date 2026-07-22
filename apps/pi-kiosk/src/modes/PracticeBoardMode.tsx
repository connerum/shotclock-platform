import { useEffect, useMemo, useState } from 'react';
import type { PracticeBoardState } from '@shotclock/shared/types';

export default function PracticeBoardMode({ board }: { board?: PracticeBoardState }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), board?.timerStatus === 'running' ? 200 : 1000);
    return () => clearInterval(interval);
  }, [board?.timerStatus]);

  const drills = board?.drills?.slice(0, 12) || [];
  const activeIndex = drills.findIndex((drill) => drill.id === board?.activeDrillId);
  const activeDrill = activeIndex >= 0 ? drills[activeIndex] : undefined;
  const remainingSeconds = projectRemainingSeconds(board, now);
  const timezone = board?.weather?.timezone;
  const clock = useMemo(() => formatLocationTime(now, timezone), [now, timezone]);
  const progress = activeDrill && activeDrill.durationSeconds > 0
    ? Math.max(0, Math.min(100, (remainingSeconds / activeDrill.durationSeconds) * 100))
    : 0;

  return (
    <div
      className="grid h-full w-full grid-rows-[22%_78%] overflow-hidden bg-black font-mono text-white"
      style={{ containerType: 'size' }}
    >
      <header className="grid min-h-0 grid-cols-[1.2fr_1fr_auto] items-center gap-[2cqw] border-b border-green-500/35 bg-gradient-to-r from-green-950/80 via-gray-950 to-black px-[3cqw]">
        <div className="min-w-0 leading-none">
          <div className="truncate text-[min(3.8cqh,3cqw)] font-black uppercase tracking-tight text-white">
            {clock.dayAndDate}
          </div>
          <div className="mt-[1cqh] truncate text-[min(3.5cqh,2.7cqw)] font-bold uppercase tracking-[0.12em] text-green-400">
            {board?.weather?.locationLabel || 'Practice Board'}
          </div>
        </div>

        <div className="min-w-0 border-l border-white/15 pl-[2.5cqw] leading-none">
          <div className="truncate text-[min(5cqh,3.5cqw)] font-black uppercase text-gray-200">
            {board?.weather?.description || 'Weather not set'}
          </div>
          <div className="mt-[1.2cqh] truncate text-[min(4cqh,2.8cqw)] font-bold text-gray-400">
            {board?.weather ? `${Math.round(board.weather.temperatureF)}°F · Open-Meteo` : 'Set a location in WebUI'}
          </div>
        </div>

        <div className="flex h-[72%] min-w-[17cqw] flex-col items-center justify-center rounded-[1.5cqw] border border-cyan-400/35 bg-cyan-950/35 px-[2cqw] leading-none">
          <span className="text-[min(3.6cqh,2.5cqw)] font-black uppercase tracking-[0.15em] text-cyan-300">Wet Bulb</span>
          <span className="mt-[1cqh] text-[min(8cqh,5.5cqw)] font-black tabular-nums text-white">
            {board?.weather ? `${Math.round(board.weather.wetBulbF)}°` : '--'}
          </span>
        </div>
      </header>

      {drills.length === 0 ? (
        <div className="flex min-h-0 flex-col items-center justify-center px-[6cqw] text-center">
          <div className="text-[min(12cqh,8cqw)] font-black uppercase text-green-400">Practice Ready</div>
          <div className="mt-[3cqh] text-[min(5cqh,3.8cqw)] font-bold text-gray-500">Add drills from the WebUI to build today&apos;s plan.</div>
        </div>
      ) : (
        <div
          className="grid min-h-0 gap-[0.7cqh] overflow-hidden p-[1.2cqh_1.2cqw]"
          style={{ gridTemplateRows: `repeat(${drills.length}, minmax(0, 1fr))` }}
        >
          {drills.map((drill, index) => {
            const isActive = index === activeIndex;
            const isComplete = activeIndex >= 0 && index < activeIndex;
            const displaySeconds = isActive ? remainingSeconds : drill.durationSeconds;
            const expired = isActive && displaySeconds === 0;

            return (
              <div
                key={drill.id}
                className={`relative grid min-h-0 grid-cols-[auto_1fr_auto] items-center gap-[2cqw] overflow-hidden rounded-[1cqw] border px-[2cqw] leading-none ${
                  isActive
                    ? 'border-green-400/80 bg-green-950/60 shadow-[inset_0_0_18px_rgba(34,197,94,0.16)]'
                    : isComplete
                      ? 'border-white/5 bg-white/[0.025] text-gray-500'
                      : 'border-white/10 bg-white/[0.055]'
                }`}
              >
                {isActive && (
                  <div className="absolute bottom-0 left-0 h-[0.8cqh] bg-green-400 transition-[width] duration-200" style={{ width: `${progress}%` }} />
                )}
                <div className={`flex h-[min(7cqh,5cqw)] w-[min(7cqh,5cqw)] items-center justify-center rounded-full text-[min(4.2cqh,2.8cqw)] font-black ${
                  isActive ? 'bg-green-400 text-black' : isComplete ? 'bg-gray-900 text-green-500' : 'bg-gray-800 text-gray-400'
                }`}>
                  {isComplete ? '✓' : index + 1}
                </div>
                <div className="min-w-0">
                  <div className={`truncate text-[min(7cqh,5.2cqw)] font-black uppercase tracking-tight ${isActive ? 'text-white' : ''}`}>
                    {drill.title || 'Untitled drill'}
                  </div>
                  {isActive && (
                    <div className={`mt-[0.7cqh] text-[min(3.5cqh,2.5cqw)] font-black uppercase tracking-[0.14em] ${expired ? 'text-red-400' : 'text-green-400'}`}>
                      {expired ? 'Time · Move to next' : timerStatusLabel(board?.timerStatus)}
                    </div>
                  )}
                </div>
                <div className={`text-right text-[min(9cqh,6.4cqw)] font-black tabular-nums ${
                  expired ? 'text-red-400' : isActive ? 'text-green-300' : isComplete ? 'text-gray-600' : 'text-white'
                }`}>
                  {formatDuration(displaySeconds)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function projectRemainingSeconds(board: PracticeBoardState | undefined, now: number): number {
  if (!board) return 0;
  if (board.timerStatus !== 'running' || typeof board.startedAt !== 'number') {
    return Math.max(0, Math.round(board.remainingSeconds || 0));
  }
  return Math.max(0, Math.ceil(board.remainingSeconds - (now - board.startedAt) / 1000));
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
