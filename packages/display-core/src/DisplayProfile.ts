// Display Profile - controller-agnostic display configuration

import type { ControllerType, DisplayProfile, Viewport, SafeZone, FontSizeConfig, ColorConfig } from '@shotclock/shared/types';

export interface DisplayProfileOptions {
  id?: string;
  name?: string;
  controllerType?: ControllerType;
  viewport?: Partial<Viewport>;
  safeZone?: Partial<SafeZone>;
  fontSize?: Partial<FontSizeConfig>;
  colors?: Partial<ColorConfig>;
}

export const DEFAULT_VIEWPORT: Viewport = {
  x: 960,
  y: 640,
  width: 256,
  height: 192,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};

export const DEFAULT_SAFE_ZONE: SafeZone = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};

export const DEFAULT_FONT_SIZE: FontSizeConfig = {
  shotClock: 92,
  gameClock: 28,
  score: 28,
  period: 14,
  label: 10,
};

export const DEFAULT_COLORS: ColorConfig = {
  background: '#000000',
  foreground: '#ffffff',
  accent: '#00ff00',
  homeTeam: '#ff0000',
  awayTeam: '#0000ff',
  warning: '#ffff00',
  danger: '#ff0000',
};

export const DEFAULT_CONTROLLER_PROFILES: Record<ControllerType, DisplayProfile> = {
  'generic': {
    id: 'default-generic',
    name: 'Default Generic Display',
    controllerType: 'generic',
    viewport: DEFAULT_VIEWPORT,
    safeZone: DEFAULT_SAFE_ZONE,
    fontSize: DEFAULT_FONT_SIZE,
    colors: DEFAULT_COLORS,
  },
  'xbox-controller': {
    id: 'default-xbox',
    name: 'Xbox Controller Display',
    controllerType: 'xbox-controller',
    viewport: { ...DEFAULT_VIEWPORT },
    safeZone: DEFAULT_SAFE_ZONE,
    fontSize: DEFAULT_FONT_SIZE,
    colors: { ...DEFAULT_COLORS, accent: '#107c10' },
  },
  'playstation-controller': {
    id: 'default-playstation',
    name: 'PlayStation Controller Display',
    controllerType: 'playstation-controller',
    viewport: { ...DEFAULT_VIEWPORT },
    safeZone: DEFAULT_SAFE_ZONE,
    fontSize: DEFAULT_FONT_SIZE,
    colors: { ...DEFAULT_COLORS, accent: '#003791' },
  },
  'custom': {
    id: 'default-custom',
    name: 'Custom Display',
    controllerType: 'custom',
    viewport: { ...DEFAULT_VIEWPORT },
    safeZone: DEFAULT_SAFE_ZONE,
    fontSize: DEFAULT_FONT_SIZE,
    colors: DEFAULT_COLORS,
  },
};

export function getDefaultProfile(controllerType: ControllerType): DisplayProfile {
  return DEFAULT_CONTROLLER_PROFILES[controllerType] || DEFAULT_CONTROLLER_PROFILES['generic'];
}

export function createDisplayProfile(options: DisplayProfileOptions): DisplayProfile {
  const controllerType = options.controllerType || 'generic';
  const baseProfile = getDefaultProfile(controllerType);
  
  return {
    id: options.id || baseProfile.id,
    name: options.name || baseProfile.name,
    controllerType,
    viewport: { ...baseProfile.viewport, ...options.viewport },
    safeZone: { ...baseProfile.safeZone, ...options.safeZone },
    fontSize: { ...baseProfile.fontSize, ...options.fontSize },
    colors: { ...baseProfile.colors, ...options.colors },
  };
}

export function getControllerTypeDefaults(controllerType: ControllerType): DisplayProfile {
  return getDefaultProfile(controllerType);
}
