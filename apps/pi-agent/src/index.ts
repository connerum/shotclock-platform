// Pi Agent - Main entry point

import { loadConfig, saveConfig } from './config-store.js';
import { loadIdentity, generateIdentity, isPaired, ensureDeviceAuthToken } from './identity.js';
import { setupSocketClient, startPairingReconciliation } from './socket-client.js';
import { startHeartbeat } from './heartbeat.js';
import { startLocalApi } from './local-api.js';
import { RUNTIME_VERSION } from './runtime-version.js';
import { stopCaptivePortal } from './captive-portal.js';
import { UpdateManager } from './update-manager.js';
import { OfflineMode } from './offline-mode.js';
import { setupAP } from './setup-ap.js';
import { saveState } from './state-store.js';
import { getPairingCode, regeneratePairingCode } from './pairing-code.js';
import { wifiManager } from './wifi-manager.js';
import { enterWifiSetupMode } from './setup-mode.js';
import { startMaintenanceWifiRecovery, stopMaintenanceWifiRecovery } from './network-recovery.js';

const AGENT_VERSION = RUNTIME_VERSION;

async function main() {
  console.log(`Shotclock Pi Agent v${AGENT_VERSION}`);
  console.log('='.repeat(50));

  // Load or generate identity
  let identity = loadIdentity();
  if (!identity) {
    console.log('Generating new device identity...');
    identity = generateIdentity();
  }
  identity = ensureDeviceAuthToken(identity);
  console.log(`Device ID: ${identity.deviceId}`);
  console.log(`Device Name: ${identity.deviceName}`);

  // Load configuration
  const config = loadConfig();
  if (process.env.NODE_ENV === 'production' && (
    config.setupApPassword.length < 12
    || config.setupApPassword.length > 63
    || config.setupApPassword.startsWith('replace-')
    || config.setupApPassword.startsWith('development-')
  )) {
    throw new Error('SETUP_AP_PASSWORD must be a unique 12-63 character value in production');
  }
  console.log(`Server URL: ${config.serverUrl}`);
  console.log(`Mode: ${config.mode}`);

  // Initialize update manager
  const updateManager = new UpdateManager(identity.deviceId, config);

  // Initialize offline mode
  const offlineMode = new OfflineMode();

  // Check if device is paired
  const paired = isPaired();
  
  if (config.mode === 'setup') {
    const networkStatus = paired ? await wifiManager.getStatus() : null;

    if (paired && networkStatus?.connected && networkStatus.ip) {
      console.log('Device is paired and WiFi is connected; restoring online mode');
      saveConfig({ mode: 'online' });
      saveState({ connectivity: { status: 'online', since: Date.now() } });
    } else {
      console.log(paired
        ? 'Device is paired but WiFi setup is required - entering setup mode'
        : 'Device not paired and WiFi not configured - entering setup mode');

      if (!paired) {
        const pairingCode = regeneratePairingCode();
        console.log(`Pairing code: ${pairingCode.code} (expires in 24 hours)`);
      }
      await enterWifiSetupMode(identity, config, 'configured setup mode', { preserveDisplay: paired });
      if (paired) startMaintenanceWifiRecovery();
    }
  } else if (!paired) {
    console.log('Device has WiFi configured but is not paired - entering pairing mode');

    const pairingCode = getPairingCode();
    console.log(`Pairing code: ${pairingCode?.code || 'unavailable'} (expires in 24 hours)`);
    saveConfig({ mode: 'pairing' });
    saveState({ mode: { type: 'pairing' } });
  } else {
    const networkStatus = await wifiManager.getStatus();
    if (!networkStatus.connected || !networkStatus.ip) {
      console.log('Device is paired but WiFi is not connected - entering setup mode');
      await enterWifiSetupMode(identity, config, 'paired device has no WiFi connection', { preserveDisplay: true });
      startMaintenanceWifiRecovery();
    } else {
      // Device is paired - connect to server
      console.log('Device is paired - connecting to server...');

      // Update mode to online
      saveConfig({ mode: 'online' });
      saveState({ connectivity: { status: 'online', since: Date.now() } });
    }
  }

  // Setup Socket.IO client after local setup state is established so hello
  // includes the correct pairing code/mode on first connection.
  const socketClient = setupSocketClient(identity, config, updateManager);

  // Start heartbeat
  const heartbeatStop = startHeartbeat();
  const stopPairingReconciliation = startPairingReconciliation(identity, config);

  // Start local API server
  startLocalApi(identity, config, socketClient, updateManager, offlineMode);

  console.log('='.repeat(50));
  console.log('Agent started successfully');
  console.log('Press Ctrl+C to stop');

  // Handle shutdown
  const cleanup = async () => {
    console.log('\nShutting down agent...');
    heartbeatStop();
    stopPairingReconciliation();
    stopMaintenanceWifiRecovery();
    socketClient.disconnect();
    await setupAP.stop();
    stopCaptivePortal();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  // Handle unhandled errors
  process.on('uncaughtException', (error) => {
    console.error('Unhandled error:', error);
    cleanup();
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
