// Pi Agent - Main entry point

import { loadConfig, saveConfig } from './config-store.js';
import { loadIdentity, generateIdentity, isPaired } from './identity.js';
import { setupSocketClient } from './socket-client.js';
import { startHeartbeat } from './heartbeat.js';
import { startLocalApi } from './local-api.js';
import { startCaptivePortal, stopCaptivePortal } from './captive-portal.js';
import { UpdateManager } from './update-manager.js';
import { OfflineMode } from './offline-mode.js';
import { setupAP } from './setup-ap.js';

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

  // Setup Socket.IO client
  const socketClient = setupSocketClient(identity, config, updateManager);

  // Start heartbeat
  const heartbeatStop = startHeartbeat();

  // Check if device is paired
  const paired = isPaired();
  
  if (!paired) {
    // Enter setup mode
    console.log('Device not paired - entering setup mode');
    
    // Generate pairing code
    const { regeneratePairingCode } = await import('./pairing-code.js');
    const pairingCode = regeneratePairingCode();
    console.log(`Pairing code: ${pairingCode.code} (expires in 10 minutes)`);
    
    // Update config to setup mode
    saveConfig({ mode: 'setup' });
    
    // Start setup AP
    await setupAP.start();
    
    // Start captive portal for WiFi setup
    startCaptivePortal({
      apSsid: `${config.setupApSsid}-${identity.deviceId.substring(0, 6)}`,
      apPassword: config.setupApPassword,
    });
    
    console.log('Setup AP started - waiting for WiFi configuration...');
  } else {
    // Device is paired - connect to server
    console.log('Device is paired - connecting to server...');
    
    // Update mode to online
    saveConfig({ mode: 'online' });
  }

  // Start local API server
  startLocalApi(identity, config, socketClient, updateManager, offlineMode);

  console.log('='.repeat(50));
  console.log('Agent started successfully');
  console.log('Press Ctrl+C to stop');

  // Handle shutdown
  const cleanup = async () => {
    console.log('\nShutting down agent...');
    heartbeatStop();
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
