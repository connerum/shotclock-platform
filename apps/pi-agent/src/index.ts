// Pi Agent - Main entry point

import { loadConfig, saveConfig } from './config-store.js';
import { loadIdentity, generateIdentity, isPaired } from './identity.js';
import { setupSocketClient, startPairingReconciliation } from './socket-client.js';
import { startHeartbeat } from './heartbeat.js';
import { startLocalApi } from './local-api.js';
import { startCaptivePortal, stopCaptivePortal } from './captive-portal.js';
import { UpdateManager } from './update-manager.js';
import { OfflineMode } from './offline-mode.js';
import { setupAP } from './setup-ap.js';
import { saveState } from './state-store.js';
import { getPairingCode, regeneratePairingCode } from './pairing-code.js';

const AGENT_VERSION = '0.1.0';

async function main() {
  console.log(`Shotclock Pi Agent v${AGENT_VERSION}`);
  console.log('='.repeat(50));

  // Load or generate identity
  let identity = loadIdentity();
  if (!identity) {
    console.log('Generating new device identity...');
    identity = generateIdentity();
  }
  console.log(`Device ID: ${identity.deviceId}`);
  console.log(`Device Name: ${identity.deviceName}`);

  // Load configuration
  const config = loadConfig();
  console.log(`Server URL: ${config.serverUrl}`);
  console.log(`Mode: ${config.mode}`);

  // Initialize update manager
  const updateManager = new UpdateManager(identity.deviceId, config);

  // Initialize offline mode
  const offlineMode = new OfflineMode();

  // Check if device is paired
  const paired = isPaired();
  
  if (!paired && config.mode === 'setup') {
    console.log('Device not paired and WiFi not configured - entering setup mode');

    const pairingCode = regeneratePairingCode();
    console.log(`Pairing code: ${pairingCode.code} (expires in 24 hours)`);
    saveConfig({ mode: 'setup' });
    saveState({ mode: { type: 'setup' } });

    const setupApSuffix = identity.deviceId.replace(/^shotclock-/, '').substring(0, 6);
    const setupApConfig = {
      apSsid: `${config.setupApSsid}-${setupApSuffix}`,
      apPassword: config.setupApPassword,
    };

    setupAP.updateConfig(setupApConfig);

    // Start setup AP
    const apStarted = await setupAP.start();
    
    if (apStarted) {
      // Start captive portal for WiFi setup
      const portalStarted = await startCaptivePortal(setupApConfig);
      if (!portalStarted) {
        throw new Error('Captive portal failed to start on port 8080');
      }

      console.log('Setup AP started - waiting for WiFi configuration...');
    } else {
      throw new Error('Setup AP failed to start; check hostapd, dnsmasq, and wlan0 logs');
    }
  } else if (!paired) {
    console.log('Device has WiFi configured but is not paired - entering pairing mode');

    const pairingCode = getPairingCode();
    console.log(`Pairing code: ${pairingCode?.code || 'unavailable'} (expires in 24 hours)`);
    saveConfig({ mode: 'pairing' });
    saveState({ mode: { type: 'pairing' } });
  } else {
    // Device is paired - connect to server
    console.log('Device is paired - connecting to server...');
    
    // Update mode to online
    saveConfig({ mode: 'online' });
    saveState({ mode: { type: 'shot-clock' } });
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
