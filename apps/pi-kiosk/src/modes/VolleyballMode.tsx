import type { ScoreboardBranding } from '@shotclock/shared/types';

const DEFAULT_HOME_COLOR = '#ef4444';
const DEFAULT_AWAY_COLOR = '#3b82f6';

interface VolleyballModeProps {
  state?: {
    mode?: { scoreboardBranding?: ScoreboardBranding };
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
  const branding = state?.mode?.scoreboardBranding;
  const homeLabel = branding?.enabled ? normalizeLabel(branding.homeLabel, 'HOME') : 'HOME';
  const awayLabel = branding?.enabled ? normalizeLabel(branding.awayLabel, 'AWAY') : 'AWAY';
  const homeColor = branding?.enabled && isHexColor(branding.homeColor) ? branding.homeColor : DEFAULT_HOME_COLOR;
  const awayColor = branding?.enabled && isHexColor(branding.awayColor) ? branding.awayColor : DEFAULT_AWAY_COLOR;

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
        <TeamScore label={homeLabel} value={homeScore} color={homeColor} />
        <span className="text-[min(16cqh,8cqw)] font-black text-gray-700">-</span>
        <TeamScore label={awayLabel} value={awayScore} color={awayColor} />
      </div>
      <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-1 overflow-hidden border-t border-gray-900 leading-none">
        <SetScore label="S" value={homeSets} color={homeColor} />
        <span className="text-[min(5cqh,3cqw)] font-black leading-none text-gray-500">SET</span>
        <SetScore label="S" value={awaySets} color={awayColor} />
      </div>
    </div>
  );
}

function TeamScore({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="grid min-h-0 grid-rows-[18%_82%] overflow-hidden">
      <div className="flex min-h-0 items-center justify-center text-[min(7cqh,4cqw)] font-black uppercase leading-none" style={{ color }}>{label}</div>
      <div className="flex min-h-0 items-center justify-center text-[min(48cqh,30cqw)] font-black leading-none tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function SetScore({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex min-h-0 items-center justify-center gap-0.5 overflow-hidden">
      <span className="text-[min(6cqh,3.5cqw)] font-black leading-none" style={{ color }}>{label}</span>
      <span className="text-[min(16cqh,9cqw)] font-black leading-none tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

function normalizeLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 18) : fallback;
}

function isHexColor(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
}
