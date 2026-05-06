import type { DeviceIdentity } from './identity.js';
import type { AgentConfig } from './config-store.js';
import { saveConfig } from './config-store.js';
import { setupAP } from './setup-ap.js';
import { startCaptivePortal } from './captive-portal.js';
import { saveState } from './state-store.js';

export function getSetupApConfig(identity: DeviceIdentity, config: AgentConfig) {
  const setupApSuffix = identity.deviceId.replace(/^shotclock-/, '').substring(0, 6);
  return {
    apSsid: `${config.setupApSsid}-${setupApSuffix}`,
    apPassword: config.setupApPassword,
  };
}

export async function enterWifiSetupMode(
  identity: DeviceIdentity,
  config: AgentConfig,
  reason: string
): Promise<void> {
  console.log(`Entering WiFi setup mode: ${reason}`);
  saveConfig({ mode: 'setup' });
  saveState({ mode: { type: 'setup' } });

  const setupApConfig = getSetupApConfig(identity, config);
  setupAP.updateConfig(setupApConfig);

  const apStarted = await setupAP.start();
  if (!apStarted) {
    throw new Error('Setup AP failed to start; check hostapd, dnsmasq, and wlan0 logs');
  }

  const portalStarted = await startCaptivePortal(setupApConfig);
  if (!portalStarted) {
    throw new Error('Captive portal failed to start on port 8080');
  }

  console.log('Setup AP started - waiting for WiFi configuration...');
}
