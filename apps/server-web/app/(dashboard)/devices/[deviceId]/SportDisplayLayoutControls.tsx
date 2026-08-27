'use client';

import Link from 'next/link';
import {
  THREE_PANEL_SPORTS_ADS_CAPABILITY,
  type SportDisplayLayout,
  type SportDisplayMedia,
} from '@shotclock/shared/types';

export interface SportLayoutMediaAsset {
  slot: string;
  url: string;
  mimeType: string;
  isActive: boolean;
}

export const SPORT_AD_ROTATION_INTERVAL_MS = 8000;

export function buildThreePanelSportLayout(mediaAssets: SportLayoutMediaAsset[]): SportDisplayLayout {
  return {
    type: 'three-panel',
    adPlaylist: getActiveSportAdPlaylist(mediaAssets),
    rotationIntervalMs: SPORT_AD_ROTATION_INTERVAL_MS,
  };
}

export function getActiveSportAdPlaylist(mediaAssets: SportLayoutMediaAsset[]): SportDisplayMedia[] {
  return mediaAssets
    .filter((asset) => asset.slot === 'ads' && asset.isActive && isVisualMedia(asset))
    .map((asset) => ({
      mediaUrl: getPublicMediaUrl(asset.url),
      mediaMimeType: asset.mimeType,
    }));
}

export default function SportDisplayLayoutControls({
  deviceId,
  enabled,
  activeAdCount,
  mediaLoading,
  mediaError,
  capabilities,
  isSyncActive = false,
  layoutSaving = false,
  onEnabledChange,
}: {
  deviceId: string;
  enabled: boolean;
  activeAdCount: number;
  mediaLoading: boolean;
  mediaError?: string | null;
  capabilities?: string[];
  isSyncActive?: boolean;
  layoutSaving?: boolean;
  onEnabledChange: (enabled: boolean) => void | Promise<void>;
}) {
  const isSupported = capabilities?.includes(THREE_PANEL_SPORTS_ADS_CAPABILITY) === true;
  const adSummary = getAdSummary(activeAdCount, mediaLoading, isSupported);
  const threePanelUnavailable = !isSupported || mediaLoading || activeAdCount === 0;

  return (
    <section className="cc-card mb-4 p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Board Layout</div>
          <p className="mt-1 text-sm text-gray-400">
            Split the board into three equal sections along its longest side, with the sport in the middle and ads on both ends.
          </p>
          <p className="mt-1 text-xs text-gray-500">Full-screen Game Presentation actions temporarily cover this layout.</p>
          {isSyncActive && (
            <p className="mt-1 text-xs text-blue-300">Display sync uses this board&apos;s ad playlist on every selected board.</p>
          )}
          <div className={`mt-2 text-sm font-semibold ${isSupported && activeAdCount > 0 ? 'text-green-300' : 'text-orange-300'}`}>
            {adSummary}
          </div>
          {mediaError && <div className="mt-1 text-xs text-red-300">{mediaError}</div>}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="flex rounded-lg border border-white/10 bg-black/30 p-1" role="group" aria-label="Board layout">
            <button
              type="button"
              onClick={() => void onEnabledChange(false)}
              disabled={layoutSaving}
              aria-pressed={!enabled}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-45 ${
                !enabled ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              Full Board
            </button>
            <button
              type="button"
              onClick={() => void onEnabledChange(true)}
              disabled={threePanelUnavailable || layoutSaving}
              aria-pressed={enabled}
              title={!isSupported
                ? 'Update the display software to use this layout'
                : activeAdCount === 0
                  ? 'Activate at least one visual ad first'
                  : undefined}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                enabled ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {layoutSaving ? 'Applying...' : '3-Section Sport + Ads'}
            </button>
          </div>
          <Link
            href={`/devices/${deviceId}/settings#presentation-media`}
            className="rounded-lg border border-white/10 px-3 py-2 text-center text-sm font-semibold text-gray-300 hover:bg-white/10 hover:text-white"
          >
            Manage Ads
          </Link>
        </div>
      </div>
    </section>
  );
}

function getAdSummary(activeAdCount: number, mediaLoading: boolean, isSupported: boolean): string {
  if (!isSupported) return 'Display software update required for 3-section layouts.';
  if (mediaLoading) return 'Loading active ads...';
  if (activeAdCount === 0) return 'No active visual ads. Add or activate an ad to use this layout.';
  if (activeAdCount === 1) return '1 active ad · static on both outer sections';
  return `${activeAdCount} active ads · rotating every ${SPORT_AD_ROTATION_INTERVAL_MS / 1000} seconds`;
}

function isVisualMedia(asset: SportLayoutMediaAsset): boolean {
  return asset.mimeType.startsWith('image/') || asset.mimeType.startsWith('video/');
}

function getPublicMediaUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
}
