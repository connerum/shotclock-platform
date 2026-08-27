import assert from 'node:assert/strict';
import test from 'node:test';
import { ADVERTISED_DEVICE_CAPABILITIES } from '../apps/pi-agent/src/capabilities';
import {
  THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  THREE_PANEL_SPORTS_ADS_CAPABILITY,
  TWO_PANEL_RESET_ADS_CAPABILITY,
  TWO_PANEL_SPORTS_AD_CAPABILITY,
} from '../packages/shared/src/types/index';

test('Pi registration and socket hello share every split-layout capability', () => {
  assert.equal(new Set(ADVERTISED_DEVICE_CAPABILITIES).size, ADVERTISED_DEVICE_CAPABILITIES.length);
  assert.equal(ADVERTISED_DEVICE_CAPABILITIES.includes(THREE_PANEL_SPORTS_ADS_CAPABILITY), true);
  assert.equal(ADVERTISED_DEVICE_CAPABILITIES.includes(THREE_PANEL_AD_BEHAVIORS_CAPABILITY), true);
  assert.equal(ADVERTISED_DEVICE_CAPABILITIES.includes(TWO_PANEL_SPORTS_AD_CAPABILITY), true);
  assert.equal(ADVERTISED_DEVICE_CAPABILITIES.includes(TWO_PANEL_RESET_ADS_CAPABILITY), true);
});
