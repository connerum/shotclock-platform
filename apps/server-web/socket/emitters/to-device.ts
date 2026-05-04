// Socket emitters for sending events to devices

import type { ServerToDeviceEvents } from '@shotclock/shared/socket';
import type { TypedServer } from '../server.js';
import type { TimerState, DisplayConfigPayload, DeviceMode } from '@shotclock/shared/types';

export function emitStateUpdate(io: TypedServer, deviceId: string, state: TimerState): boolean {
  try {
    io.to(`device:${deviceId}`).emit('state:update', state);
    return true;
  } catch (error) {
    console.error(`Failed to emit state:update to device ${deviceId}:`, error);
    return false;
  }
}

export function emitConfigUpdate(io: TypedServer, deviceId: string, config: DisplayConfigPayload): boolean {
  try {
    io.to(`device:${deviceId}`).emit('config:update', config);
    return true;
  } catch (error) {
    console.error(`Failed to emit config:update to device ${deviceId}:`, error);
    return false;
  }
}

export function emitModeSet(io: TypedServer, deviceId: string, mode: DeviceMode): boolean {
  try {
    io.to(`device:${deviceId}`).emit('mode:set', mode);
    return true;
  } catch (error) {
    console.error(`Failed to emit mode:set to device ${deviceId}:`, error);
    return false;
  }
}

export function emitUpdateCheck(io: TypedServer, deviceId: string): boolean {
  try {
    io.to(`device:${deviceId}`).emit('update:check');
    return true;
  } catch (error) {
    console.error(`Failed to emit update:check to device ${deviceId}:`, error);
    return false;
  }
}

export function emitUpdateInstall(io: TypedServer, deviceId: string, version: string): boolean {
  try {
    io.to(`device:${deviceId}`).emit('update:install', version);
    return true;
  } catch (error) {
    console.error(`Failed to emit update:install to device ${deviceId}:`, error);
    return false;
  }
}

export function emitReboot(io: TypedServer, deviceId: string): boolean {
  try {
    io.to(`device:${deviceId}`).emit('reboot');
    return true;
  } catch (error) {
    console.error(`Failed to emit reboot to device ${deviceId}:`, error);
    return false;
  }
}

export function emitPing(io: TypedServer, deviceId: string): boolean {
  try {
    io.to(`device:${deviceId}`).emit('ping');
    return true;
  } catch (error) {
    console.error(`Failed to emit ping to device ${deviceId}:`, error);
    return false;
  }
}

// Broadcast to all connected devices
export function broadcastToAllDevices(io: TypedServer, event: keyof ServerToDeviceEvents): number {
  const deviceNamespace = io.of('/device');
  let count = 0;
  
  deviceNamespace.sockets.forEach((socket) => {
    (socket as any).emit(event);
    count++;
  });
  
  return count;
}
