'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DeviceMode, TimerState, DisplayProfile } from '@shotclock/shared/types';

interface Device {
  id: string;
  deviceId: string;
  name: string;
  status: string;
  mode: string;
  lastSeen: string | null;
  firmwareVersion: string | null;
  controllerType: string;
  isOnline: boolean;
  organization?: { name: string } | null;
  venue?: { name: string } | null;
  displayProfile?: DisplayProfile | null;
  calibrationData?: { x: number; y: number; scaleX: number; scaleY: number } | null;
}

const DEVICE_MODES = ['setup', 'pairing', 'offline', 'shot-clock', 'media', 'calibration', 'blank'];

export default function DeviceDetailPage({ params }: { params: { deviceId: string } }) {
  const deviceId = params.deviceId;
  
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Timer state
  const [shotClock, setShotClock] = useState(24);
  const [gameClock, setGameClock] = useState(720);
  const [period, setPeriod] = useState(1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  
  // Calibration state
  const [calibration, setCalibration] = useState({
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    scaleX: 1.0,
    scaleY: 1.0,
  });
  
  // Update status
  const [updateStatus, setUpdateStatus] = useState<string>('idle');

  useEffect(() => {
    fetchDevice();
  }, [deviceId]);

  const fetchDevice = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}`);
      if (!res.ok) throw new Error('Device not found');
      const data = await res.json();
      setDevice(data.device);
      
      // Initialize calibration from device
      if (data.device.calibrationData) {
        setCalibration({
          x: data.device.calibrationData.x || 0,
          y: data.device.calibrationData.y || 0,
          width: data.device.displayProfile?.viewport?.width || 1920,
          height: data.device.displayProfile?.viewport?.height || 1080,
          scaleX: data.device.calibrationData.scaleX || 1.0,
          scaleY: data.device.calibrationData.scaleY || 1.0,
        });
      }
    } catch (err) {
      setError('Failed to load device');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async (type: string, payload?: any) => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      });
      return res.ok;
    } catch (err) {
      console.error('Command failed:', err);
      return false;
    }
  };

  const setMode = async (mode: string) => {
    setSaving(true);
    const modePayload: DeviceMode = { type: mode as any };
    await sendCommand('set_mode', { mode: modePayload });
    setDevice(prev => prev ? { ...prev, mode } : null);
    setSaving(false);
  };

  const startTimer = async () => {
    const timerState: TimerState = {
      mode: 'run',
      homeScore,
      awayScore,
      period,
      shotClock,
      gameClock,
      isRunning: true,
      isPaused: false,
      lastUpdated: Date.now(),
    };
    await sendCommand('set_timer', { timerState });
    setTimerRunning(true);
  };

  const pauseTimer = async () => {
    const timerState: TimerState = {
      mode: 'pause',
      homeScore,
      awayScore,
      period,
      shotClock,
      gameClock,
      isRunning: false,
      isPaused: true,
      lastUpdated: Date.now(),
    };
    await sendCommand('set_timer', { timerState });
    setTimerRunning(false);
  };

  const resetTimer = async () => {
    const timerState: TimerState = {
      mode: 'stop',
      homeScore: 0,
      awayScore: 0,
      period: 1,
      shotClock: 24,
      gameClock: 720,
      isRunning: false,
      isPaused: false,
      lastUpdated: Date.now(),
    };
    await sendCommand('set_timer', { timerState });
    setShotClock(24);
    setGameClock(720);
    setPeriod(1);
    setHomeScore(0);
    setAwayScore(0);
    setTimerRunning(false);
  };

  const saveCalibration = async () => {
    setSaving(true);
    try {
      const displayProfile: DisplayProfile = {
        id: device?.displayProfile?.id || 'default',
        name: device?.displayProfile?.name || 'Default',
        controllerType: device?.controllerType as any || 'generic',
        viewport: {
          x: calibration.x,
          y: calibration.y,
          width: calibration.width,
          height: calibration.height,
          rotation: 0,
          scaleX: calibration.scaleX,
          scaleY: calibration.scaleY,
        },
        safeZone: device?.displayProfile?.safeZone || { top: 40, right: 40, bottom: 40, left: 40 },
        fontSize: device?.displayProfile?.fontSize || { shotClock: 200, gameClock: 120, score: 150, period: 80, label: 40 },
        colors: device?.displayProfile?.colors || { background: '#000000', foreground: '#ffffff', accent: '#00ff00', homeTeam: '#ff0000', awayTeam: '#0000ff', warning: '#ffff00', danger: '#ff0000' },
      };

      const res = await fetch(`/api/devices/${deviceId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayProfile,
          calibrationData: { x: calibration.x, y: calibration.y, scaleX: calibration.scaleX, scaleY: calibration.scaleY },
        }),
      });
      
      if (res.ok) {
        setDevice(prev => prev ? { ...prev, displayProfile, calibrationData: { x: calibration.x, y: calibration.y, scaleX: calibration.scaleX, scaleY: calibration.scaleY } } : null);
      }
    } finally {
      setSaving(false);
    }
  };

  const resetCalibration = () => {
    setCalibration({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      scaleX: 1.0,
      scaleY: 1.0,
    });
  };

  const showTestPattern = async () => {
    await setMode('calibration');
  };

  const checkForUpdates = async () => {
    setUpdateStatus('checking');
    const success = await sendCommand('check_update');
    if (success) {
      setTimeout(() => setUpdateStatus('idle'), 3000);
    } else {
      setUpdateStatus('error');
    }
  };

  const installUpdate = async (version: string) => {
    setUpdateStatus('installing');
    await sendCommand('install_update', { version });
  };

  // Suppress unused warning
  void installUpdate;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading device...</div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div>
        <Link href="/devices" className="text-gray-400 hover:text-white mb-4 inline-block">
          ← Back to Devices
        </Link>
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <p className="text-red-400">{error || 'Device not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/devices" className="text-gray-400 hover:text-white mb-4 inline-block">
          ← Back to Devices
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{device.name}</h1>
            <p className="text-gray-400 mt-1 font-mono text-sm">{device.deviceId}</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              device.isOnline ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
            }`}>
              {device.isOnline ? '● Online' : '○ Offline'}
            </span>
            <span className="text-gray-400 text-sm">
              Last seen: {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mode Controls */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Mode Controls</h2>
          <div className="grid grid-cols-4 gap-2">
            {DEVICE_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setMode(mode)}
                disabled={saving}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  device.mode === mode
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <span className="text-gray-400 text-sm">Current Mode: </span>
            <span className="font-medium text-green-400">{device.mode || 'unknown'}</span>
          </div>
        </div>

        {/* Connection Info */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Connection Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">IP Address</span>
              <span className="font-mono">192.168.1.100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Software Version</span>
              <span className="font-mono">{device.firmwareVersion || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Controller Type</span>
              <span>{device.controllerType || 'generic'}</span>
            </div>
          </div>
        </div>

        {/* Timer Controls */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Timer Controls</h2>
          
          {/* Shot Clock */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Shot Clock (seconds)</label>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setShotClock(Math.max(0, shotClock - 1))}
                className="bg-gray-800 px-3 py-1 rounded hover:bg-gray-700"
              >
                -
              </button>
              <span className="text-3xl font-mono w-16 text-center">{shotClock}</span>
              <button 
                onClick={() => setShotClock(Math.min(99, shotClock + 1))}
                className="bg-gray-800 px-3 py-1 rounded hover:bg-gray-700"
              >
                +
              </button>
              <input
                type="number"
                value={shotClock}
                onChange={(e) => setShotClock(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                className="w-20 bg-gray-800 rounded px-2 py-1 text-center font-mono"
              />
            </div>
          </div>

          {/* Game Clock */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Game Clock (seconds)</label>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setGameClock(Math.max(0, gameClock - 30))}
                className="bg-gray-800 px-3 py-1 rounded hover:bg-gray-700"
              >
                -30
              </button>
              <span className="text-3xl font-mono w-24 text-center">
                {Math.floor(gameClock / 60)}:{String(gameClock % 60).padStart(2, '0')}
              </span>
              <button 
                onClick={() => setGameClock(Math.min(3600, gameClock + 30))}
                className="bg-gray-800 px-3 py-1 rounded hover:bg-gray-700"
              >
                +30
              </button>
            </div>
          </div>

          {/* Period */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Period</label>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setPeriod(Math.max(1, period - 1))}
                className="bg-gray-800 px-3 py-1 rounded hover:bg-gray-700"
              >
                -
              </button>
              <span className="text-2xl w-12 text-center">{period}</span>
              <button 
                onClick={() => setPeriod(Math.min(10, period + 1))}
                className="bg-gray-800 px-3 py-1 rounded hover:bg-gray-700"
              >
                +
              </button>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex space-x-2 pt-2">
            {!timerRunning ? (
              <button 
                onClick={startTimer}
                className="flex-1 bg-green-600 hover:bg-green-700 py-3 rounded font-medium"
              >
                Start
              </button>
            ) : (
              <button 
                onClick={pauseTimer}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-3 rounded font-medium"
              >
                Pause
              </button>
            )}
            <button 
              onClick={resetTimer}
              className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded font-medium"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Score Controls */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Score</h2>
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <p className="text-gray-400 mb-3">Home</p>
              <div className="flex items-center justify-center space-x-3">
                <button 
                  onClick={() => setHomeScore(Math.max(0, homeScore - 1))}
                  className="bg-gray-800 px-4 py-2 rounded text-xl hover:bg-gray-700"
                >
                  -
                </button>
                <span className="text-5xl font-mono w-20 text-center">{homeScore}</span>
                <button 
                  onClick={() => setHomeScore(homeScore + 1)}
                  className="bg-gray-800 px-4 py-2 rounded text-xl hover:bg-gray-700"
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-400 mb-3">Away</p>
              <div className="flex items-center justify-center space-x-3">
                <button 
                  onClick={() => setAwayScore(Math.max(0, awayScore - 1))}
                  className="bg-gray-800 px-4 py-2 rounded text-xl hover:bg-gray-700"
                >
                  -
                </button>
                <span className="text-5xl font-mono w-20 text-center">{awayScore}</span>
                <button 
                  onClick={() => setAwayScore(awayScore + 1)}
                  className="bg-gray-800 px-4 py-2 rounded text-xl hover:bg-gray-700"
                >
                  +
                </button>
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
                <label className="block text-sm text-gray-400 mb-1">X Offset</label>
                <input
                  type="range"
                  min="0"
                  max="1920"
                  value={calibration.x}
                  onChange={(e) => setCalibration({ ...calibration, x: parseInt(e.target.value) })}
                  className="w-full"
                />
                <input
                  type="number"
                  value={calibration.x}
                  onChange={(e) => setCalibration({ ...calibration, x: parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-800 rounded px-2 py-1 mt-1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Y Offset</label>
                <input
                  type="range"
                  min="0"
                  max="1080"
                  value={calibration.y}
                  onChange={(e) => setCalibration({ ...calibration, y: parseInt(e.target.value) })}
                  className="w-full"
                />
                <input
                  type="number"
                  value={calibration.y}
                  onChange={(e) => setCalibration({ ...calibration, y: parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-800 rounded px-2 py-1 mt-1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Width</label>
                <input
                  type="range"
                  min="100"
                  max="1920"
                  value={calibration.width}
                  onChange={(e) => setCalibration({ ...calibration, width: parseInt(e.target.value) })}
                  className="w-full"
                />
                <input
                  type="number"
                  value={calibration.width}
                  onChange={(e) => setCalibration({ ...calibration, width: parseInt(e.target.value) || 100 })}
                  className="w-full bg-gray-800 rounded px-2 py-1 mt-1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Height</label>
                <input
                  type="range"
                  min="100"
                  max="1080"
                  value={calibration.height}
                  onChange={(e) => setCalibration({ ...calibration, height: parseInt(e.target.value) })}
                  className="w-full"
                />
                <input
                  type="number"
                  value={calibration.height}
                  onChange={(e) => setCalibration({ ...calibration, height: parseInt(e.target.value) || 100 })}
                  className="w-full bg-gray-800 rounded px-2 py-1 mt-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Scale</label>
              <input
                type="range"
                min="50"
                max="300"
                value={calibration.scaleX * 100}
                onChange={(e) => setCalibration({ ...calibration, scaleX: parseInt(e.target.value) / 100, scaleY: parseInt(e.target.value) / 100 })}
                className="w-full"
              />
              <input
                type="number"
                step="0.01"
                value={calibration.scaleX}
                onChange={(e) => setCalibration({ ...calibration, scaleX: parseFloat(e.target.value) || 1, scaleY: parseFloat(e.target.value) || 1 })}
                className="w-full bg-gray-800 rounded px-2 py-1 mt-1"
              />
            </div>
            <div className="flex space-x-2 pt-2">
              <button 
                onClick={showTestPattern}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded font-medium"
              >
                Show Test Pattern
              </button>
              <button 
                onClick={resetCalibration}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded font-medium"
              >
                Reset
              </button>
            </div>
            <button 
              onClick={saveCalibration}
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Calibration'}
            </button>
          </div>
        </div>

        {/* Update Controls */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Firmware Updates</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Current Version</span>
              <span className="font-mono">{device.firmwareVersion || 'Unknown'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Update Status</span>
              <span className={`px-2 py-1 rounded text-xs ${
                updateStatus === 'idle' ? 'bg-gray-700' :
                updateStatus === 'checking' ? 'bg-blue-900 text-blue-400' :
                updateStatus === 'installing' ? 'bg-yellow-900 text-yellow-400' :
                updateStatus === 'error' ? 'bg-red-900 text-red-400' :
                'bg-gray-700'
              }`}>
                {updateStatus}
              </span>
            </div>
            <button 
              onClick={checkForUpdates}
              disabled={updateStatus === 'checking' || updateStatus === 'installing'}
              className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-medium disabled:opacity-50"
            >
              Check for Updates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
