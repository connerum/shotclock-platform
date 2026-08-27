'use client';

import Link from 'next/link';
import {
  DEFAULT_SPORT_DISPLAY_AD_POSITION,
  THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  THREE_PANEL_SPORTS_ADS_CAPABILITY,
  TWO_PANEL_RESET_ADS_CAPABILITY,
  type PrimaryClockResetAction,
  type SportDisplayAdMode,
  type SportDisplayAdPosition,
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
export const DEFAULT_SPORT_DISPLAY_AD_MODE: SportDisplayAdMode = 'offset-timed';
export { DEFAULT_SPORT_DISPLAY_AD_POSITION };

const AD_MODE_OPTIONS: Array<{
  value: SportDisplayAdMode;
  label: string;
  description: string;
  requiresAdvancedCapability: boolean;
}> = [
  {
    value: 'offset-timed',
    label: 'Two Ads · Timed',
    description: 'Different ads on the outer panels, advancing every 8 seconds.',
    requiresAdvancedCapability: false,
  },
  {
    value: 'mirrored-timed',
    label: 'Mirrored · Timed',
    description: 'The same ad appears on both outer panels and they advance together.',
    requiresAdvancedCapability: true,
  },
  {
    value: 'offset-on-timer-reset',
    label: 'Mirrored · On Reset',
    description: 'The same ad stays fixed on both outer panels and advances once when the sport timer is reset.',
    requiresAdvancedCapability: true,
  },
];

export function buildThreePanelSportLayout(
  mediaAssets: SportLayoutMediaAsset[],
  adMode: SportDisplayAdMode = DEFAULT_SPORT_DISPLAY_AD_MODE
): SportDisplayLayout {
  return {
    type: 'three-panel',
    adPlaylist: getActiveSportAdPlaylist(mediaAssets),
    rotationIntervalMs: SPORT_AD_ROTATION_INTERVAL_MS,
    adMode,
  };
}

export function buildTwoPanelSportLayout(
  mediaAssets: SportLayoutMediaAsset[],
  adPosition: SportDisplayAdPosition = DEFAULT_SPORT_DISPLAY_AD_POSITION
): SportDisplayLayout {
  return {
    type: 'two-panel',
    adPlaylist: getActiveSportAdPlaylist(mediaAssets),
    adPosition,
  };
}

export function getSportDisplayAdMode(layout: SportDisplayLayout | undefined): SportDisplayAdMode {
  return layout?.adMode === 'mirrored-timed' || layout?.adMode === 'offset-on-timer-reset'
    ? layout.adMode
    : DEFAULT_SPORT_DISPLAY_AD_MODE;
}

export function getSportDisplayAdPosition(layout: SportDisplayLayout | undefined): SportDisplayAdPosition {
  return layout?.adPosition === 'start' ? 'start' : DEFAULT_SPORT_DISPLAY_AD_POSITION;
}

export function createPrimaryClockResetAction(): PrimaryClockResetAction {
  const eventId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { kind: 'primary-clock-reset', eventId };
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
  layoutType,
  adMode,
  adPosition,
  activeAdCount,
  mediaLoading,
  mediaError,
  capabilities,
  isSyncActive = false,
  layoutSaving = false,
  onLayoutTypeChange,
  onAdModeChange,
  onAdPositionChange,
}: {
  deviceId: string;
  layoutType: SportDisplayLayout['type'] | undefined;
  adMode: SportDisplayAdMode;
  adPosition: SportDisplayAdPosition;
  activeAdCount: number;
  mediaLoading: boolean;
  mediaError?: string | null;
  capabilities?: string[];
  isSyncActive?: boolean;
  layoutSaving?: boolean;
  onLayoutTypeChange: (layoutType: SportDisplayLayout['type'] | undefined) => void | Promise<void>;
  onAdModeChange: (adMode: SportDisplayAdMode) => void | Promise<void>;
  onAdPositionChange: (adPosition: SportDisplayAdPosition) => void | Promise<void>;
}) {
  const threePanelSupported = capabilities?.includes(THREE_PANEL_SPORTS_ADS_CAPABILITY) === true;
  const twoPanelSupported = capabilities?.includes(TWO_PANEL_RESET_ADS_CAPABILITY) === true;
  const advancedBehaviorsSupported = capabilities?.includes(THREE_PANEL_AD_BEHAVIORS_CAPABILITY) === true;
  const adSummary = getAdSummary(
    activeAdCount,
    mediaLoading,
    layoutType,
    adMode,
    adPosition,
    twoPanelSupported,
    threePanelSupported
  );
  const twoPanelUnavailable = !twoPanelSupported || mediaLoading || activeAdCount === 0;
  const threePanelUnavailable = !threePanelSupported || mediaLoading || activeAdCount === 0;
  const selectedLayoutSupported = layoutType === 'two-panel'
    ? twoPanelSupported
    : layoutType === 'three-panel'
      ? threePanelSupported
      : twoPanelSupported || threePanelSupported;

  return (
    <section className="cc-card mb-4 p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Board Layout</div>
          <p className="mt-1 text-sm text-gray-400">
            Show the sport full-board, beside one ad, or centered between two ads. Split layouts follow the board&apos;s longest side.
          </p>
          <p className="mt-1 text-xs text-gray-500">Full-screen Game Presentation actions temporarily cover this layout.</p>
          {isSyncActive && (
            <p className="mt-1 text-xs text-blue-300">Display sync uses this board&apos;s ad playlist on every selected board.</p>
          )}
          <div className={`mt-2 text-sm font-semibold ${selectedLayoutSupported && activeAdCount > 0 ? 'text-green-300' : 'text-orange-300'}`}>
            {adSummary}
          </div>
          {mediaError && <div className="mt-1 text-xs text-red-300">{mediaError}</div>}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="grid grid-cols-1 rounded-lg border border-white/10 bg-black/30 p-1 sm:grid-cols-3" role="group" aria-label="Board layout">
            <button
              type="button"
              onClick={() => void onLayoutTypeChange(undefined)}
              disabled={layoutSaving}
              aria-pressed={!layoutType}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-45 ${
                !layoutType ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              Full Board
            </button>
            <button
              type="button"
              onClick={() => void onLayoutTypeChange('two-panel')}
              disabled={twoPanelUnavailable || layoutSaving}
              aria-pressed={layoutType === 'two-panel'}
              title={!twoPanelSupported
                ? 'Update the display software to use this layout'
                : activeAdCount === 0
                  ? 'Activate at least one visual ad first'
                  : undefined}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                layoutType === 'two-panel' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {layoutSaving ? 'Applying...' : '2-Panel Sport + Ad'}
            </button>
            <button
              type="button"
              onClick={() => void onLayoutTypeChange('three-panel')}
              disabled={threePanelUnavailable || layoutSaving}
              aria-pressed={layoutType === 'three-panel'}
              title={!threePanelSupported
                ? 'Update the display software to use this layout'
                : activeAdCount === 0
                  ? 'Activate at least one visual ad first'
                  : undefined}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                layoutType === 'three-panel' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {layoutSaving ? 'Applying...' : '3-Panel Sport + Ads'}
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

      {layoutType === 'three-panel' && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Ad Behavior</div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {AD_MODE_OPTIONS.map((option) => {
              const unavailable = option.requiresAdvancedCapability && !advancedBehaviorsSupported;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void onAdModeChange(option.value)}
                  disabled={layoutSaving || unavailable}
                  aria-pressed={adMode === option.value}
                  title={unavailable ? 'Update the display software to use this ad behavior' : undefined}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    adMode === option.value
                      ? 'border-blue-400/70 bg-blue-500/15 text-white'
                      : 'border-white/10 bg-black/20 text-gray-300 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-snug text-gray-400">{option.description}</span>
                </button>
              );
            })}
          </div>
          {!advancedBehaviorsSupported && (
            <p className="mt-2 text-xs text-orange-300">
              Update the display software to unlock mirrored and timer-reset ad behaviors.
            </p>
          )}
        </div>
      )}

      {layoutType === 'two-panel' && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Ad Position</div>
          <p className="mt-1 text-xs text-gray-400">
            Position names adapt to the board: top and bottom when vertical, left and right when horizontal.
            The ad stays fixed and advances only when the sport timer is reset.
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {([
              {
                value: 'start' as const,
                label: 'Top / Left',
                description: 'Place the ad in the first half and the game display in the second half.',
              },
              {
                value: 'end' as const,
                label: 'Bottom / Right',
                description: 'Place the game display in the first half and the ad in the second half.',
              },
            ]).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => void onAdPositionChange(option.value)}
                disabled={layoutSaving}
                aria-pressed={adPosition === option.value}
                className={`rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-wait disabled:opacity-45 ${
                  adPosition === option.value
                    ? 'border-blue-400/70 bg-blue-500/15 text-white'
                    : 'border-white/10 bg-black/20 text-gray-300 hover:bg-white/[0.07]'
                }`}
              >
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="mt-1 block text-xs leading-snug text-gray-400">{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function getAdSummary(
  activeAdCount: number,
  mediaLoading: boolean,
  layoutType: SportDisplayLayout['type'] | undefined,
  adMode: SportDisplayAdMode,
  adPosition: SportDisplayAdPosition,
  twoPanelSupported: boolean,
  threePanelSupported: boolean
): string {
  if (layoutType === 'two-panel' && !twoPanelSupported) return 'Display software update required for 2-panel layouts.';
  if (layoutType === 'three-panel' && !threePanelSupported) return 'Display software update required for 3-panel layouts.';
  if (!layoutType && !twoPanelSupported && !threePanelSupported) return 'Display software update required for split layouts.';
  if (mediaLoading) return 'Loading active ads...';
  if (activeAdCount === 0) return 'No active visual ads. Add or activate an ad to use this layout.';
  if (!layoutType) return `${activeAdCount} active ad${activeAdCount === 1 ? '' : 's'} ready for split layouts`;
  if (layoutType === 'two-panel') {
    const positionLabel = adPosition === 'start' ? 'Top / Left' : 'Bottom / Right';
    if (activeAdCount === 1) return `1 active ad · static in the ${positionLabel} panel`;
    return `${activeAdCount} active ads · advancing once per timer reset · ${positionLabel} panel`;
  }
  if (activeAdCount === 1) return '1 active ad · static on both outer sections';
  if (adMode === 'mirrored-timed') {
    return `${activeAdCount} active ads · mirrored and rotating together every ${SPORT_AD_ROTATION_INTERVAL_MS / 1000} seconds`;
  }
  if (adMode === 'offset-on-timer-reset') {
    return `${activeAdCount} active ads · mirrored and advancing once per timer reset`;
  }
  return `${activeAdCount} active ads · two rotate every ${SPORT_AD_ROTATION_INTERVAL_MS / 1000} seconds`;
}

function isVisualMedia(asset: SportLayoutMediaAsset): boolean {
  return asset.mimeType.startsWith('image/') || asset.mimeType.startsWith('video/');
}

function getPublicMediaUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
}
