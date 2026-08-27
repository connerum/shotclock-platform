import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SportDisplayLayout, SportDisplayMedia } from '@shotclock/shared/types';
import {
  getTwoPanelAdIndex,
  getTwoPanelOrder,
} from './two-panel-layout-behavior';

interface TwoPanelSportLayoutProps {
  layout: SportDisplayLayout;
  children: ReactNode;
}

export default function TwoPanelSportLayout({
  layout,
  children,
}: TwoPanelSportLayoutProps) {
  const adPlaylist = useMemo(
    () => (Array.isArray(layout.adPlaylist) ? layout.adPlaylist : []).filter(isVisualMedia),
    [layout.adPlaylist]
  );
  const playlistKey = adPlaylist
    .map((item) => `${item.mediaUrl}\u0000${item.mediaMimeType}`)
    .join('\u0001');
  const panelOrder = getTwoPanelOrder(layout.adPosition);
  const [timedCursor, setTimedCursor] = useState(0);

  useEffect(() => {
    setTimedCursor(0);
  }, [playlistKey]);

  useEffect(() => {
    if (adPlaylist.length <= 1) return;

    const interval = setInterval(() => {
      setTimedCursor((index) => (index + 1) % adPlaylist.length);
    }, normalizeRotationInterval(layout.rotationIntervalMs));

    return () => clearInterval(interval);
  }, [adPlaylist.length, layout.rotationIntervalMs, playlistKey]);

  const activeAd = adPlaylist[getTwoPanelAdIndex(timedCursor, adPlaylist.length)] || null;

  return (
    <div className="sport-two-panel-stage">
      <div className="sport-two-panel-grid">
        {panelOrder.map((panel) => panel === 'ad' ? (
          <SportAdPanel key="ad" media={activeAd} />
        ) : (
          <div key="game" className="sport-two-panel-cell sport-two-panel-main">
            {children}
          </div>
        ))}
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
    <div className="sport-two-panel-cell sport-two-panel-ad" aria-label="Advertisement panel">
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
