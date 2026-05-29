import { useEffect, useMemo, useState } from 'react';
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
      homeTimeouts?: number;
      awayTimeouts?: number;
      period?: number;
    };
  };
}

export default function VolleyballMode({ state }: VolleyballModeProps) {
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const timerState = state?.timerState;
  const homeScore = timerState?.homeScore ?? 0;
  const awayScore = timerState?.awayScore ?? 0;
  const homeSets = timerState?.homeSets ?? 0;
  const awaySets = timerState?.awaySets ?? 0;
  const homeTimeouts = timerState?.homeTimeouts ?? 0;
  const awayTimeouts = timerState?.awayTimeouts ?? 0;
  const set = timerState?.period ?? 1;
  const branding = state?.mode?.scoreboardBranding;
  const homeLabel = branding?.enabled ? normalizeLabel(branding.homeLabel, 'HOME') : 'HOME';
  const awayLabel = branding?.enabled ? normalizeLabel(branding.awayLabel, 'AWAY') : 'AWAY';
  const homeColor = branding?.enabled && isHexColor(branding.homeColor) ? branding.homeColor : DEFAULT_HOME_COLOR;
  const awayColor = branding?.enabled && isHexColor(branding.awayColor) ? branding.awayColor : DEFAULT_AWAY_COLOR;
  const topMedia = useMemo(() => {
    if (!branding || !branding.volleyballTopDisplay || branding.volleyballTopDisplay === 'empty') return null;

    const playlist = branding.volleyballTopMediaPlaylist || [];
    if (playlist.length > 0) {
      return playlist[playlistIndex % playlist.length];
    }

    if (branding.volleyballTopMediaUrl && branding.volleyballTopMediaMimeType) {
      return {
        mediaUrl: branding.volleyballTopMediaUrl,
        mediaMimeType: branding.volleyballTopMediaMimeType,
      };
    }

    return null;
  }, [branding, playlistIndex]);

  useEffect(() => {
    setPlaylistIndex(0);
  }, [branding?.volleyballTopDisplay, branding?.volleyballTopMediaUrl]);

  useEffect(() => {
    const playlist = branding?.volleyballTopMediaPlaylist || [];
    if (playlist.length <= 1) return;

    const interval = setInterval(() => {
      setPlaylistIndex((index) => (index + 1) % playlist.length);
    }, Math.max(1000, branding?.volleyballTopRotationIntervalMs ?? 8000));

    return () => clearInterval(interval);
  }, [branding?.volleyballTopMediaPlaylist, branding?.volleyballTopRotationIntervalMs]);

  return (
    <div
      className="grid h-full w-full grid-rows-[13%_62%_25%] overflow-hidden bg-black px-1.5 py-1 font-mono text-white"
      style={{ containerType: 'size' }}
    >
      <div className="relative flex min-h-0 items-center justify-between gap-1 overflow-hidden text-[min(8cqh,4cqw)] font-black leading-none text-gray-400">
        <span>VBALL</span>
        <TopMedia media={topMedia} />
        <span>SET {set}</span>
      </div>
      <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-0.5 overflow-hidden leading-none">
        <TeamScore label={homeLabel} value={homeScore} color={homeColor} />
        <span className="text-[min(16cqh,8cqw)] font-black text-gray-700">-</span>
        <TeamScore label={awayLabel} value={awayScore} color={awayColor} />
      </div>
      <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-center gap-1 overflow-hidden border-t border-gray-900 leading-none">
        <SetScore value={homeSets} color={homeColor} timeouts={homeTimeouts} timeoutSide="left" />
        <span className="text-[min(5cqh,3cqw)] font-black leading-none text-gray-500">SET</span>
        <SetScore value={awaySets} color={awayColor} timeouts={awayTimeouts} timeoutSide="right" />
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

function SetScore({
  value,
  color,
  timeouts,
  timeoutSide,
}: {
  value: number;
  color: string;
  timeouts: number;
  timeoutSide: 'left' | 'right';
}) {
  return (
    <div className="relative flex min-h-0 items-center justify-center gap-0.5 overflow-hidden">
      <TimeoutDots count={timeouts} side={timeoutSide} color={color} />
      <span className="text-[min(16cqh,9cqw)] font-black leading-none tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

function TopMedia({ media }: { media: { mediaUrl: string; mediaMimeType: string } | null }) {
  if (!media) return null;

  const isImage = media.mediaMimeType.startsWith('image/');
  const isVideo = media.mediaMimeType.startsWith('video/');
  if (!isImage && !isVideo) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-full max-h-full w-[34cqw] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden">
      {isImage && <img src={media.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />}
      {isVideo && <video key={media.mediaUrl} src={media.mediaUrl} autoPlay muted playsInline loop className="max-h-full max-w-full object-contain" />}
    </div>
  );
}

function TimeoutDots({ count, side, color }: { count: number; side: 'left' | 'right'; color: string }) {
  return (
    <div className={`absolute top-1/2 flex -translate-y-1/2 flex-col gap-[min(1cqh,0.7cqw)] ${side === 'left' ? 'left-0' : 'right-0'}`}>
      {[0, 1].map((index) => (
        <span
          key={index}
          className="h-[min(4cqh,2.6cqw)] w-[min(4cqh,2.6cqw)] rounded-full border-2"
          style={{
            borderColor: color,
            backgroundColor: index < Math.max(0, Math.min(2, count)) ? color : 'transparent',
          }}
        />
      ))}
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
