'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PresentationOverlay, PresentationOverlayAccent, PresentationOverlayType } from '@shotclock/shared/types';

type MediaSlot = 'ads' | 'logo' | 'sponsor' | 'team-intro' | 'music';

type DeviceMediaAsset = {
  id: string;
  slot: MediaSlot;
  originalFilename: string;
  url: string;
  mimeType: string;
  isActive: boolean;
};

type PresentationAction = {
  label: string;
  description: string;
  type: PresentationOverlayType;
  title: string;
  message?: string;
  accent: PresentationOverlayAccent;
  durationMs?: number;
  buttonClass: string;
};

const PRESENTATION_GROUPS: Array<{
  title: string;
  description: string;
  actions: PresentationAction[];
}> = [
  {
    title: 'Advertisement Display',
    description: 'Show sponsor or school branding over the active sport display.',
    actions: [
      {
        label: 'Run Ads',
        description: 'Rotating sponsor display',
        type: 'advertisement',
        title: 'ADS',
        message: 'Sponsor Rotation',
        accent: 'blue',
        buttonClass: 'cc-btn-blue',
      },
      {
        label: 'School Logo',
        description: 'School branding screen',
        type: 'school-logo',
        title: 'COURTCAST',
        message: 'School Logo',
        accent: 'green',
        buttonClass: 'cc-btn-primary',
      },
      {
        label: 'Sponsor',
        description: 'Static sponsor display',
        type: 'sponsor',
        title: 'SPONSOR',
        message: 'Featured Partner',
        accent: 'purple',
        buttonClass: 'cc-btn-blue',
      },
    ],
  },
  {
    title: 'Team Intro',
    description: 'Trigger walkout and celebration screens before play.',
    actions: [
      {
        label: 'Team Intro',
        description: 'Walkout display',
        type: 'team-intro',
        title: 'TEAM INTRO',
        message: 'Walkout',
        accent: 'purple',
        buttonClass: 'cc-btn-blue',
      },
      {
        label: 'Champion',
        description: 'Celebration display',
        type: 'champion',
        title: 'CHAMPION',
        message: 'Celebrate',
        accent: 'orange',
        buttonClass: 'cc-btn-orange',
      },
    ],
  },
  {
    title: 'Sound Effects',
    description: 'Send quick audio cues to the display station.',
    actions: [
      {
        label: 'Horn',
        description: 'Short buzzer cue',
        type: 'sound-horn',
        title: 'HORN',
        message: 'Buzzer',
        accent: 'yellow',
        durationMs: 1500,
        buttonClass: 'cc-btn-orange',
      },
      {
        label: 'Music',
        description: 'Music cue screen',
        type: 'music',
        title: 'MUSIC',
        message: 'Playback Cue',
        accent: 'blue',
        durationMs: 2500,
        buttonClass: 'cc-btn-blue',
      },
    ],
  },
  {
    title: 'Emergency',
    description: 'Immediately override the display with an emergency message.',
    actions: [
      {
        label: 'Weather',
        description: 'Weather alert',
        type: 'emergency-weather',
        title: 'WEATHER',
        message: 'Seek Shelter',
        accent: 'red',
        buttonClass: 'cc-btn-red',
      },
      {
        label: 'Medical',
        description: 'Medical alert',
        type: 'emergency-medical',
        title: 'MEDICAL',
        message: 'Clear Area',
        accent: 'red',
        buttonClass: 'cc-btn-red',
      },
    ],
  },
];

export default function GamePresentationControls({ deviceId }: { deviceId: string }) {
  const [pendingType, setPendingType] = useState<PresentationOverlayType | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mediaAssets, setMediaAssets] = useState<DeviceMediaAsset[]>([]);

  useEffect(() => {
    const fetchMediaAssets = async () => {
      try {
        const response = await fetch(`/api/devices/${deviceId}/media`);
        if (!response.ok) return;
        const data = await response.json();
        setMediaAssets(data.mediaAssets || []);
      } catch {
        setMediaAssets([]);
      }
    };

    void fetchMediaAssets();
  }, [deviceId]);

  const activeMediaBySlot = useMemo(() => {
    return mediaAssets.reduce<Record<MediaSlot, DeviceMediaAsset[]>>((acc, asset) => {
      if (asset.isActive) acc[asset.slot].push(asset);
      return acc;
    }, { ads: [], logo: [], sponsor: [], 'team-intro': [], music: [] });
  }, [mediaAssets]);

  const sendPresentation = async (action: PresentationAction) => {
    const mediaAsset = getMediaAssetForAction(action.type, activeMediaBySlot);
    const overlay: PresentationOverlay = {
      type: action.type,
      title: action.title,
      message: action.message,
      accent: action.accent,
      active: true,
      startedAt: Date.now(),
      durationMs: action.durationMs,
      ...(mediaAsset && {
        mediaUrl: getPublicMediaUrl(mediaAsset.url),
        mediaMimeType: mediaAsset.mimeType,
      }),
    };

    await sendOverlayCommand(overlay, action.label);
  };

  const clearPresentation = async () => {
    const overlay: PresentationOverlay = {
      type: 'clear',
      title: 'CLEAR',
      accent: 'blue',
      active: false,
      startedAt: Date.now(),
    };

    await sendOverlayCommand(overlay, 'Clear Display');
  };

  const sendOverlayCommand = async (overlay: PresentationOverlay, label: string) => {
    setPendingType(overlay.type);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'presentation', payload: { overlay } }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMessage(data?.error || `Command failed with HTTP ${response.status}`);
        return;
      }

      setStatusMessage(`${label} sent to display`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Command failed');
    } finally {
      setPendingType(null);
    }
  };

  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Game Presentation</h2>
          <p className="mt-1 text-sm text-gray-400">Display actions shared by every sport mode.</p>
        </div>
        <button
          type="button"
          className="cc-btn cc-btn-secondary px-4 py-2 text-sm disabled:cursor-wait disabled:opacity-60"
          disabled={pendingType !== null}
          onClick={clearPresentation}
        >
          Clear Display
        </button>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}
      {statusMessage && (
        <div className="mb-4 rounded border border-green-700 bg-green-950/40 p-3 text-sm text-green-200">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        {PRESENTATION_GROUPS.map((group) => (
          <div key={group.title} className="cc-card p-5">
            <h3 className="text-lg font-semibold">{group.title}</h3>
            <p className="mt-1 min-h-10 text-sm text-gray-400">{group.description}</p>
            <div className="mt-5 grid gap-3">
              {group.actions.map((action) => (
                <button
                  key={action.type}
                  type="button"
                  className={`cc-btn ${action.buttonClass} min-h-14 px-4 py-3 text-left disabled:cursor-wait disabled:opacity-60`}
                  disabled={pendingType !== null}
                  onClick={() => void sendPresentation(action)}
                  title={action.description}
                >
                  <span className="flex w-full flex-col items-start leading-tight">
                    <span>{pendingType === action.type ? 'Sending...' : action.label}</span>
                    <span className="text-xs font-semibold text-white/70">{action.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getMediaAssetForAction(
  type: PresentationOverlayType,
  assetsBySlot: Record<MediaSlot, DeviceMediaAsset[]>
) {
  const slot = getSlotForPresentationType(type);
  if (!slot) return null;

  const assets = assetsBySlot[slot];
  if (assets.length === 0) return null;

  if (slot === 'ads') {
    return assets[Math.floor(Date.now() / 1000) % assets.length];
  }

  return assets[0];
}

function getSlotForPresentationType(type: PresentationOverlayType): MediaSlot | null {
  if (type === 'advertisement') return 'ads';
  if (type === 'school-logo') return 'logo';
  if (type === 'sponsor') return 'sponsor';
  if (type === 'team-intro') return 'team-intro';
  if (type === 'music') return 'music';
  return null;
}

function getPublicMediaUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
}
