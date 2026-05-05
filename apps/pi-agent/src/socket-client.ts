// Socket Client - Socket.IO client connecting to central server

import { io, Socket } from 'socket.io-client';
import type { DeviceIdentity } from './identity.js';
import type { AgentConfig } from './config-store.js';
import type { ServerToDeviceEvents, HelloPayload, HeartbeatPayload, PairingResponse } from '@shotclock/shared/types';
import { loadIdentity, markAsPaired, isPaired } from './identity.js';
import { loadState, saveState } from './state-store.js';
import { saveConfig } from './config-store.js';
import { getPairingCode, clearPairingCode } from './pairing-code.js';
import type { UpdateManager } from './update-manager.js';

export type TypedSocket = Socket<ServerToDeviceEvents, DeviceToDeviceEvents>;

interface DeviceToDeviceEvents {
  'device:hello': (data: HelloPayload) => void;
  'device:heartbeat': (data: HeartbeatPayload) => void;
  'device:state:ack': (data: { success: boolean; error?: string }) => void;
  'device:config:ack': (data: { success: boolean; error?: string }) => void;
  'device:update:status': (data: { deviceId: string; status: string; progress?: number; version?: string; error?: string }) => void;
}

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
  
  socket = io(`${serverUrl.replace(/\/$/, '')}/device`, {
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
  socket.on('disconnect', (reason: string) => {
    console.log('Disconnected from server:', reason);
  });

  // Handle reconnect
  socket.on('reconnect' as any, (attempt: number) => {
    console.log('Reconnected after', attempt, 'attempts');
    sendHello(identity);
  });

  // Handle reconnect error
  socket.on('reconnect_error' as any, (error: Error) => {
    console.error('Reconnection error:', error);
    reconnectAttempts++;
  });

  // Handle state update from server
  socket.on('state:update', (state) => {
    console.log('Received state update');
    try {
      saveState({ mode: { type: 'shot-clock' }, timerState: state });
      sendStateAck(true);
    } catch (error) {
      console.error('Failed to apply state update:', error);
      sendStateAck(false, error instanceof Error ? error.message : String(error));
    }
  });

  // Handle config update from server
  socket.on('config:update', (configUpdate) => {
    console.log('Received config update');
    try {
      saveState({
        displayProfile: configUpdate.displayProfile,
        ...(configUpdate.calibrationData && { calibrationData: configUpdate.calibrationData }),
      });
      sendConfigAck(true);
    } catch (error) {
      console.error('Failed to apply config update:', error);
      sendConfigAck(false, error instanceof Error ? error.message : String(error));
    }
  });

  // Handle mode set from server
  socket.on('mode:set', (mode) => {
    console.log('Received mode set:', mode);
    try {
      saveState({ mode });
      sendStateAck(true);
    } catch (error) {
      console.error('Failed to apply mode set:', error);
      sendStateAck(false, error instanceof Error ? error.message : String(error));
    }
  });

  socket.on('pairing:complete', (payload) => {
    applyPairingComplete(payload);
  });

  // Handle update check
  socket.on('update:check', async () => {
    console.log('Received update check request');
    await updateManager.checkForUpdates();
  });

  // Handle update install
  socket.on('update:install', async (version: string) => {
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
      socket.emit('device:heartbeat', {
        deviceId: identity.deviceId,
        mode: { type: 'offline' },
        displayState: { mode: { type: 'offline' } },
        networkStatus: { signalStrength: 0, isConnected: false },
        timestamp: Date.now(),
      });
    }
  });

  return socket;
}

function sendHello(identity: DeviceIdentity): void {
  if (!socket) return;
  
  const currentIdentity = loadIdentity() || identity;
  const state = loadState();
  const pairingCode = currentIdentity.pairedAt ? null : getPairingCode();
  
  const hello: HelloPayload = {
    deviceId: currentIdentity.deviceId,
    deviceName: currentIdentity.deviceName,
    firmwareVersion: currentIdentity.firmwareVersion,
    controllerType: currentIdentity.controllerType,
    capabilities: ['shot-clock', 'scoreboard', 'timer', 'media'],
    displayProfile: state.displayProfile,
    pairingCode: pairingCode?.code,
    pairingCodeExpiresAt: pairingCode?.expiresAt,
    timestamp: Date.now(),
  };
  
  socket.emit('device:hello', hello);
}

export function startPairingReconciliation(identity: DeviceIdentity, config: AgentConfig): () => void {
  let stopped = false;
  let inFlight = false;

  const reconcile = async () => {
    if (stopped || inFlight || isPaired()) return;

    const currentState = loadState();
    if (currentState.mode.type !== 'pairing') return;

    inFlight = true;
    try {
      const serverUrl = config.serverUrl.replace(/\/$/, '');
      const response = await fetch(`${serverUrl}/api/devices/${identity.deviceId}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) return;

      const data = await response.json() as {
        device?: {
          deviceId: string;
          status?: string;
          mode?: string;
          organizationId?: string | null;
          venueId?: string | null;
          pairingCode?: string | null;
        };
      };
      const device = data.device;

      if (
        device?.deviceId === identity.deviceId &&
        (device.status === 'paired' || (!device.pairingCode && device.mode !== 'setup'))
      ) {
        applyPairingComplete({
          success: true,
          deviceId: device.deviceId,
          organizationId: device.organizationId || undefined,
          venueId: device.venueId || undefined,
          serverUrl,
        });
      }
    } catch (error) {
      console.warn('Pairing reconciliation failed:', error);
    } finally {
      inFlight = false;
    }
  };

  const interval = setInterval(() => {
    void reconcile();
  }, 5000);
  void reconcile();

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}

function applyPairingComplete(payload: PairingResponse): void {
  if (!payload.success) {
    console.error('Pairing failed:', payload.error);
    return;
  }

  console.log('Pairing complete');
  markAsPaired(payload.organizationId || 'unassigned', payload.venueId || 'unassigned');
  saveConfig({
    mode: 'online',
    ...(payload.serverUrl && { serverUrl: payload.serverUrl }),
    ...(payload.organizationId && { organizationId: payload.organizationId }),
    ...(payload.venueId && { venueId: payload.venueId }),
  });
  clearPairingCode();
  saveState({ mode: { type: 'shot-clock' } });
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

export function sendUpdateStatus(status: { deviceId: string; status: string; progress?: number; version?: string; error?: string }): void {
  if (!socket) return;
  socket.emit('device:update:status', status);
}

export function getSocket(): TypedSocket | null {
  return socket;
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}
