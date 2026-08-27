import type { SportDisplayAdMode } from '@shotclock/shared/types';

export const DEFAULT_THREE_PANEL_AD_MODE: SportDisplayAdMode = 'offset-timed';

export function normalizeThreePanelAdMode(value: unknown): SportDisplayAdMode {
  return value === 'mirrored-timed' || value === 'offset-on-timer-reset'
    ? value
    : DEFAULT_THREE_PANEL_AD_MODE;
}

export function usesTimedAdRotation(adMode: SportDisplayAdMode): boolean {
  return adMode !== 'offset-on-timer-reset';
}

export function getThreePanelAdIndices({
  adMode,
  playlistLength,
  timedCursor,
  primaryResetSequence,
}: {
  adMode: SportDisplayAdMode;
  playlistLength: number;
  timedCursor: number;
  primaryResetSequence?: number;
}): { firstIndex: number; secondIndex: number } {
  if (playlistLength <= 0) return { firstIndex: 0, secondIndex: 0 };

  const baseIndex = adMode === 'offset-on-timer-reset'
    ? normalizeIndex(primaryResetSequence, playlistLength)
    : normalizeIndex(timedCursor, playlistLength);

  return {
    firstIndex: baseIndex,
    secondIndex: adMode === 'mirrored-timed'
      ? baseIndex
      : (baseIndex + 1) % playlistLength,
  };
}

function normalizeIndex(value: number | undefined, playlistLength: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const normalized = Math.max(0, Math.floor(value));
  return normalized % playlistLength;
}
