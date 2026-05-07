'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DeviceMode, SportType } from '@shotclock/shared/types';

interface Device {
  deviceId: string;
  name: string;
  status: string;
  isOnline: boolean;
  lastSeen: string | null;
}

const SPORTS: Array<{
  id: SportType | 'settings';
  title: string;
  description: string;
  href: string;
  imageSrc: string;
  mode?: SportType;
}> = [
  {
    id: 'basketball',
    title: 'Basketball',
    description: 'Shot clock, game clock, period, and score controls.',
    href: 'basketball',
    imageSrc: '/images/sports/basketball.svg',
  },
  {
    id: 'wrestling',
    title: 'Wrestling',
    description: 'Match clock, period, and wrestler score controls.',
    href: 'wrestling',
    imageSrc: '/images/sports/wrestling.svg',
  },
  {
    id: 'volleyball',
    title: 'Volleyball',
    description: 'Set, match, and team score controls.',
    href: 'volleyball',
    imageSrc: '/images/sports/volleyball.svg',
  },
  {
    id: 'settings',
    title: 'Device Details/Settings',
    description: 'Mode, connection, calibration, firmware, and factory reset.',
    href: 'settings',
    imageSrc: '/images/sports/settings.svg',
  },
];

export default function DeviceSportPage({ params }: { params: { deviceId: string } }) {
  const { deviceId } = params;
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [selectingSport, setSelectingSport] = useState<SportType | null>(null);

  useEffect(() => {
    const fetchDevice = async () => {
      try {
        const response = await fetch(`/api/devices/${deviceId}`);
        if (!response.ok) throw new Error('Device not found');
        const data = await response.json();
        setDevice(data.device);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load device');
      } finally {
        setLoading(false);
      }
    };

    void fetchDevice();
  }, [deviceId]);

  const openSport = async (sport: SportType | 'settings', href: string, mode?: SportType) => {
    setSelectingSport(sport === 'settings' ? null : sport);
    setCommandError(null);

    if (!mode) {
      router.push(`/devices/${deviceId}/${href}`);
      return;
    }

    const modePayload: DeviceMode = { type: mode };

    try {
      const response = await fetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'set_mode', payload: { mode: modePayload } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Unable to switch display to ${mode}`);
      }
      router.push(`/devices/${deviceId}/${href}`);
    } catch (err) {
      setCommandError(err instanceof Error ? err.message : 'Unable to switch display mode');
      setSelectingSport(null);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading device...</div>;
  }

  if (error || !device) {
    return (
      <div>
        <Link href="/devices" className="mb-4 inline-block text-gray-400 hover:text-white">
          ← Back to Devices
        </Link>
        <div className="rounded-lg border border-red-700 bg-red-900/50 p-4 text-red-300">
          {error || 'Device not found'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/devices" className="mb-4 inline-block text-gray-400 hover:text-white">
          ← Back to Devices
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{device.name}</h1>
            <p className="mt-1 font-mono text-sm text-gray-400">{device.deviceId}</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${
            device.isOnline ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {device.isOnline ? '● Online' : '○ Offline'}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold">Choose Sport</h2>
        <p className="mt-1 text-sm text-white/50">Selecting a sport switches the connected display to that layout.</p>
      </div>

      {commandError && (
        <div className="mb-4 rounded border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
          {commandError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SPORTS.map((sport) => (
          <button
            key={sport.id}
            type="button"
            disabled={selectingSport !== null}
            onClick={() => openSport(sport.id, sport.href, sport.id === 'settings' ? undefined : sport.id)}
            className="group cc-card cc-card-hover min-h-48 overflow-hidden p-0 text-left disabled:cursor-wait disabled:opacity-70"
          >
            <div className="relative h-32 overflow-hidden border-b border-white/10 bg-black/30">
              <img
                src={sport.imageSrc}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            </div>
            <div className="p-6">
              <h3 className="text-2xl font-bold">{sport.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">{sport.description}</p>
              <div className="mt-6 text-sm font-semibold text-green-400">
                {selectingSport === sport.id ? 'Opening...' : sport.id === 'settings' ? 'Open settings' : 'Open controls'}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
