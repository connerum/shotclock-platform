import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SportDisplayLayout, SportDisplayMedia } from '@shotclock/shared/types';
import {
  getThreePanelAdIndices,
  normalizeThreePanelAdMode,
  usesTimedAdRotation,
} from './three-panel-ad-behavior';

interface ThreePanelSportLayoutProps {
  layout: SportDisplayLayout;
  primaryResetSequence?: number;
  children: ReactNode;
}

export default function ThreePanelSportLayout({
  layout,
  primaryResetSequence,
  children,
}: ThreePanelSportLayoutProps) {
  const adPlaylist = useMemo(
    () => (Array.isArray(layout.adPlaylist) ? layout.adPlaylist : []).filter(isVisualMedia),
    [layout.adPlaylist]
  );
  const playlistKey = adPlaylist
    .map((item) => `${item.mediaUrl}\u0000${item.mediaMimeType}`)
    .join('\u0001');
  const adMode = normalizeThreePanelAdMode(layout.adMode);
  const [timedCursor, setTimedCursor] = useState(0);

  useEffect(() => {
    setTimedCursor(0);
  }, [adMode, playlistKey]);

  useEffect(() => {
    if (!usesTimedAdRotation(adMode) || adPlaylist.length <= 1) return;

    const interval = setInterval(() => {
      setTimedCursor((index) => (index + 1) % adPlaylist.length);
    }, normalizeRotationInterval(layout.rotationIntervalMs));

    return () => clearInterval(interval);
  }, [adMode, adPlaylist.length, layout.rotationIntervalMs, playlistKey]);

  const { firstIndex, secondIndex } = getThreePanelAdIndices({
    adMode,
    playlistLength: adPlaylist.length,
    timedCursor,
    primaryResetSequence,
  });

  return (
    <div className="sport-three-panel-stage">
      <div className="sport-three-panel-grid">
        <SportAdPanel media={adPlaylist[firstIndex] || null} />
        <div className="sport-three-panel-cell sport-three-panel-main">
          {children}
        </div>
        <SportAdPanel media={adPlaylist[secondIndex] || null} />
      </div>
    </div>
  );
}

function SportAdPanel({
  media,
}: {
  media: SportDisplayMedia | null;
}) {
  const [mediaLoadFailed, setMediaLoadFailed] = useState(false);

  useEffect(() => {
    setMediaLoadFailed(false);
  }, [media?.mediaMimeType, media?.mediaUrl]);

  const isImage = media?.mediaMimeType.startsWith('image/');
  const isVideo = media?.mediaMimeType.startsWith('video/');

  return (
    <div className="sport-three-panel-cell sport-three-panel-ad" aria-label="Advertisement panel">
      {!media || mediaLoadFailed ? (
        null
      ) : isImage ? (
        <img
          key={media.mediaUrl}
          src={media.mediaUrl}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setMediaLoadFailed(true)}
        />
      ) : isVideo ? (
        <video
          key={media.mediaUrl}
          src={media.mediaUrl}
          autoPlay
          muted
          playsInline
          loop
          className="h-full w-full object-contain"
          onError={() => setMediaLoadFailed(true)}
        />
      ) : null}
    </div>
  );
}

function normalizeRotationInterval(value: number | undefined): number {
  if (!Number.isFinite(value)) return 8000;
  return Math.max(1000, Math.min(60000, Math.round(value!)));
}

function isVisualMedia(media: SportDisplayMedia): boolean {
  return Boolean(
    media?.mediaUrl &&
    (media.mediaMimeType?.startsWith('image/') || media.mediaMimeType?.startsWith('video/'))
  );
}
