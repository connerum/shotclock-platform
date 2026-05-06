interface VolleyballModeProps {
  state?: {
    timerState?: {
      homeScore: number;
      awayScore: number;
      homeSets?: number;
      awaySets?: number;
      period?: number;
    };
  };
}

export default function VolleyballMode({ state }: VolleyballModeProps) {
  const timerState = state?.timerState;
  const homeScore = timerState?.homeScore ?? 0;
  const awayScore = timerState?.awayScore ?? 0;
  const homeSets = timerState?.homeSets ?? 0;
  const awaySets = timerState?.awaySets ?? 0;
  const set = timerState?.period ?? 1;

  return (
    <div
      className="grid h-full w-full grid-rows-[13%_62%_25%] overflow-hidden bg-black px-1.5 py-1 font-mono text-white"
      style={{ containerType: 'size' }}
    >
      <div className="flex min-h-0 items-center justify-between gap-1 overflow-hidden text-[min(8cqh,4cqw)] font-black leading-none text-gray-400">
        <span>VBALL</span>
        <span>SET {set}</span>
      </div>
      <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-0.5 overflow-hidden leading-none">
        <TeamScore label="HOME" value={homeScore} className="text-red-500" />
        <span className="text-[min(16cqh,8cqw)] font-black text-gray-700">-</span>
        <TeamScore label="AWAY" value={awayScore} className="text-blue-500" />
      </div>
      <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-0.5 overflow-hidden border-t border-gray-900 leading-none">
        <SetScore label="S" value={homeSets} className="text-red-400" />
        <span className="text-[min(8cqh,5cqw)] font-black text-gray-700">-</span>
        <SetScore label="S" value={awaySets} className="text-blue-400" />
      </div>
    </div>
  );
}

function TeamScore({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="grid min-h-0 grid-rows-[18%_82%] overflow-hidden">
      <div className={`flex min-h-0 items-center justify-center text-[min(7cqh,4cqw)] font-black leading-none ${className}`}>{label}</div>
      <div className={`flex min-h-0 items-center justify-center text-[min(48cqh,30cqw)] font-black leading-none tabular-nums ${className}`}>{value}</div>
    </div>
  );
}

function SetScore({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="grid min-h-0 grid-cols-[1fr_auto] items-center gap-0.5 overflow-hidden">
      <span className={`text-right text-[min(6cqh,3.5cqw)] font-black leading-none ${className}`}>{label}</span>
      <span className={`text-[min(16cqh,9cqw)] font-black leading-none tabular-nums ${className}`}>{value}</span>
    </div>
  );
}
