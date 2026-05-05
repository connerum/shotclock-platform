'use client';

// Device list page with real data fetching

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <Link
              key={device.id}
              href={`/devices/${device.deviceId}`}
              className="cc-card cc-card-hover p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{device.name}</h3>
                  <p className="text-sm text-gray-400 font-mono">{device.deviceId}</p>
                </div>
                <span
                  className={`text-xs font-semibold ${getStatusColor(device.status)}`}
                >
                  <span className="cc-dot"></span>
                  {device.status}
                </span>
              </div>
              
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
