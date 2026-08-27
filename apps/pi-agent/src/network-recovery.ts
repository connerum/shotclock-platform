import { isPaired } from './identity.js';
import { loadConfig, saveConfig } from './config-store.js';
import { saveState } from './state-store.js';
import { wifiManager } from './wifi-manager.js';
import { loadIdentity } from './identity.js';
import { enterWifiSetupMode } from './setup-mode.js';
import { setupAP } from './setup-ap.js';
import { stopCaptivePortal } from './captive-portal.js';

const RECOVERY_TIMEOUT_MS = parseInt(process.env.NETWORK_RECOVERY_TIMEOUT_MS || '60000', 10);
const MAINTENANCE_WIFI_RETRY_INTERVAL_MS = parseInt(
  process.env.MAINTENANCE_WIFI_RETRY_INTERVAL_MS || '120000',
  10
);

let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let maintenanceRetryTimer: ReturnType<typeof setTimeout> | null = null;
let recoveryInProgress = false;
let maintenanceRetryInProgress = false;

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
  if (recoveryTimer) {
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }
  stopMaintenanceWifiRecovery();
  recoveryInProgress = false;
  if (isPaired() && loadConfig().mode === 'setup') {
    saveConfig({ mode: 'online' });
  }
  saveState({
    connectivity: {
      status: 'online',
      since: Date.now(),
    },
  });
  console.log('Network recovery cancelled; server connection restored');
}

export function startMaintenanceWifiRecovery(): void {
  if (maintenanceRetryTimer || maintenanceRetryInProgress || !isPaired()) return;

  maintenanceRetryTimer = setTimeout(() => {
    maintenanceRetryTimer = null;
    void retrySavedWifiFromMaintenanceAp();
  }, MAINTENANCE_WIFI_RETRY_INTERVAL_MS);
  console.log(`Saved WiFi recovery scheduled in ${MAINTENANCE_WIFI_RETRY_INTERVAL_MS}ms`);
}

export function stopMaintenanceWifiRecovery(): void {
  if (maintenanceRetryTimer) {
    clearTimeout(maintenanceRetryTimer);
    maintenanceRetryTimer = null;
  }
}

async function recoverToWifiSetup(): Promise<void> {
  if (recoveryInProgress || !isPaired()) return;

  const config = loadConfig();
  if (config.mode !== 'online') return;

  recoveryInProgress = true;
  console.warn('Server reconnect timed out; checking WiFi before entering setup recovery');

  try {
    const networkStatus = await wifiManager.getStatus();

    if (networkStatus.connected && networkStatus.ip) {
      console.warn(
        `Server is disconnected, but WiFi is still connected to ${networkStatus.ssid || 'unknown'} at ${networkStatus.ip}; keeping saved WiFi`
      );
      saveState({
        connectivity: {
          status: 'offline',
          since: Date.now(),
          reason: 'CourtCast server connection lost',
        },
      });
      recoveryInProgress = false;
      return;
    }

    console.warn('WiFi is disconnected or missing an IP; preserving saved profiles and starting the maintenance AP');
    saveConfig({ mode: 'setup' });
    const identity = loadIdentity();
    if (!identity) throw new Error('Device identity is unavailable');
    await enterWifiSetupMode(identity, config, 'automatic network recovery', { preserveDisplay: true });
    recoveryInProgress = false;
    startMaintenanceWifiRecovery();
  } catch (error) {
    recoveryInProgress = false;
    console.error('Network recovery failed:', error);
  }
}

async function retrySavedWifiFromMaintenanceAp(): Promise<void> {
  if (maintenanceRetryInProgress || !isPaired()) return;

  const config = loadConfig();
  if (config.mode !== 'setup') return;

  maintenanceRetryInProgress = true;
  try {
    if (await setupAP.hasConnectedClients()) {
      console.log('Maintenance AP has an active client; deferring saved WiFi recovery');
      return;
    }

    const savedProfiles = await wifiManager.getSavedWifiProfiles();
    if (savedProfiles.length === 0) {
      console.log('Maintenance AP will remain active because there are no saved WiFi profiles');
      return;
    }

    console.log('Temporarily stopping maintenance AP to retry saved WiFi');
    saveState({
      connectivity: {
        status: 'reconnecting',
        since: Date.now(),
        reason: 'Trying saved WiFi',
      },
    });
    await setupAP.stop();

    if (await wifiManager.reconnectSavedWifi()) {
      const status = await wifiManager.getStatus();
      console.log(`Recovered saved WiFi${status.ssid ? ` using ${status.ssid}` : ''}`);
      saveConfig({ mode: 'online' });
      saveState({
        connectivity: {
          status: 'online',
          since: Date.now(),
        },
      });
      stopCaptivePortal();
      const { reconnectSocketClient } = await import('./socket-client.js');
      reconnectSocketClient();
      return;
    }

    console.warn('Saved WiFi is still unavailable; restoring maintenance AP');
    saveState({
      connectivity: {
        status: 'setup',
        since: Date.now(),
        reason: 'Saved WiFi unavailable',
      },
    });
    const apStarted = await setupAP.start();
    if (!apStarted) {
      console.error('Maintenance AP could not be restored after saved WiFi retry');
    }
  } catch (error) {
    console.error('Maintenance WiFi retry failed:', error);
    saveState({
      connectivity: {
        status: 'setup',
        since: Date.now(),
        reason: 'Automatic WiFi retry failed',
      },
    });
    await setupAP.start().catch(() => false);
  } finally {
    maintenanceRetryInProgress = false;
    if (loadConfig().mode === 'setup') {
      startMaintenanceWifiRecovery();
    }
  }
}
