// Pi Agent - Main entry point

import { loadConfig } from './config-store.js';
import { loadIdentity, generateIdentity } from './identity.js';
import { setupSocketClient } from './socket-client.js';
import { startHeartbeat } from './heartbeat.js';
import { startLocalApi } from './local-api.js';
import { startCaptivePortal } from './captive-portal.js';
import { UpdateManager } from './update-manager.js';
import { OfflineMode } from './offline-mode.js';

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
  const offlineMode = new OfflineMode(config);

  // Setup Socket.IO client
  const socketClient = setupSocketClient(identity, config, updateManager);

  // Start heartbeat
  const heartbeatStop = startHeartbeat(socketClient, identity);

  // Start local API server
  startLocalApi(identity, config, socketClient, updateManager, offlineMode);

  // Start captive portal if in setup mode
  if (config.mode === 'setup') {
    console.log('Starting captive portal for setup...');
    startCaptivePortal(config);
  }

  console.log('='.repeat(50));
  console.log('Agent started successfully');
  console.log('Press Ctrl+C to stop');

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down agent...');
    heartbeatStop();
    socketClient.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down agent...');
    heartbeatStop();
    socketClient.disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
