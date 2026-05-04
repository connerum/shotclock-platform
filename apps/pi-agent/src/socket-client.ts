// Socket Client - Socket.IO client connecting to central server

import { io, Socket } from 'socket.io-client';
import type { DeviceIdentity } from './identity.js';
import type { AgentConfig } from './config-store.js';
import type { DeviceToServerEvents, ServerToDeviceEvents, HelloPayload, HeartbeatPayload } from '@shotclock/shared/types';
import { loadState, saveState } from './state-store.js';
import type { UpdateManager } from './update-manager.js';

export type TypedSocket = Socket<ServerToDeviceEvents, DeviceToServerEvents>;

let socket: TypedSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

export function setupSocketClient(
  identity: DeviceIdentity,
  config: AgentConfig,
  updateManager: UpdateManager
): TypedSocket {
  const serverUrl = config.serverUrl;
  
  console.log(`Connecting to server: ${serverUrl}`);
  
  socket = io(serverUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  }) as TypedSocket;

  // Handle connection
  socket.on('connect', () => {
    console.log('Connected to server');
    reconnectAttempts = 0;
    
    // Send hello
    sendHello(identity);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
  });

  // Handle reconnect
  socket.on('reconnect', (attempt) => {
    console.log('Reconnected after', attempt, 'attempts');
    sendHello(identity);
  });

  // Handle reconnect error
  socket.on('reconnect_error', (error) => {
    console.error('Reconnection error:', error);
    reconnectAttempts++;
  });

  // Handle state update from server
  socket.on('state:update', (state) => {
    console.log('Received state update');
    saveState({ timerState: state });
  });

  // Handle config update from server
  socket.on('config:update', (config) => {
    console.log('Received config update');
    saveState({ config });
  });

  // Handle mode set from server
  socket.on('mode:set', (mode) => {
    console.log('Received mode set:', mode);
    saveState({ mode });
  });

  // Handle update check
  socket.on('update:check', async () => {
    console.log('Received update check request');
    await updateManager.checkForUpdates();
  });

  // Handle update install
  socket.on('update:install', async (version) => {
    console.log('Received update install request for version:', version);
    await updateManager.installUpdate(version);
  });

  // Handle reboot command
  socket.on('reboot', () => {
    console.log('Received reboot command');
    // In production, would execute system reboot
    process.exit(0);
  });

  // Handle ping
  socket.on('ping', () => {
    console.log('Received ping');
    if (socket) {
      socket.emit('pong');
    }
  });

  return socket;
}

function sendHello(identity: DeviceIdentity): void {
  if (!socket) return;
  
  const state = loadState();
  
  const hello: HelloPayload = {
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    firmwareVersion: identity.firmwareVersion,
    controllerType: identity.controllerType,
    capabilities: ['shot-clock', 'scoreboard', 'timer', 'media'],
    displayProfile: state.displayProfile,
    timestamp: Date.now(),
  };
  
  socket.emit('device:hello', hello);
}

export function sendHeartbeat(identity: DeviceIdentity): void {
  if (!socket || !socket.connected) return;
  
  const state = loadState();
  
  const heartbeat: HeartbeatPayload = {
    deviceId: identity.deviceId,
    mode: state.mode,
    displayState: {
      mode: state.mode,
      timerState: state.timerState,
      calibrationData: state.calibrationData,
    },
    networkStatus: {
      ssid: undefined,
      signalStrength: 100,
      ipAddress: undefined,
      isConnected: true,
    },
    timestamp: Date.now(),
  };
  
  socket.emit('device:heartbeat', heartbeat);
}

export function sendStateAck(success: boolean, error?: string): void {
  if (!socket) return;
  socket.emit('device:state:ack', { success, error });
}

export function sendConfigAck(success: boolean, error?: string): void {
  if (!socket) return;
  socket.emit('device:config:ack', { success, error });
}

export function sendUpdateStatus(status: any): void {
  if (!socket) return;
  socket.emit('device:update:status', status);
}

export function getSocket(): TypedSocket | null {
  return socket;
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}
