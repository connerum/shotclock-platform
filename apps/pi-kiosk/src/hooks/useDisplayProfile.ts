// useDisplayProfile hook - Applies viewport transform via CSS variables

import { useMemo } from 'react';
import type { DisplayProfile } from '@shotclock/shared/types';

interface UseDisplayProfileResult {
  profile: DisplayProfile | null;
  cssVariables: Record<string, string>;
  transform: string;
}

export function useDisplayProfile(profile?: DisplayProfile | null): UseDisplayProfileResult {
  const result = useMemo(() => {
    if (!profile) {
      // Return default profile CSS
      const defaultCssVariables: Record<string, string> = {
        '--viewport-x': '0',
        '--viewport-y': '0',
        '--viewport-width': '1920',
        '--viewport-height': '1080',
        '--viewport-rotation': '0',
        '--viewport-scale-x': '1',
        '--viewport-scale-y': '1',
        '--safe-zone-top': '40',
        '--safe-zone-right': '40',
        '--safe-zone-bottom': '40',
        '--safe-zone-left': '40',
        '--font-shot-clock': '200',
        '--font-game-clock': '120',
        '--font-score': '150',
        '--font-period': '80',
        '--font-label': '40',
        '--color-background': '#000000',
        '--color-foreground': '#ffffff',
        '--color-accent': '#00ff00',
        '--color-home-team': '#ff0000',
        '--color-away-team': '#0000ff',
        '--color-warning': '#ffff00',
        '--color-danger': '#ff0000',
      };

      return {
        profile: null,
        cssVariables: defaultCssVariables,
        transform: 'translate(0px, 0px) scale(1, 1) rotate(0deg)',
      };
    }

    const cssVariables: Record<string, string> = {
      '--viewport-x': String(profile.viewport.x),
      '--viewport-y': String(profile.viewport.y),
      '--viewport-width': String(profile.viewport.width),
      '--viewport-height': String(profile.viewport.height),
      '--viewport-rotation': String(profile.viewport.rotation),
      '--viewport-scale-x': String(profile.viewport.scaleX),
      '--viewport-scale-y': String(profile.viewport.scaleY),
      '--safe-zone-top': String(profile.safeZone.top),
      '--safe-zone-right': String(profile.safeZone.right),
      '--safe-zone-bottom': String(profile.safeZone.bottom),
      '--safe-zone-left': String(profile.safeZone.left),
      '--font-shot-clock': String(profile.fontSize.shotClock),
      '--font-game-clock': String(profile.fontSize.gameClock),
      '--font-score': String(profile.fontSize.score),
      '--font-period': String(profile.fontSize.period),
      '--font-label': String(profile.fontSize.label),
      '--color-background': profile.colors.background,
      '--color-foreground': profile.colors.foreground,
      '--color-accent': profile.colors.accent,
      '--color-home-team': profile.colors.homeTeam,
      '--color-away-team': profile.colors.awayTeam,
      '--color-warning': profile.colors.warning,
      '--color-danger': profile.colors.danger,
    };

    const transform = `translate(${profile.viewport.x}px, ${profile.viewport.y}px) scale(${profile.viewport.scaleX}, ${profile.viewport.scaleY}) rotate(${profile.viewport.rotation}deg)`;

    return {
      profile,
      cssVariables,
      transform,
    };
  }, [profile]);

  return result;
}
