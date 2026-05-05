'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { DeviceMode, TimerState, DisplayProfile, CalibrationData } from '@shotclock/shared/types';

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
  calibrationData?: Partial<CalibrationData> | null;
}

const DEVICE_MODES = ['setup', 'pairing', 'offline', 'shot-clock', 'media', 'calibration', 'blank'];
const CALIBRATION_CANVAS_WIDTH = 1920;
const CALIBRATION_CANVAS_HEIGHT = 1080;
const MIN_CALIBRATION_SIZE = 24;

type CalibrationBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
};

type CalibrationInteraction =
  | { type: 'draw'; startX: number; startY: number }
  | { type: 'move'; startX: number; startY: number; startBox: CalibrationBox }
  | { type: 'resize'; handle: string; startX: number; startY: number; startBox: CalibrationBox };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampCalibrationBox(box: CalibrationBox): CalibrationBox {
  const width = clamp(Math.round(box.width), MIN_CALIBRATION_SIZE, CALIBRATION_CANVAS_WIDTH);
  const height = clamp(Math.round(box.height), MIN_CALIBRATION_SIZE, CALIBRATION_CANVAS_HEIGHT);
  const x = clamp(Math.round(box.x), 0, CALIBRATION_CANVAS_WIDTH - width);
  const y = clamp(Math.round(box.y), 0, CALIBRATION_CANVAS_HEIGHT - height);

  return {
    x,
    y,
    width,
    height,
    scaleX: 1,
    scaleY: 1,
  };
}

export default function DeviceDetailPage({ params }: { params: { deviceId: string } }) {
  const deviceId = params.deviceId;
  
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [factoryResetting, setFactoryResetting] = useState(false);
  
  // Timer state
  const [shotClock, setShotClock] = useState(24);
  const [gameClock, setGameClock] = useState(720);
  const [period, setPeriod] = useState(1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  
  // Calibration state
  const calibrationStageRef = useRef<HTMLDivElement | null>(null);
  const calibrationInteractionRef = useRef<CalibrationInteraction | null>(null);
  const calibrationPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCalibrationPreviewRef = useRef<CalibrationBox | null>(null);
  const lastCalibrationPreviewSentRef = useRef(0);
  const [calibration, setCalibration] = useState({
    x: 0,
    y: 0,
    width: CALIBRATION_CANVAS_WIDTH,
    height: CALIBRATION_CANVAS_HEIGHT,
    scaleX: 1,
    scaleY: 1,
  });
  const [savedCalibration, setSavedCalibration] = useState<CalibrationBox>(calibration);
  
  // Update status
  const [updateStatus, setUpdateStatus] = useState<string>('idle');

  useEffect(() => {
    fetchDevice();
  }, [deviceId]);

  useEffect(() => {
    return () => {
      if (calibrationPreviewTimeoutRef.current) {
        clearTimeout(calibrationPreviewTimeoutRef.current);
      }
    };
  }, []);

  const fetchDevice = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}`);
      if (!res.ok) throw new Error('Device not found');
      const data = await res.json();
      setDevice(data.device);
      
      // Initialize calibration from device
      const viewport = data.device.displayProfile?.viewport;
      const calibrationData = data.device.calibrationData || {};
      const nextCalibration = clampCalibrationBox({
        x: calibrationData.x ?? viewport?.x ?? 0,
        y: calibrationData.y ?? viewport?.y ?? 0,
        width: calibrationData.width ?? viewport?.width ?? CALIBRATION_CANVAS_WIDTH,
        height: calibrationData.height ?? viewport?.height ?? CALIBRATION_CANVAS_HEIGHT,
        scaleX: calibrationData.scaleX ?? viewport?.scaleX ?? 1,
        scaleY: calibrationData.scaleY ?? viewport?.scaleY ?? 1,
      });
      setCalibration(nextCalibration);
      setSavedCalibration(nextCalibration);
    } catch (err) {
      setError('Failed to load device');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async (type: string, payload?: any) => {
    setCommandError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.error || `Command failed with HTTP ${res.status}`;
        setCommandError(message);
        console.error('Command failed:', message);
        return false;
      }
      return res.ok;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Command failed';
      setCommandError(message);
      console.error('Command failed:', err);
      return false;
    }
  };

  const setMode = async (mode: string) => {
    setSaving(true);
    const modePayload: DeviceMode = { type: mode as any };
    const success = await sendCommand('set_mode', { mode: modePayload });
    if (success) {
      setDevice(prev => prev ? { ...prev, mode } : null);
    }
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
    const success = await sendCommand('set_timer', { timerState });
    if (success) setTimerRunning(true);
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
    const success = await sendCommand('set_timer', { timerState });
    if (success) setTimerRunning(false);
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
    const success = await sendCommand('set_timer', { timerState });
    if (success) {
      setShotClock(24);
      setGameClock(720);
      setPeriod(1);
      setHomeScore(0);
      setAwayScore(0);
      setTimerRunning(false);
    }
  };

  const calibrationBoxStyle = useMemo(() => ({
    left: `${(calibration.x / CALIBRATION_CANVAS_WIDTH) * 100}%`,
    top: `${(calibration.y / CALIBRATION_CANVAS_HEIGHT) * 100}%`,
    width: `${(calibration.width / CALIBRATION_CANVAS_WIDTH) * 100}%`,
    height: `${(calibration.height / CALIBRATION_CANVAS_HEIGHT) * 100}%`,
  }), [calibration]);

  const calibrationChanged =
    calibration.x !== savedCalibration.x ||
    calibration.y !== savedCalibration.y ||
    calibration.width !== savedCalibration.width ||
    calibration.height !== savedCalibration.height;

  const buildCalibrationConfig = (box: CalibrationBox, preview = false) => {
    const viewport = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    const displayProfile: DisplayProfile = {
      id: device?.displayProfile?.id || 'default',
      name: device?.displayProfile?.name || 'Default',
      controllerType: device?.controllerType as any || 'generic',
      viewport,
      safeZone: device?.displayProfile?.safeZone || { top: 40, right: 40, bottom: 40, left: 40 },
      fontSize: device?.displayProfile?.fontSize || { shotClock: 200, gameClock: 120, score: 150, period: 80, label: 40 },
      colors: device?.displayProfile?.colors || { background: '#000000', foreground: '#ffffff', accent: '#00ff00', homeTeam: '#ff0000', awayTeam: '#0000ff', warning: '#ffff00', danger: '#ff0000' },
    };
    const calibrationData: CalibrationData = {
      ...viewport,
      timestamp: Date.now(),
    };

    return {
      displayProfile,
      calibrationData,
      ...(preview && { preview: true }),
    };
  };

  const flushCalibrationPreview = () => {
    const box = latestCalibrationPreviewRef.current;
    if (!box) return;

    if (calibrationPreviewTimeoutRef.current) {
      clearTimeout(calibrationPreviewTimeoutRef.current);
      calibrationPreviewTimeoutRef.current = null;
    }

    latestCalibrationPreviewRef.current = null;
    lastCalibrationPreviewSentRef.current = Date.now();
    void sendCommand('update_config', buildCalibrationConfig(box, true));
  };

  const queueCalibrationPreview = (box: CalibrationBox) => {
    latestCalibrationPreviewRef.current = box;

    const elapsed = Date.now() - lastCalibrationPreviewSentRef.current;
    if (elapsed >= 100) {
      flushCalibrationPreview();
      return;
    }

    if (!calibrationPreviewTimeoutRef.current) {
      calibrationPreviewTimeoutRef.current = setTimeout(flushCalibrationPreview, 100 - elapsed);
    }
  };

  const setCalibrationWithPreview = (box: CalibrationBox) => {
    const nextBox = clampCalibrationBox(box);
    setCalibration(nextBox);
    queueCalibrationPreview(nextBox);
  };

  const getCalibrationPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = calibrationStageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * CALIBRATION_CANVAS_WIDTH, 0, CALIBRATION_CANVAS_WIDTH),
      y: clamp(((event.clientY - rect.top) / rect.height) * CALIBRATION_CANVAS_HEIGHT, 0, CALIBRATION_CANVAS_HEIGHT),
    };
  };

  const startDrawCalibrationBox = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = getCalibrationPoint(event);
    calibrationInteractionRef.current = { type: 'draw', startX: point.x, startY: point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setCalibrationWithPreview({
      x: point.x,
      y: point.y,
      width: MIN_CALIBRATION_SIZE,
      height: MIN_CALIBRATION_SIZE,
      scaleX: 1,
      scaleY: 1,
    });
  };

  const startMoveCalibrationBox = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const point = getCalibrationPoint(event);
    calibrationInteractionRef.current = {
      type: 'move',
      startX: point.x,
      startY: point.y,
      startBox: calibration,
    };
    calibrationStageRef.current?.setPointerCapture(event.pointerId);
  };

  const startResizeCalibrationBox = (event: ReactPointerEvent<HTMLDivElement>, handle: string) => {
    event.stopPropagation();
    const point = getCalibrationPoint(event);
    calibrationInteractionRef.current = {
      type: 'resize',
      handle,
      startX: point.x,
      startY: point.y,
      startBox: calibration,
    };
    calibrationStageRef.current?.setPointerCapture(event.pointerId);
  };

  const updateCalibrationInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = calibrationInteractionRef.current;
    if (!interaction) return;

    const point = getCalibrationPoint(event);

    if (interaction.type === 'draw') {
      const x = Math.min(interaction.startX, point.x);
      const y = Math.min(interaction.startY, point.y);
      setCalibrationWithPreview({
        x,
        y,
        width: Math.abs(point.x - interaction.startX),
        height: Math.abs(point.y - interaction.startY),
        scaleX: 1,
        scaleY: 1,
      });
      return;
    }

    if (interaction.type === 'move') {
      setCalibrationWithPreview({
        ...interaction.startBox,
        x: interaction.startBox.x + point.x - interaction.startX,
        y: interaction.startBox.y + point.y - interaction.startY,
      });
      return;
    }

    const nextBox = { ...interaction.startBox };
    const deltaX = point.x - interaction.startX;
    const deltaY = point.y - interaction.startY;

    if (interaction.handle.includes('w')) {
      nextBox.x = interaction.startBox.x + deltaX;
      nextBox.width = interaction.startBox.width - deltaX;
    }
    if (interaction.handle.includes('e')) {
      nextBox.width = interaction.startBox.width + deltaX;
    }
    if (interaction.handle.includes('n')) {
      nextBox.y = interaction.startBox.y + deltaY;
      nextBox.height = interaction.startBox.height - deltaY;
    }
    if (interaction.handle.includes('s')) {
      nextBox.height = interaction.startBox.height + deltaY;
    }

    setCalibrationWithPreview(nextBox);
  };

  const endCalibrationInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    calibrationInteractionRef.current = null;
    flushCalibrationPreview();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const saveCalibration = async () => {
    setSaving(true);
    try {
      const { displayProfile, calibrationData } = buildCalibrationConfig(calibration);

      const res = await fetch(`/api/devices/${deviceId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayProfile,
          calibrationData,
        }),
      });
      
      if (res.ok) {
        setSavedCalibration(calibration);
        setDevice(prev => prev ? { ...prev, displayProfile, calibrationData } : null);
      }
    } finally {
      setSaving(false);
    }
  };

  const resetCalibration = () => {
    setCalibrationWithPreview({
      x: 0,
      y: 0,
      width: CALIBRATION_CANVAS_WIDTH,
      height: CALIBRATION_CANVAS_HEIGHT,
      scaleX: 1,
      scaleY: 1,
    });
  };

  const showTestPattern = async () => {
    await setMode('calibration');
    queueCalibrationPreview(calibration);
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

  const factoryReset = async () => {
    const confirmed = window.confirm(
      'Factory reset this display? This clears pairing, saved WiFi, calibration, timer state, and reboots the Pi.'
    );
    if (!confirmed) return;

    setFactoryResetting(true);
    const success = await sendCommand('factory_reset');
    if (success) {
      setDevice(prev => prev ? { ...prev, mode: 'setup', status: 'offline', isOnline: false } : null);
    }
    setFactoryResetting(false);
  };

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
        {commandError && (
          <div className="mb-4 rounded border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
            {commandError}
          </div>
        )}
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
            <div
              ref={calibrationStageRef}
              onPointerDown={startDrawCalibrationBox}
              onPointerMove={updateCalibrationInteraction}
              onPointerUp={endCalibrationInteraction}
              onPointerCancel={endCalibrationInteraction}
              className="relative aspect-video w-full overflow-hidden rounded border border-gray-700 bg-black touch-none select-none cursor-crosshair"
            >
              <div className="absolute inset-0 opacity-35">
                {[...Array(11)].map((_, index) => (
                  <div
                    key={`v-${index}`}
                    className="absolute top-0 h-full border-l border-gray-600"
                    style={{ left: `${index * 10}%` }}
                  />
                ))}
                {[...Array(11)].map((_, index) => (
                  <div
                    key={`h-${index}`}
                    className="absolute left-0 w-full border-t border-gray-600"
                    style={{ top: `${index * 10}%` }}
                  />
                ))}
              </div>
              <div className="absolute left-1/2 top-0 h-full border-l border-green-500/50" />
              <div className="absolute left-0 top-1/2 w-full border-t border-green-500/50" />
              <div
                onPointerDown={startMoveCalibrationBox}
                className="absolute border-4 border-green-400 bg-transparent cursor-move"
                style={calibrationBoxStyle}
              >
                <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-green-200 pointer-events-none">
                  {calibration.width} x {calibration.height}
                </div>
                {[
                  ['nw', '-left-3 -top-3 h-8 w-8 cursor-nwse-resize'],
                  ['n', 'left-6 right-6 -top-3 h-6 cursor-ns-resize'],
                  ['ne', '-right-3 -top-3 h-8 w-8 cursor-nesw-resize'],
                  ['e', '-right-3 top-6 bottom-6 w-6 cursor-ew-resize'],
                  ['se', '-right-3 -bottom-3 h-8 w-8 cursor-nwse-resize'],
                  ['s', 'left-6 right-6 -bottom-3 h-6 cursor-ns-resize'],
                  ['sw', '-left-3 -bottom-3 h-8 w-8 cursor-nesw-resize'],
                  ['w', '-left-3 top-6 bottom-6 w-6 cursor-ew-resize'],
                ].map(([handle, position]) => (
                  <div
                    key={handle}
                    onPointerDown={(event) => startResizeCalibrationBox(event, handle)}
                    className={`absolute bg-transparent ${position}`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded bg-gray-800 p-3">
                <div className="text-gray-400">X</div>
                <div className="mt-1 font-mono text-lg">{calibration.x}</div>
              </div>
              <div className="rounded bg-gray-800 p-3">
                <div className="text-gray-400">Y</div>
                <div className="mt-1 font-mono text-lg">{calibration.y}</div>
              </div>
              <div className="rounded bg-gray-800 p-3">
                <div className="text-gray-400">Width</div>
                <div className="mt-1 font-mono text-lg">{calibration.width}</div>
              </div>
              <div className="rounded bg-gray-800 p-3">
                <div className="text-gray-400">Height</div>
                <div className="mt-1 font-mono text-lg">{calibration.height}</div>
              </div>
            </div>

            <div className="rounded border border-gray-800 bg-gray-950 p-3 text-xs text-gray-400">
              <div className="mb-2 font-medium text-gray-300">Saved calibration</div>
              <div className="grid grid-cols-4 gap-2 font-mono">
                <span>X {savedCalibration.x}</span>
                <span>Y {savedCalibration.y}</span>
                <span>W {savedCalibration.width}</span>
                <span>H {savedCalibration.height}</span>
              </div>
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
              {saving ? 'Saving...' : calibrationChanged ? 'Save Calibration' : 'Calibration Saved'}
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

      <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/30 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-red-100">Factory Reset</h2>
            <p className="mt-2 max-w-3xl text-sm text-red-200/80">
              Clears pairing, owner access, saved WiFi profiles, calibration, and timer state. The Pi will reboot into setup mode.
            </p>
          </div>
          <button
            onClick={factoryReset}
            disabled={factoryResetting || saving}
            className="rounded bg-red-600 px-5 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {factoryResetting ? 'Resetting...' : 'Factory Reset'}
          </button>
        </div>
      </div>
    </div>
  );
}
