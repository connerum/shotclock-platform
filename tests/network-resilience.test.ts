import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('connectivity banner makes offline and maintenance states visible', async () => {
  const banner = await readFile(
    new URL('../apps/pi-kiosk/src/components/ConnectivityBanner.tsx', import.meta.url),
    'utf8'
  );

  assert.match(banner, /connectivity\.status === 'online'\) return null/);
  assert.match(banner, /'OFFLINE'/);
  assert.match(banner, /'SHOWING SAVED CONTENT'/);
  assert.match(banner, /'NETWORK SETUP'/);
  assert.match(banner, /setupAp\?\.apSsid/);
  assert.match(banner, /z-50/);
});

test('emergency presentations remain higher priority than network status', async () => {
  const app = await readFile(new URL('../apps/pi-kiosk/src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /hidden=\{isEmergencyOverlay/);
  assert.match(app, /<PresentationOverlay[^]*<ConnectivityBanner/);
  assert.match(app, /currentMode === 'setup'[^]*status: 'setup'/);
});

test('maintenance AP periodically retries saved WiFi without interrupting an active technician', async () => {
  const recovery = await readFile(new URL('../apps/pi-agent/src/network-recovery.ts', import.meta.url), 'utf8');
  const wifiManager = await readFile(new URL('../apps/pi-agent/src/wifi-manager.ts', import.meta.url), 'utf8');
  const setupAp = await readFile(new URL('../apps/pi-agent/src/setup-ap.ts', import.meta.url), 'utf8');

  assert.match(recovery, /MAINTENANCE_WIFI_RETRY_INTERVAL_MS/);
  assert.match(recovery, /setupAP\.hasConnectedClients\(\)/);
  assert.match(recovery, /wifiManager\.reconnectSavedWifi\(\)/);
  assert.match(recovery, /Saved WiFi is still unavailable; restoring maintenance AP/);
  assert.match(wifiManager, /nmcli', \['device', 'connect', this\.iface\]/);
  assert.match(setupAp, /'station', 'dump'/);
});

test('automatic recovery preserves the last display mode and records connectivity separately', async () => {
  const setupMode = await readFile(new URL('../apps/pi-agent/src/setup-mode.ts', import.meta.url), 'utf8');
  const recovery = await readFile(new URL('../apps/pi-agent/src/network-recovery.ts', import.meta.url), 'utf8');

  assert.match(setupMode, /options: \{ preserveDisplay\?: boolean \}/);
  assert.match(recovery, /preserveDisplay: true/);
  assert.match(recovery, /status: 'offline'/);
  assert.match(recovery, /status: 'setup'/);
});
