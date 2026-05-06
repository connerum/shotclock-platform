'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DeviceMode, DisplayProfile, CalibrationData } from '@shotclock/shared/types';

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

type MediaSlot = 'ads' | 'logo' | 'sponsor' | 'team-intro' | 'music';

interface DeviceMediaAsset {
  id: string;
  slot: MediaSlot;
  originalFilename: string;
  url: string;
  mimeType: string;
  size: number;
  isActive: boolean;
  createdAt: string;
}

const DEVICE_MODES = ['setup', 'pairing', 'offline', 'basketball', 'wrestling', 'volleyball', 'media', 'calibration', 'blank'];
const MEDIA_SLOT_CONFIG: Array<{
  slot: MediaSlot;
  title: string;
  description: string;
  accept: string;
  allowMultipleActive: boolean;
}> = [
  {
    slot: 'ads',
    title: 'Ads',
    description: 'Images or videos shown by the Run Ads button.',
    accept: 'image/*,video/*',
    allowMultipleActive: true,
  },
  {
    slot: 'logo',
    title: 'Logo',
    description: 'School logo shown by the School Logo button.',
    accept: 'image/*,video/*',
    allowMultipleActive: false,
  },
  {
    slot: 'sponsor',
    title: 'Sponsor',
    description: 'Sponsor creative shown by the Sponsor button.',
    accept: 'image/*,video/*',
    allowMultipleActive: false,
  },
  {
    slot: 'team-intro',
    title: 'Team Intro',
    description: 'Video or audio shown by the Team Intro button.',
    accept: 'video/*,audio/*',
    allowMultipleActive: false,
  },
  {
    slot: 'music',
    title: 'Music',
    description: 'Audio played by the Music button.',
    accept: 'audio/*',
    allowMultipleActive: false,
  },
];
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

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
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
  const router = useRouter();
  
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [factoryResetting, setFactoryResetting] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<DeviceMediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<MediaSlot | null>(null);
  const [rgbToBgrEnabled, setRgbToBgrEnabled] = useState(true);
  const [savedRgbToBgrEnabled, setSavedRgbToBgrEnabled] = useState(true);
  const [colorCorrectionSaving, setColorCorrectionSaving] = useState(false);
  
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
    fetchMediaAssets();
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
      const nextRgbToBgrEnabled = data.device.displayProfile?.colorCorrection?.rgbToBgr ?? true;
      setRgbToBgrEnabled(nextRgbToBgrEnabled);
      setSavedRgbToBgrEnabled(nextRgbToBgrEnabled);
    } catch (err) {
      setError('Failed to load device');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMediaAssets = async () => {
    try {
      setMediaLoading(true);
      const res = await fetch(`/api/devices/${deviceId}/media`);
      if (!res.ok) throw new Error('Failed to load media');
      const data = await res.json();
      setMediaAssets(data.mediaAssets || []);
      setMediaError(null);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Failed to load media');
    } finally {
      setMediaLoading(false);
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
  const colorCorrectionChanged = rgbToBgrEnabled !== savedRgbToBgrEnabled;

  const buildCalibrationConfig = (box: CalibrationBox, preview = false, rgbToBgr = rgbToBgrEnabled) => {
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
      colorCorrection: { rgbToBgr },
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
        setSavedRgbToBgrEnabled(rgbToBgrEnabled);
        setDevice(prev => prev ? { ...prev, displayProfile, calibrationData } : null);
      }
    } finally {
      setSaving(false);
    }
  };

  const saveColorCorrection = async () => {
    setColorCorrectionSaving(true);
    try {
      const { displayProfile, calibrationData } = buildCalibrationConfig(calibration, false, rgbToBgrEnabled);

      const res = await fetch(`/api/devices/${deviceId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayProfile,
          calibrationData,
        }),
      });

      if (res.ok) {
        setSavedRgbToBgrEnabled(rgbToBgrEnabled);
        setDevice(prev => prev ? { ...prev, displayProfile, calibrationData } : null);
      }
    } finally {
      setColorCorrectionSaving(false);
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
      router.push('/devices');
      router.refresh();
      return;
    }
    setFactoryResetting(false);
  };

  const uploadMediaAsset = async (slot: MediaSlot, file: File | null) => {
    if (!file) return;

    setUploadingSlot(slot);
    setMediaError(null);
    try {
      const formData = new FormData();
      formData.append('slot', slot);
      formData.append('file', file);

      const res = await fetch(`/api/devices/${deviceId}/media`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Upload failed with HTTP ${res.status}`);
      await fetchMediaAssets();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingSlot(null);
    }
  };

  const setMediaAssetActive = async (asset: DeviceMediaAsset, isActive: boolean) => {
    setMediaError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/media/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Update failed with HTTP ${res.status}`);
      await fetchMediaAssets();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const deleteMediaAsset = async (asset: DeviceMediaAsset) => {
    const confirmed = window.confirm(`Delete ${asset.originalFilename}?`);
    if (!confirmed) return;

    setMediaError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/media/${asset.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Delete failed with HTTP ${res.status}`);
      await fetchMediaAssets();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Delete failed');
    }
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
        <Link href={`/devices/${deviceId}`} className="text-gray-400 hover:text-white mb-4 inline-block">
          ← Back to Sports
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
        <Link href={`/devices/${deviceId}`} className="text-gray-400 hover:text-white mb-4 inline-block">
          ← Back to Sports
        </Link>
        {commandError && (
          <div className="mb-4 rounded border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
            {commandError}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{device.name}</h1>
            <p className="mt-1 text-lg font-semibold text-white/70">Device Details/Settings</p>
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

        {/* Media Management */}
        <div className="rounded-lg bg-gray-900 p-6 lg:col-span-2">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Presentation Media</h2>
              <p className="mt-1 text-sm text-gray-400">
                Upload the media used by the Ads, Logo, Sponsor, Team Intro, and Music buttons.
              </p>
            </div>
            <button
              onClick={fetchMediaAssets}
              disabled={mediaLoading}
              className="rounded bg-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div className="mb-4 rounded border border-blue-900/60 bg-blue-950/30 p-3 text-sm text-blue-100/90">
            Files are stored on disk under the server&apos;s public media folder. SQLite stores metadata, device ownership,
            active status, and which button slot each file belongs to.
          </div>

          {mediaError && (
            <div className="mb-4 rounded border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
              {mediaError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            {MEDIA_SLOT_CONFIG.map((slotConfig) => {
              const slotAssets = mediaAssets.filter((asset) => asset.slot === slotConfig.slot);
              const activeCount = slotAssets.filter((asset) => asset.isActive).length;

              return (
                <div key={slotConfig.slot} className="rounded-lg border border-gray-800 bg-gray-950/70 p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold">{slotConfig.title}</h3>
                    <p className="mt-1 min-h-10 text-xs text-gray-400">{slotConfig.description}</p>
                  </div>

                  <label className="block cursor-pointer rounded border border-dashed border-gray-700 bg-gray-900 px-3 py-3 text-center text-sm font-medium text-gray-200 hover:border-gray-500 hover:bg-gray-800">
                    {uploadingSlot === slotConfig.slot ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept={slotConfig.accept}
                      disabled={uploadingSlot !== null}
                      className="hidden"
                      onChange={(event) => {
                        void uploadMediaAsset(slotConfig.slot, event.currentTarget.files?.[0] || null);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>

                  <div className="mt-3 text-xs text-gray-500">
                    {activeCount} active / {slotAssets.length} total
                  </div>

                  <div className="mt-3 space-y-2">
                    {slotAssets.length === 0 && (
                      <div className="rounded bg-gray-900 p-3 text-xs text-gray-500">No media uploaded</div>
                    )}
                    {slotAssets.map((asset) => (
                      <div key={asset.id} className="rounded border border-gray-800 bg-black/30 p-3">
                        <div className="truncate text-sm font-medium" title={asset.originalFilename}>
                          {asset.originalFilename}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {asset.mimeType} / {formatBytes(asset.size)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-gray-800 px-2 py-1 text-xs hover:bg-gray-700"
                          >
                            Preview
                          </a>
                          {slotConfig.allowMultipleActive ? (
                            <button
                              onClick={() => setMediaAssetActive(asset, !asset.isActive)}
                              className={`rounded px-2 py-1 text-xs ${
                                asset.isActive ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                              }`}
                            >
                              {asset.isActive ? 'Active' : 'Enable'}
                            </button>
                          ) : (
                            <button
                              onClick={() => setMediaAssetActive(asset, true)}
                              disabled={asset.isActive}
                              className={`rounded px-2 py-1 text-xs disabled:cursor-default ${
                                asset.isActive ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                              }`}
                            >
                              {asset.isActive ? 'Selected' : 'Use'}
                            </button>
                          )}
                          <button
                            onClick={() => deleteMediaAsset(asset)}
                            className="rounded bg-red-950 px-2 py-1 text-xs text-red-200 hover:bg-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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

        {/* Color Correction */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Color Correction</h2>
          <div className="space-y-4">
            <div className="rounded border border-gray-800 bg-gray-950 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">RGB to BGR channel swap</div>
                  <p className="mt-1 text-sm text-gray-400">
                    Compensates for NovaStar Taurus receiver paths that swap red and blue channels from HDMI.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRgbToBgrEnabled(value => !value)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    rgbToBgrEnabled ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                  aria-pressed={rgbToBgrEnabled}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                      rgbToBgrEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-3 text-sm">
                <span className="text-gray-400">Current setting: </span>
                <span className={rgbToBgrEnabled ? 'text-green-400' : 'text-gray-300'}>
                  {rgbToBgrEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            <button
              onClick={saveColorCorrection}
              disabled={colorCorrectionSaving || saving}
              className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-medium disabled:opacity-50"
            >
              {colorCorrectionSaving ? 'Saving...' : colorCorrectionChanged ? 'Save Color Correction' : 'Color Correction Saved'}
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
