import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SportDisplayLayout, SportDisplayMedia } from '@shotclock/shared/types';

interface ThreePanelSportLayoutProps {
  layout: SportDisplayLayout;
  children: ReactNode;
}

export default function ThreePanelSportLayout({ layout, children }: ThreePanelSportLayoutProps) {
  const adPlaylist = useMemo(
    () => (Array.isArray(layout.adPlaylist) ? layout.adPlaylist : []).filter(isVisualMedia),
    [layout.adPlaylist]
  );

  return (
    <div className="sport-three-panel-stage">
      <div className="sport-three-panel-grid">
        <SportAdPanel
          playlist={adPlaylist}
          rotationIntervalMs={layout.rotationIntervalMs}
          initialOffset={0}
        />
        <div className="sport-three-panel-cell sport-three-panel-main">
          {children}
        </div>
        <SportAdPanel
          playlist={adPlaylist}
          rotationIntervalMs={layout.rotationIntervalMs}
          initialOffset={1}
        />
      </div>
    </div>
  );
}

function SportAdPanel({
  playlist,
  rotationIntervalMs,
  initialOffset,
}: {
  playlist: SportDisplayMedia[];
  rotationIntervalMs?: number;
  initialOffset: number;
}) {
  const playlistKey = playlist
    .map((item) => `${item.mediaUrl}\u0000${item.mediaMimeType}`)
    .join('\u0001');
  const [playlistIndex, setPlaylistIndex] = useState(() => getInitialIndex(playlist.length, initialOffset));
  const [mediaLoadFailed, setMediaLoadFailed] = useState(false);

  useEffect(() => {
    setPlaylistIndex(getInitialIndex(playlist.length, initialOffset));
    setMediaLoadFailed(false);
  }, [initialOffset, playlist.length, playlistKey]);

  useEffect(() => {
    if (playlist.length <= 1) return;

    const interval = setInterval(() => {
      setPlaylistIndex((index) => (index + 1) % playlist.length);
      setMediaLoadFailed(false);
    }, normalizeRotationInterval(rotationIntervalMs));

    return () => clearInterval(interval);
  }, [playlist.length, playlistKey, rotationIntervalMs]);

  const activeMedia = playlist.length > 0
    ? playlist[playlistIndex % playlist.length]
    : null;
  const isImage = activeMedia?.mediaMimeType.startsWith('image/');
  const isVideo = activeMedia?.mediaMimeType.startsWith('video/');

  return (
    <div className="sport-three-panel-cell sport-three-panel-ad" aria-label="Advertisement panel">
      {!activeMedia || mediaLoadFailed ? (
        null
      ) : isImage ? (
        <img
          key={activeMedia.mediaUrl}
          src={activeMedia.mediaUrl}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setMediaLoadFailed(true)}
        />
      ) : isVideo ? (
        <video
          key={activeMedia.mediaUrl}
          src={activeMedia.mediaUrl}
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

function getInitialIndex(playlistLength: number, initialOffset: number): number {
  return playlistLength > 0 ? initialOffset % playlistLength : 0;
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
