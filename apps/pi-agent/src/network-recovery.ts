import { isPaired } from './identity.js';
import { loadConfig, saveConfig } from './config-store.js';
import { saveState } from './state-store.js';
import { wifiManager } from './wifi-manager.js';
import { rebootSystem } from './factory-reset.js';

const RECOVERY_TIMEOUT_MS = parseInt(process.env.NETWORK_RECOVERY_TIMEOUT_MS || '60000', 10);

let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let recoveryInProgress = false;

export function scheduleNetworkRecovery(reason: string): void {
  if (recoveryTimer || recoveryInProgress || !isPaired()) return;

  const config = loadConfig();
  if (config.mode !== 'online') return;

  console.warn(`Network recovery scheduled in ${RECOVERY_TIMEOUT_MS}ms after disconnect: ${reason}`);
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    void recoverToWifiSetup();
  }, RECOVERY_TIMEOUT_MS);
}

export function clearNetworkRecovery(): void {
  if (!recoveryTimer) return;

  clearTimeout(recoveryTimer);
  recoveryTimer = null;
  console.log('Network recovery cancelled; server connection restored');
}

async function recoverToWifiSetup(): Promise<void> {
  if (recoveryInProgress || !isPaired()) return;

  const config = loadConfig();
  if (config.mode !== 'online') return;

  recoveryInProgress = true;
  console.warn('Server reconnect timed out; clearing saved WiFi and rebooting into setup AP');

  try {
    saveConfig({ mode: 'setup' });
    saveState({ mode: { type: 'setup' } });
    await wifiManager.forgetSavedWifiNetworks();
    await rebootSystem();
  } catch (error) {
    recoveryInProgress = false;
    console.error('Network recovery failed:', error);
  }
}
