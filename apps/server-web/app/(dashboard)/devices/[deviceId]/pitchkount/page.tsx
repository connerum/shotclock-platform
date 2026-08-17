'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DEFAULT_PITCHKOUNT_STATE,
  PITCHKOUNT_DAILY_LIMIT,
  PITCHKOUNT_PITCH_TYPES,
  PITCHKOUNT_SLIDE_DURATION_MS,
  normalizePitchKountState,
  type DeviceMode,
  type PitchKountPitchType,
  type PitchKountState,
} from '@shotclock/shared/types';
import { SyncTargetBanner, useDeviceCommandDispatcher } from '../../../SelectedDevicesProvider';

type DeviceResponse = {
  device: {
    name: string;
    isOnline: boolean;
    displayState?: { deviceMode?: DeviceMode } | null;
  };
};

export default function PitchKountPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { sendCommand } = useDeviceCommandDispatcher(deviceId);
  const [deviceName, setDeviceName] = useState('PitchKount Display');
  const [isOnline, setIsOnline] = useState(false);
  const [pitchKount, setPitchKount] = useState<PitchKountState>(DEFAULT_PITCHKOUNT_STATE);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/devices/${deviceId}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load this display.');
        const data = await response.json() as DeviceResponse;
        setDeviceName(data.device.name);
        setIsOnline(data.device.isOnline);
        setPitchKount(normalizePitchKountState(data.device.displayState?.deviceMode?.pitchKount));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load this display.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [deviceId]);

  const updateDraft = <Key extends keyof PitchKountState>(key: Key, value: PitchKountState[Key]) => {
    setPitchKount((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const sendState = async (nextState: PitchKountState, successMessage: string) => {
    const normalized = normalizePitchKountState(nextState);
    const previous = pitchKount;
    setPitchKount(normalized);
    setSending(true);
    setError(null);
    setNotice(null);

    try {
      const { response, data } = await sendCommand('set_mode', {
        mode: { type: 'pitchkount', pitchKount: normalized } satisfies DeviceMode,
      });
      if (!response.ok) throw new Error(data?.error || 'The display did not accept the PitchKount update.');
      setNotice(successMessage);
      return true;
    } catch (sendError) {
      setPitchKount(previous);
      setError(sendError instanceof Error ? sendError.message : 'Unable to update the display.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const sendPatch = (patch: Partial<PitchKountState>, message: string) => {
    void sendState({ ...pitchKount, ...patch }, message);
  };

  const recordPitch = (result: 'pitch' | 'strike' | 'ball') => {
    const next = {
      ...pitchKount,
      pitchCount: pitchKount.pitchCount + 1,
      ...(result === 'strike' ? { strikes: pitchKount.strikes + 1 } : {}),
      ...(result === 'ball' ? { balls: pitchKount.balls + 1 } : {}),
    };
    void sendState(next, result === 'pitch' ? 'Pitch recorded.' : `${result === 'strike' ? 'Strike' : 'Ball'} recorded.`);
  };

  const uploadHeadshot = async (file: File | null) => {
    if (!file) return;

    setUploadingHeadshot(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('slot', 'pitchkount-headshot');

      const response = await fetch(`/api/devices/${deviceId}/media`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Upload failed with HTTP ${response.status}`);

      const headshotUrl = getPublicMediaUrl(data.mediaAsset.url);
      await sendState({ ...pitchKount, headshotUrl }, 'Player headshot updated.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Headshot upload failed.');
    } finally {
      setUploadingHeadshot(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading PitchKount controls...</div>;
  }

  return (
    <div className="pb-12">
      <Link href={`/devices/${deviceId}`} className="mb-4 inline-block text-gray-400 hover:text-white">
        ← Back to Sports
      </Link>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-sky-400">Baseball display</div>
          <h1 className="mt-1 text-3xl font-black italic tracking-tight">PitchKount</h1>
          <p className="mt-1 text-sm text-white/50">{deviceName} · Composed for a 128 × 256 portrait LED board.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${
          isOnline ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
        }`}>
          {isOnline ? '● Online' : '○ Offline'}
        </span>
      </div>

      <SyncTargetBanner deviceId={deviceId} />
      {error && <div className="mb-4 rounded-lg border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">{error}</div>}
      {notice && <div className="mb-4 rounded-lg border border-green-600/50 bg-green-950/50 p-3 text-sm text-green-200">{notice}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="cc-card p-5">
            <div className="mb-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Live pitch controls</div>
              <p className="mt-1 text-sm text-white/50">These buttons update the display immediately.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button type="button" disabled={sending} onClick={() => recordPitch('strike')} className="rounded-xl bg-red-600 px-4 py-5 text-lg font-black hover:bg-red-500 disabled:opacity-50">
                + Strike
              </button>
              <button type="button" disabled={sending} onClick={() => recordPitch('ball')} className="rounded-xl bg-sky-600 px-4 py-5 text-lg font-black hover:bg-sky-500 disabled:opacity-50">
                + Ball
              </button>
              <button type="button" disabled={sending} onClick={() => recordPitch('pitch')} className="rounded-xl bg-white/10 px-4 py-5 text-lg font-black hover:bg-white/15 disabled:opacity-50">
                + Pitch Only
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stepper
                label="Pitch count"
                value={pitchKount.pitchCount}
                disabled={sending}
                onChange={(pitchCount) => sendPatch({ pitchCount }, 'Pitch count updated.')}
                maximum={999}
              />
              <Stepper
                label="Pitch speed"
                value={pitchKount.pitchSpeedMph}
                suffix="MPH"
                disabled={sending}
                onChange={(pitchSpeedMph) => sendPatch({ pitchSpeedMph }, 'Pitch speed updated.')}
                maximum={120}
              />
              <Stepper
                label="Strikes"
                value={pitchKount.strikes}
                disabled={sending}
                onChange={(strikes) => sendPatch({ strikes }, 'Strike total updated.')}
                maximum={999}
              />
              <Stepper
                label="Balls"
                value={pitchKount.balls}
                disabled={sending}
                onChange={(balls) => sendPatch({ balls }, 'Ball total updated.')}
                maximum={999}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
              <label className="flex-1 text-sm font-semibold text-white/70">
                Pitch type
                <select
                  value={pitchKount.pitchType}
                  disabled={sending}
                  onChange={(event) => sendPatch({ pitchType: event.target.value as PitchKountPitchType }, 'Pitch type updated.')}
                  className="mt-2 w-full rounded-lg px-4 py-3"
                >
                  {PITCHKOUNT_PITCH_TYPES.map((pitchType) => <option key={pitchType} value={pitchType}>{pitchType}</option>)}
                </select>
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={pitchKount.showPitchSpeed}
                disabled={sending}
                onClick={() => sendPatch({ showPitchSpeed: !pitchKount.showPitchSpeed }, pitchKount.showPitchSpeed ? 'Pitch speed hidden.' : 'Pitch speed shown.')}
                className={`rounded-lg border px-5 py-3 text-left font-bold disabled:opacity-50 ${
                  pitchKount.showPitchSpeed
                    ? 'border-sky-500/50 bg-sky-950/50 text-sky-200'
                    : 'border-white/15 bg-white/5 text-white/55'
                }`}
              >
                Speed display: {pitchKount.showPitchSpeed ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => sendPatch({ pitchCount: 0, pitchSpeedMph: 0, strikes: 0, balls: 0 }, 'Live pitch totals reset.')}
                className="rounded-lg border border-red-500/40 bg-red-950/50 px-5 py-3 font-bold text-red-200 hover:bg-red-900/60 disabled:opacity-50"
              >
                Reset live totals
              </button>
            </div>
          </section>

          <section className="cc-card p-5">
            <div className="mb-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">Pitcher card</div>
              <p className="mt-1 text-sm text-white/50">Edit identity and season statistics, then send them together.</p>
            </div>

            <div className="mb-5 flex flex-col gap-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sky-500/35 bg-[#02070c]">
                  {pitchKount.headshotUrl ? (
                    <img src={pitchKount.headshotUrl} alt="Player headshot preview" className="h-full w-full object-cover object-top" />
                  ) : (
                    <span className="text-center text-xs font-black uppercase tracking-wider text-white/25">No<br />photo</span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">Player headshot</div>
                  <p className="mt-1 text-sm text-white/50">Portrait crop recommended. PNG, JPG, or WebP.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className={`cursor-pointer rounded-lg border border-sky-500/35 bg-sky-950/30 px-4 py-2.5 font-bold text-sky-200 hover:bg-sky-900/40 ${uploadingHeadshot || sending ? 'pointer-events-none opacity-50' : ''}`}>
                  {uploadingHeadshot ? 'Uploading...' : pitchKount.headshotUrl ? 'Replace photo' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploadingHeadshot || sending}
                    onChange={(event) => {
                      void uploadHeadshot(event.currentTarget.files?.[0] || null);
                      event.currentTarget.value = '';
                    }}
                    className="sr-only"
                  />
                </label>
                {pitchKount.headshotUrl && (
                  <button
                    type="button"
                    disabled={uploadingHeadshot || sending}
                    onClick={() => sendPatch({ headshotUrl: undefined }, 'Player headshot removed.')}
                    className="rounded-lg border border-red-500/25 bg-red-950/20 px-4 py-2.5 font-bold text-red-200 hover:bg-red-900/30 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Pitcher name" value={pitchKount.pitcherName} maxLength={28} onChange={(pitcherName) => updateDraft('pitcherName', pitcherName)} />
              <TextField label="Jersey number" value={pitchKount.pitcherNumber} maxLength={3} onChange={(pitcherNumber) => updateDraft('pitcherNumber', pitcherNumber)} />
              <TextField label="Team name" value={pitchKount.teamName} maxLength={20} onChange={(teamName) => updateDraft('teamName', teamName)} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <NumberField label="ERA" value={pitchKount.era} step="0.01" maximum={99.99} onChange={(era) => updateDraft('era', era)} />
              <NumberField label="Wins" value={pitchKount.wins} maximum={99} onChange={(wins) => updateDraft('wins', wins)} />
              <NumberField label="Losses" value={pitchKount.losses} maximum={99} onChange={(losses) => updateDraft('losses', losses)} />
              <TextField label="Innings" value={pitchKount.inningsPitched} maxLength={5} placeholder="52.1" onChange={(inningsPitched) => updateDraft('inningsPitched', inningsPitched)} />
              <NumberField label="Strikeouts" value={pitchKount.strikeouts} maximum={999} onChange={(strikeouts) => updateDraft('strikeouts', strikeouts)} />
              <NumberField label="Walks" value={pitchKount.walks} maximum={999} onChange={(walks) => updateDraft('walks', walks)} />
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void sendState(pitchKount, 'Pitcher card updated.')}
                  className="cc-btn cc-btn-primary w-full px-4 py-3 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send card'}
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="cc-card h-fit p-5 xl:sticky xl:top-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Display preview</div>
              <div className="mt-1 text-sm text-white/60">1:2 portrait · rotates every {PITCHKOUNT_SLIDE_DURATION_MS / 1000}s</div>
            </div>
            <span className="rounded bg-sky-500/15 px-2 py-1 text-xs font-bold text-sky-300">LIVE DATA</span>
          </div>
          <PitchKountPreview state={normalizePitchKountState(pitchKount)} />
        </aside>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  suffix,
  maximum,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  suffix?: string;
  maximum: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">{label}</div>
      <div className="my-2 flex items-baseline gap-2"><strong className="text-3xl tabular-nums">{value}</strong>{suffix && <span className="text-xs font-bold text-white/45">{suffix}</span>}</div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(Math.max(0, value - 1))} className="rounded bg-white/10 py-2 font-black hover:bg-white/15 disabled:opacity-30">−</button>
        <button type="button" disabled={disabled || value >= maximum} onClick={() => onChange(Math.min(maximum, value + 1))} className="rounded bg-white/10 py-2 font-black hover:bg-white/15 disabled:opacity-30">+</button>
      </div>
    </div>
  );
}

function TextField({ label, value, maxLength, placeholder, onChange }: { label: string; value: string; maxLength: number; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-semibold text-white/70">
      {label}
      <input value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg px-4 py-3" />
    </label>
  );
}

function NumberField({ label, value, maximum, step = '1', onChange }: { label: string; value: number; maximum: number; step?: string; onChange: (value: number) => void }) {
  return (
    <label className="text-sm font-semibold text-white/70">
      {label}
      <input type="number" min="0" max={maximum} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full rounded-lg px-3 py-3" />
    </label>
  );
}

function PitchKountPreview({ state }: { state: PitchKountState }) {
  const [slide, setSlide] = useState<'main' | 'stats'>('main');
  const pitchesRemaining = Math.max(0, PITCHKOUNT_DAILY_LIMIT - state.pitchCount);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSlide((current) => current === 'main' ? 'stats' : 'main');
    }, PITCHKOUNT_SLIDE_DURATION_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto aspect-[1/2] w-full max-w-[270px] overflow-hidden border border-sky-500/70 bg-[radial-gradient(circle_at_50%_34%,rgba(0,117,185,0.22),transparent_36%),linear-gradient(145deg,#07121e,#010409_42%,#020910)] font-sans text-white shadow-[inset_0_0_28px_rgba(0,139,218,0.28)]">
      <div className="flex h-[12%] flex-col items-center justify-center border-b border-sky-500/70 bg-black/55">
        <span className="text-[8px] font-black tracking-[0.22em] text-red-500">SCHOOL</span>
        <strong className="mt-1 max-w-[92%] truncate text-base font-black tracking-[0.08em]">{state.teamName}</strong>
      </div>
      {slide === 'main' ? (
        <div className="h-[88%]">
          <div className="flex h-[11%] items-center gap-3 border-b border-white/10 bg-sky-950/30 px-3">
            <span className="text-sm font-black text-red-500">#{state.pitcherNumber}</span>
            <strong className="min-w-0 truncate text-sm font-black">{state.pitcherName}</strong>
          </div>
          <div className={`grid px-[4%] pt-[4%] ${state.showPitchSpeed ? 'h-[44%]' : 'h-[66%]'} grid-cols-[43%_57%]`}>
            <div className="overflow-hidden border border-sky-500/70 bg-sky-950/30">
              {state.headshotUrl ? <img src={state.headshotUrl} alt="" className="h-full w-full object-cover object-top" /> : <div className="flex h-full flex-col items-center justify-center text-white/30"><span className="text-[8px] font-black">PLAYER</span><strong className="mt-2 text-3xl">#{state.pitcherNumber}</strong></div>}
            </div>
            <div className="flex flex-col items-center justify-center border-y border-r border-sky-500/70 bg-black/55">
              <span className="text-[10px] font-black tracking-widest text-red-500">PITCH COUNT</span>
              <strong className="text-6xl leading-none tracking-tighter">{state.pitchCount}</strong>
              <div className="mt-2 border-t border-white/20 pt-1 text-center"><span className="text-[8px] font-black text-sky-300">PITCHES LEFT</span> <strong className="text-lg">{pitchesRemaining}</strong><small className="ml-1 text-[7px] text-white/45">OF {PITCHKOUNT_DAILY_LIMIT}</small></div>
            </div>
          </div>
          <div className="mx-[4%] grid h-[13%] grid-cols-2 gap-2 py-[2%] text-center">
            <div className="flex items-center justify-center gap-2 border-y border-sky-500/60 bg-sky-950/20"><span className="text-[9px] font-black text-red-500">STRIKES</span><strong className="text-xl">{state.strikes}</strong></div>
            <div className="flex items-center justify-center gap-2 border-y border-sky-500/60 bg-sky-950/20"><span className="text-[9px] font-black text-red-500">BALLS</span><strong className="text-xl">{state.balls}</strong></div>
          </div>
          {state.showPitchSpeed && <div className="mx-[4%] flex h-[22%] flex-col items-center justify-center border border-sky-500/70 bg-black/55"><span className="text-[10px] font-black tracking-widest text-red-500">PITCH SPEED</span><div><strong className="text-4xl leading-none">{state.pitchSpeedMph}</strong><span className="ml-2 text-[9px] font-black">MPH</span></div></div>}
          <PreviewFooter slide="01" />
        </div>
      ) : (
        <div className="h-[88%]">
          <div className="grid h-[21%] grid-cols-[30%_70%] gap-3 border-b border-white/10 bg-sky-950/25 p-[4%]">
            <div className="overflow-hidden border border-sky-500/60 bg-black/40">{state.headshotUrl ? <img src={state.headshotUrl} alt="" className="h-full w-full object-cover object-top" /> : <div className="flex h-full items-center justify-center text-xl font-black text-white/30">#{state.pitcherNumber}</div>}</div>
            <div className="flex min-w-0 flex-col justify-center"><span className="text-[9px] font-black tracking-widest text-red-500">PLAYER STATS</span><strong className="mt-1 truncate text-sm">{state.pitcherName}</strong><small className="mt-1 text-[8px] font-black text-sky-300">#{state.pitcherNumber} · PITCHER</small></div>
          </div>
          <div className="grid h-[69%] grid-cols-2 grid-rows-3 gap-2 p-[4%]">
            <PreviewStat label="ERA" value={state.era.toFixed(2)} />
            <PreviewStat label="RECORD" value={`${state.wins}–${state.losses}`} />
            <PreviewStat label="INNINGS" value={state.inningsPitched} />
            <PreviewStat label="STRIKEOUTS" value={state.strikeouts} />
            <PreviewStat label="WALKS" value={state.walks} />
            <PreviewStat label="PITCH TYPE" value={state.pitchType} compact />
          </div>
          <PreviewFooter slide="02" />
        </div>
      )}
    </div>
  );
}

function PreviewStat({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return <div className="flex min-w-0 flex-col items-center justify-center overflow-hidden border border-sky-500/60 bg-black/55"><span className="text-[9px] font-black tracking-wider text-red-500">{label}</span><strong className={`mt-2 max-w-[92%] truncate ${compact ? 'text-sm' : 'text-2xl'}`}>{value}</strong></div>;
}

function PreviewFooter({ slide }: { slide: string }) {
  return <div className="flex h-[10%] items-center justify-between border-t border-sky-500/70 bg-gradient-to-r from-black via-sky-950 to-black px-[4%]"><strong className="text-base italic">PITCH<span className="text-sky-500">KOUNT</span></strong><span className="text-[8px] font-black text-white/40">{slide} / 02</span></div>;
}

function getPublicMediaUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
}
