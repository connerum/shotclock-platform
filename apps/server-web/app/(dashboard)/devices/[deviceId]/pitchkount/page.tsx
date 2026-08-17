'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_PITCHKOUNT_STATE,
  PITCHKOUNT_PITCH_TYPES,
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

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
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
              <div className="mt-1 text-sm text-white/60">1:2 portrait · 128 × 256</div>
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
  return (
    <div className="mx-auto aspect-[1/2] w-full max-w-[270px] overflow-hidden border border-sky-500/70 bg-[#02070c] p-[4%] font-sans text-white shadow-[inset_0_0_28px_rgba(0,139,218,0.28)]">
      <div className="flex h-[10%] items-center justify-between border-b border-sky-500/40">
        <span className="max-w-[36%] truncate text-[8px] font-black tracking-[0.14em] text-sky-200">{state.teamName}</span>
        <strong className="text-sm italic tracking-tight">PITCH<span className="text-sky-500">KOUNT</span></strong>
      </div>
      <div className="flex h-[11%] items-center gap-2 border-b border-white/10">
        <span className="text-base font-black text-red-500">#{state.pitcherNumber}</span>
        <div className="min-w-0 border-l border-sky-500/70 pl-2"><span className="block text-[7px] font-black tracking-widest text-red-400">ON THE MOUND</span><strong className="block truncate text-xs">{state.pitcherName}</strong></div>
      </div>
      <div className="my-[4%] flex h-[30%] flex-col items-center justify-center border border-sky-500/70 bg-[radial-gradient(circle,rgba(0,117,185,0.2),rgba(0,0,0,0.8))]">
        <span className="text-[9px] font-black tracking-[0.18em] text-red-500">PITCH COUNT</span>
        <strong className="text-7xl leading-none tracking-tighter">{state.pitchCount}</strong>
      </div>
      <div className="grid h-[17%] grid-cols-2 gap-2">
        <PreviewCard label="PITCH SPEED"><strong className="text-2xl leading-none">{state.pitchSpeedMph}</strong><span className="ml-1 text-[7px] font-bold">MPH</span></PreviewCard>
        <PreviewCard label="PITCH TYPE"><strong className="mt-2 block truncate text-xs">{state.pitchType}</strong></PreviewCard>
      </div>
      <div className="mt-[4%] grid h-[9%] grid-cols-2 items-center border-y border-sky-500/50 text-center">
        <div><span className="text-[7px] font-black text-red-400">STRIKES</span> <strong>{state.strikes}</strong></div>
        <div className="border-l border-white/20"><span className="text-[7px] font-black text-red-400">BALLS</span> <strong>{state.balls}</strong></div>
      </div>
      <div className="grid h-[15%] grid-cols-5 items-stretch pt-[4%] text-center">
        {[
          ['ERA', state.era.toFixed(2)],
          ['W–L', `${state.wins}–${state.losses}`],
          ['IP', state.inningsPitched],
          ['K', state.strikeouts],
          ['BB', state.walks],
        ].map(([label, value]) => <div key={label} className="flex min-w-0 flex-col justify-center border-l border-sky-500/30 last:border-r"><span className="text-[7px] font-black text-red-400">{label}</span><strong className="mt-1 truncate text-[10px]">{value}</strong></div>)}
      </div>
    </div>
  );
}

function PreviewCard({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0 overflow-hidden border border-sky-500/60 bg-black/60 p-2 text-center"><span className="block text-[7px] font-black tracking-wider text-red-400">{label}</span>{children}</div>;
}
