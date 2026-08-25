'use client';

// Device list page with real data fetching

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSelectedDevices } from '../SelectedDevicesProvider';

interface Device {
  id: string;
  deviceId: string;
  name: string;
  status: string;
  mode: string;
  lastSeen: string | null;
  firmwareVersion: string | null;
  organization?: { name: string } | null;
  venue?: { name: string } | null;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renamingDeviceId, setRenamingDeviceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);
  const {
    selectedDeviceIds,
    isHydrated,
    isSelected,
    setDeviceSelected,
    clearSelection,
  } = useSelectedDevices();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDevices(data.devices || []);
    } catch (err) {
      setError('Failed to load devices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'paired':
        return 'cc-status px-2 py-1';
      case 'unpaired':
        return 'cc-status cc-status-warn px-2 py-1';
      default:
        return 'cc-status cc-status-muted px-2 py-1';
    }
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const beginRename = (device: Device) => {
    setRenamingDeviceId(device.deviceId);
    setRenameValue(device.name);
    setRenameError(null);
  };

  const cancelRename = () => {
    setRenamingDeviceId(null);
    setRenameValue('');
    setRenameError(null);
  };

  const saveRename = async (event: FormEvent<HTMLFormElement>, deviceId: string) => {
    event.preventDefault();
    setRenameSaving(true);
    setRenameError(null);

    try {
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Rename failed with HTTP ${response.status}`);
      }

      setDevices((current) => current.map((device) => (
        device.deviceId === deviceId ? { ...device, name: data.device.name } : device
      )));
      cancelRename();
    } catch (renameFailure) {
      setRenameError(renameFailure instanceof Error ? renameFailure.message : 'Failed to rename device');
    } finally {
      setRenameSaving(false);
    }
  };

  const selectedDeviceDetails = selectedDeviceIds.map((deviceId) => {
    const device = devices.find((item) => item.deviceId === deviceId);
    return {
      deviceId,
      name: device?.name || 'Unknown display',
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading devices...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
        <button 
          onClick={fetchDevices}
          className="mt-2 text-sm text-red-300 hover:text-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Devices</h1>
          <p className="mt-1 text-sm text-white/50">Connected CourtCast displays and controllers</p>
        </div>
        <Link
          href="/pair"
          className="cc-btn cc-btn-primary px-4 py-2 text-sm"
        >
          Pair New Device
        </Link>
      </div>

      {devices.length === 0 ? (
        <div className="cc-card p-8 text-center">
          <p className="text-gray-400 mb-4">No devices found</p>
          <Link
            href="/pair"
            className="text-green-500 hover:text-green-400"
          >
            Pair your first device
          </Link>
        </div>
      ) : (
        <>
        {isHydrated && selectedDeviceDetails.length > 0 && (
          <section className="mb-6 rounded-lg border border-blue-500/30 bg-blue-950/35 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-base font-bold text-blue-100">
                  {selectedDeviceDetails.length} display{selectedDeviceDetails.length === 1 ? '' : 's'} selected for sync
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDeviceDetails.map((device) => (
                    <span
                      key={device.deviceId}
                      className="rounded-full border border-blue-400/30 bg-blue-900/45 px-3 py-1 text-xs font-semibold text-blue-100"
                    >
                      {device.name}
                      <span className="ml-2 font-mono text-blue-200">{device.deviceId}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="cc-btn cc-btn-secondary w-fit px-3 py-2 text-sm"
              >
                Clear Selection
              </button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className={`cc-card p-6 ${isSelected(device.deviceId) ? 'ring-2 ring-blue-500/60' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0 pr-3">
                  <h3 className="break-words text-lg font-semibold">{device.name}</h3>
                  <p className="text-sm text-gray-400 font-mono">{device.deviceId}</p>
                </div>
                <span
                  className={`text-xs font-semibold ${getStatusColor(device.status)}`}
                >
                  <span className="cc-dot"></span>
                  {device.status}
                </span>
              </div>

              {renamingDeviceId === device.deviceId ? (
                <form onSubmit={(event) => void saveRename(event, device.deviceId)} className="mb-4 rounded-lg border border-blue-500/30 bg-blue-950/25 p-3">
                  <label htmlFor={`device-name-${device.deviceId}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-blue-200">
                    Device name
                  </label>
                  <input
                    id={`device-name-${device.deviceId}`}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    maxLength={64}
                    autoFocus
                    disabled={renameSaving}
                    className="w-full rounded border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-blue-400 disabled:opacity-60"
                  />
                  {renameError && <p className="mt-2 text-xs text-red-300">{renameError}</p>}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="submit"
                      disabled={renameSaving || !renameValue.trim()}
                      className="cc-btn cc-btn-primary flex-1 px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {renameSaving ? 'Saving...' : 'Save Name'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      disabled={renameSaving}
                      className="cc-btn cc-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => beginRename(device)}
                  className="cc-btn cc-btn-secondary mb-4 w-full px-3 py-2 text-sm"
                >
                  Rename Device
                </button>
              )}

              <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <input
                  type="checkbox"
                  checked={isSelected(device.deviceId)}
                  onChange={(event) => setDeviceSelected(device.deviceId, event.target.checked)}
                  className="h-5 w-5 accent-blue-600"
                />
                <span className="text-sm font-semibold text-gray-200">Select for sync</span>
              </label>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Mode</span>
                  <span>{device.mode || 'unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Seen</span>
                  <span>{formatLastSeen(device.lastSeen)}</span>
                </div>
                {device.firmwareVersion && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Firmware</span>
                    <span className="font-mono">{device.firmwareVersion}</span>
                  </div>
                )}
                {device.venue && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Venue</span>
                    <span>{device.venue.name}</span>
                  </div>
                )}
              </div>

              <Link
                href={`/devices/${device.deviceId}`}
                className="cc-btn cc-btn-primary mt-5 w-full px-4 py-2 text-sm"
              >
                Open Controls
              </Link>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
