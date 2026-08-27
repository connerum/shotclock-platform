import {
  DEFAULT_SPORT_DISPLAY_AD_POSITION,
  type SportDisplayAdPosition,
} from '@shotclock/shared/types';

export function normalizeTwoPanelAdPosition(value: unknown): SportDisplayAdPosition {
  return value === 'start' ? 'start' : DEFAULT_SPORT_DISPLAY_AD_POSITION;
}

export function getTwoPanelOrder(value: unknown): readonly ['ad', 'game'] | readonly ['game', 'ad'] {
  return normalizeTwoPanelAdPosition(value) === 'end'
    ? ['game', 'ad']
    : ['ad', 'game'];
}

export function getTwoPanelAdIndex(cursor: number, playlistLength: number): number {
  if (playlistLength <= 0 || !Number.isFinite(cursor)) return 0;
  return Math.max(0, Math.floor(cursor)) % playlistLength;
}
