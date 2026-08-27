import {
  THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  THREE_PANEL_SPORTS_ADS_CAPABILITY,
  TWO_PANEL_SPORTS_AD_CAPABILITY,
} from '@shotclock/shared/types';

export const ADVERTISED_DEVICE_CAPABILITIES = [
  'basketball',
  'wrestling',
  'volleyball',
  'pitchkount',
  'shot-clock',
  'scoreboard',
  'timer',
  'media',
  'presentation',
  THREE_PANEL_SPORTS_ADS_CAPABILITY,
  THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  TWO_PANEL_SPORTS_AD_CAPABILITY,
] as const;
