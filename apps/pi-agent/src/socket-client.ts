// Socket Client - Socket.IO client connecting to central server

import { io, Socket } from 'socket.io-client';
import type { DeviceIdentity } from './identity.js';
import type { AgentConfig } from './config-store.js';
import type { ServerToDeviceEvents, HelloPayload, HeartbeatPayload, PairingResponse, DeviceCommandAck } from '@shotclock/shared/types';
import { loadIdentity, markAsPaired, isPaired } from './identity.js';
import { loadState, saveState, setConfigPreview } from './state-store.js';
import { saveConfig } from './config-store.js';
import { getPairingCode, clearPairingCode } from './pairing-code.js';
import type { UpdateManager } from './update-manager.js';
import { finishFactoryResetAndReboot, prepareFactoryReset, rebootSystem } from './factory-reset.js';

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
  socket.on('state:update', (state, ack) => {
    console.log('Received state update');
    try {
      saveState({ mode: { type: 'shot-clock' }, timerState: state });
      acknowledge(ack, { success: true });
      sendStateAck(true);
    } catch (error) {
      console.error('Failed to apply state update:', error);
      const message = error instanceof Error ? error.message : String(error);
      acknowledge(ack, { success: false, error: message });
      sendStateAck(false, message);
    }
  });

  // Handle config update from server
  socket.on('config:update', (configUpdate, ack) => {
    console.log('Received config update');
    try {
      const nextConfig = {
        displayProfile: configUpdate.displayProfile,
        ...(configUpdate.calibrationData && { calibrationData: configUpdate.calibrationData }),
      };

      if (configUpdate.preview) {
        setConfigPreview(nextConfig);
      } else {
        saveState(nextConfig);
      }
      acknowledge(ack, { success: true });
      sendConfigAck(true);
    } catch (error) {
      console.error('Failed to apply config update:', error);
      const message = error instanceof Error ? error.message : String(error);
      acknowledge(ack, { success: false, error: message });
      sendConfigAck(false, message);
    }
  });

  // Handle mode set from server
  socket.on('mode:set', (mode, ack) => {
    console.log('Received mode set:', mode);
    try {
      saveState({ mode });
      acknowledge(ack, { success: true });
      sendStateAck(true);
    } catch (error) {
      console.error('Failed to apply mode set:', error);
      const message = error instanceof Error ? error.message : String(error);
      acknowledge(ack, { success: false, error: message });
      sendStateAck(false, message);
    }
  });

  socket.on('pairing:complete', (payload, ack) => {
    applyPairingComplete(payload);
    acknowledge(ack, { success: true });
  });

  // Handle update check
  socket.on('update:check', async (ack) => {
    console.log('Received update check request');
    acknowledge(ack, { success: true });
    try {
      await updateManager.checkForUpdates();
    } catch (error) {
      console.error('Update check failed:', error);
    }
  });

  // Handle update install
  socket.on('update:install', async (version: string, ack) => {
    console.log('Received update install request for version:', version);
    acknowledge(ack, { success: true });
    try {
      await updateManager.installUpdate(version);
    } catch (error) {
      console.error('Update install failed:', error);
    }
  });

  socket.on('factory:reset', async (ack) => {
    console.log('Received factory reset command');
    try {
      await prepareFactoryReset();
      acknowledge(ack, { success: true });
      finishFactoryResetAndReboot();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Factory reset failed:', error);
      acknowledge(ack, { success: false, error: message });
    }
  });

  // Handle reboot command
  socket.on('reboot', (ack) => {
    console.log('Received reboot command');
    acknowledge(ack, { success: true });
    setTimeout(() => {
      void rebootSystem();
    }, 500);
  });

  // Handle ping
  socket.on('ping', (ack) => {
    console.log('Received ping');
    acknowledge(ack, { success: true });
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

function acknowledge(
  ack: ((response: DeviceCommandAck) => void) | undefined,
  response: DeviceCommandAck
): void {
  if (ack) ack(response);
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
      const response = await fetch(`${serverUrl}/api/device-status/${identity.deviceId}/pairing`, {
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
          isPaired?: boolean;
        };
      };
      const device = data.device;

      if (
        device?.deviceId === identity.deviceId &&
        (device.isPaired || device.status === 'paired' || device.mode === 'shot-clock')
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
