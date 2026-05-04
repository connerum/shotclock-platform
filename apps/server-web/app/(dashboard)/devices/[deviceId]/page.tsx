// Device detail page

import Link from 'next/link';

interface DeviceDetailPageProps {
  params: { deviceId: string };
}

export default function DeviceDetailPage({ params }: DeviceDetailPageProps) {
  // In production, this would fetch from API using params.deviceId
  const device = {
    id: params.deviceId,
    name: 'Shotclock Display 1',
    status: 'online',
    mode: 'shot-clock',
    firmwareVersion: '0.1.0',
    controllerType: 'generic',
    lastSeen: new Date().toISOString(),
    displayProfile: {
      viewport: { width: 1920, height: 1080 },
    },
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/devices" className="text-gray-400 hover:text-white mb-4 inline-block">
          ← Back to Devices
        </Link>
        <h1 className="text-3xl font-bold">{device.name}</h1>
        <p className="text-gray-400 mt-1">Device ID: {device.id}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Connection Status */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Status</span>
              <span className={device.status === 'online' ? 'text-green-500' : 'text-red-500'}>
                {device.status === 'online' ? '● Online' : '○ Offline'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last Seen</span>
              <span>{new Date(device.lastSeen).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Firmware</span>
              <span>{device.firmwareVersion}</span>
            </div>
          </div>
        </div>

        {/* Mode Controls */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Mode Controls</h2>
          <div className="grid grid-cols-3 gap-2">
            {['setup', 'pairing', 'shot-clock', 'media', 'calibration', 'blank'].map((mode) => (
              <button
                key={mode}
                className={`px-3 py-2 rounded text-sm font-medium ${
                  device.mode === mode
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Timer Controls */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Timer Controls</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Shot Clock</span>
              <div className="flex items-center space-x-2">
                <button className="bg-gray-800 px-3 py-1 rounded">-</button>
                <span className="text-2xl font-mono w-16 text-center">24</span>
                <button className="bg-gray-800 px-3 py-1 rounded">+</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Game Clock</span>
              <div className="flex items-center space-x-2">
                <button className="bg-gray-800 px-3 py-1 rounded">-</button>
                <span className="text-2xl font-mono w-24 text-center">12:00</span>
                <button className="bg-gray-800 px-3 py-1 rounded">+</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Period</span>
              <div className="flex items-center space-x-2">
                <button className="bg-gray-800 px-3 py-1 rounded">-</button>
                <span className="text-xl">1</span>
                <button className="bg-gray-800 px-3 py-1 rounded">+</button>
              </div>
            </div>
            <div className="flex space-x-2 pt-4">
              <button className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded font-medium">
                Start
              </button>
              <button className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-2 rounded font-medium">
                Pause
              </button>
              <button className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded font-medium">
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Score Controls */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Score</h2>
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <p className="text-gray-400 mb-2">Home</p>
              <div className="flex items-center justify-center space-x-2">
                <button className="bg-gray-800 px-3 py-1 rounded text-lg">-</button>
                <span className="text-5xl font-mono">0</span>
                <button className="bg-gray-800 px-3 py-1 rounded text-lg">+</button>
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-400 mb-2">Away</p>
              <div className="flex items-center justify-center space-x-2">
                <button className="bg-gray-800 px-3 py-1 rounded text-lg">-</button>
                <span className="text-5xl font-mono">0</span>
                <button className="bg-gray-800 px-3 py-1 rounded text-lg">+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Calibration Panel */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Display Calibration</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Offset X</label>
                <input
                  type="number"
                  defaultValue="0"
                  className="w-full bg-gray-800 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Offset Y</label>
                <input
                  type="number"
                  defaultValue="0"
                  className="w-full bg-gray-800 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Scale X</label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue="1"
                  className="w-full bg-gray-800 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Scale Y</label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue="1"
                  className="w-full bg-gray-800 rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded font-medium">
                Apply Calibration
              </button>
              <button className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded font-medium">
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Update Controls */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Firmware Updates</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Current Version</span>
              <span>{device.firmwareVersion}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Latest Version</span>
              <span className="text-green-500">0.1.0 (current)</span>
            </div>
            <button className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-medium">
              Check for Updates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
