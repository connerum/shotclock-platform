import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SportDisplayLayout, SportDisplayMedia } from '@shotclock/shared/types';
import {
  getTwoPanelAdIndex,
  getTwoPanelOrder,
} from './two-panel-layout-behavior';

interface TwoPanelSportLayoutProps {
  layout: SportDisplayLayout;
  primaryResetSequence?: number;
  children: ReactNode;
}

export default function TwoPanelSportLayout({
  layout,
  primaryResetSequence,
  children,
}: TwoPanelSportLayoutProps) {
  const adPlaylist = useMemo(
    () => (Array.isArray(layout.adPlaylist) ? layout.adPlaylist : []).filter(isVisualMedia),
    [layout.adPlaylist]
  );
  const panelOrder = getTwoPanelOrder(layout.adPosition);
  const activeAd = adPlaylist[
    getTwoPanelAdIndex(primaryResetSequence ?? 0, adPlaylist.length)
  ] || null;

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

function isVisualMedia(media: SportDisplayMedia): boolean {
  return Boolean(
    media?.mediaUrl &&
    (media.mediaMimeType?.startsWith('image/') || media.mediaMimeType?.startsWith('video/'))
  );
}
