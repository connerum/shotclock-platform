import assert from 'node:assert/strict';
import test from 'node:test';
import {
  THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  THREE_PANEL_SPORTS_ADS_CAPABILITY,
  TWO_PANEL_RESET_ADS_CAPABILITY,
  TWO_PANEL_SPORTS_AD_CAPABILITY,
  type DeviceMode,
} from '../packages/shared/src/types/index';
import { resolveReconnectDeviceMode } from '../apps/server-web/socket/reconnect-device-mode';

const ADVANCED_MODE: DeviceMode = {
  type: 'basketball',
  subMode: 'scoreboard',
  scoreboardBranding: { enabled: true, homeLabel: 'Home' },
  sportDisplayLayout: {
    type: 'three-panel',
    adMode: 'mirrored-timed',
    rotationIntervalMs: 8_000,
    adPlaylist: [
      { mediaUrl: 'https://cdn.example.test/ad-one.png', mediaMimeType: 'image/png' },
      { mediaUrl: 'https://cdn.example.test/ad-two.png', mediaMimeType: 'image/png' },
    ],
  },
};

const TWO_PANEL_MODE: DeviceMode = {
  type: 'volleyball',
  sportDisplayLayout: {
    type: 'two-panel',
    adPosition: 'end',
    rotationIntervalMs: 8_000,
    adPlaylist: [
      { mediaUrl: 'https://cdn.example.test/ad-one.png', mediaMimeType: 'image/png' },
    ],
  },
};

test('reconnect preserves an advanced ad behavior when the display advertises both capabilities', () => {
  assert.deepEqual(resolveReconnectDeviceMode(ADVANCED_MODE, [
    THREE_PANEL_SPORTS_ADS_CAPABILITY,
    THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  ]), ADVANCED_MODE);
});

test('reconnect falls back to legacy offset-timed behavior for a base-layout-only display', () => {
  const reconnectMode = resolveReconnectDeviceMode(ADVANCED_MODE, [
    THREE_PANEL_SPORTS_ADS_CAPABILITY,
  ]);

  assert.deepEqual(reconnectMode, {
    type: 'basketball',
    subMode: 'scoreboard',
    scoreboardBranding: { enabled: true, homeLabel: 'Home' },
    sportDisplayLayout: {
      type: 'three-panel',
      rotationIntervalMs: 8_000,
      adPlaylist: [
        { mediaUrl: 'https://cdn.example.test/ad-one.png', mediaMimeType: 'image/png' },
        { mediaUrl: 'https://cdn.example.test/ad-two.png', mediaMimeType: 'image/png' },
      ],
    },
  });
  assert.equal(ADVANCED_MODE.sportDisplayLayout?.adMode, 'mirrored-timed');
});

test('reconnect drops the three-panel layout when the display lacks its base capability', () => {
  assert.deepEqual(resolveReconnectDeviceMode(ADVANCED_MODE, [
    THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  ]), {
    type: 'basketball',
    subMode: 'scoreboard',
    scoreboardBranding: { enabled: true, homeLabel: 'Home' },
  });
});

test('reconnect leaves modes without a three-panel layout unchanged', () => {
  const fullBoardMode: DeviceMode = {
    type: 'wrestling',
    subMode: 'match',
  };

  assert.equal(resolveReconnectDeviceMode(fullBoardMode, undefined), fullBoardMode);
  assert.equal(resolveReconnectDeviceMode(null, [THREE_PANEL_SPORTS_ADS_CAPABILITY]), null);
});

test('reconnect preserves two-panel position when the display supports that layout', () => {
  assert.equal(resolveReconnectDeviceMode(TWO_PANEL_MODE, [
    TWO_PANEL_SPORTS_AD_CAPABILITY,
    TWO_PANEL_RESET_ADS_CAPABILITY,
  ]), TWO_PANEL_MODE);
});

test('reconnect drops a two-panel layout when its capability is missing', () => {
  assert.deepEqual(resolveReconnectDeviceMode(TWO_PANEL_MODE, [
    THREE_PANEL_SPORTS_ADS_CAPABILITY,
    THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
    TWO_PANEL_SPORTS_AD_CAPABILITY,
  ]), {
    type: 'volleyball',
  });
});
