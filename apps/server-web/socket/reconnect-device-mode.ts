import {
  THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  THREE_PANEL_SPORTS_ADS_CAPABILITY,
  type DeviceMode,
} from '@shotclock/shared/types';

/**
 * Returns the mode payload that a reconnecting display can safely consume.
 *
 * This intentionally adapts only the emitted copy. The stored mode remains the
 * source of truth so a board software update restores the user's selected ad
 * behavior without requiring them to configure it again.
 */
export function resolveReconnectDeviceMode(
  storedMode: DeviceMode | null,
  capabilities: readonly string[] | null | undefined
): DeviceMode | null {
  const layout = storedMode?.sportDisplayLayout;
  if (!storedMode || !layout) return storedMode;

  const advertisedCapabilities = new Set(
    Array.isArray(capabilities)
      ? capabilities.filter((capability): capability is string => typeof capability === 'string')
      : []
  );

  if (!advertisedCapabilities.has(THREE_PANEL_SPORTS_ADS_CAPABILITY)) {
    const { sportDisplayLayout: _unsupportedLayout, ...modeWithoutLayout } = storedMode;
    return modeWithoutLayout as DeviceMode;
  }

  if (!advertisedCapabilities.has(THREE_PANEL_AD_BEHAVIORS_CAPABILITY) && layout.adMode) {
    const { adMode: _unsupportedAdMode, ...legacyLayout } = layout;
    return {
      ...storedMode,
      sportDisplayLayout: legacyLayout,
    };
  }

  return storedMode;
}
