// Socket emitters for sending events to devices

import type { ServerToDeviceEvents } from '@shotclock/shared/socket';
import type { TypedServer } from '../server.js';
import type { TimerStatePayload, DisplayConfigPayload, DeviceMode } from '@shotclock/shared/types';

export function emitToDevice(
  io: TypedServer,
  deviceSocketId: string,
  event: keyof ServerToDeviceEvents,
  ...args: any[]
): boolean {
  const deviceNamespace = io.of('/device');
  const socket = deviceNamespace.sockets.get(deviceSocketId);
  
  if (socket) {
    (socket as any).emit(event, ...args);
    return true;
  }
  return false;
}

export function emitStateUpdate(
  io: TypedServer,
  deviceSocketId: string,
  state: TimerStatePayload
): boolean {
  return emitToDevice(io, deviceSocketId, 'state:update', state);
}

export function emitConfigUpdate(
  io: TypedServer,
  deviceSocketId: string,
  config: DisplayConfigPayload
): boolean {
  return emitToDevice(io, deviceSocketId, 'config:update', config);
}

export function emitModeSet(
  io: TypedServer,
  deviceSocketId: string,
  mode: DeviceMode
): boolean {
  return emitToDevice(io, deviceSocketId, 'mode:set', mode);
}

export function emitUpdateCheck(
  io: TypedServer,
  deviceSocketId: string
): boolean {
  return emitToDevice(io, deviceSocketId, 'update:check');
}

export function emitUpdateInstall(
  io: TypedServer,
  deviceSocketId: string,
  version: string
): boolean {
  return emitToDevice(io, deviceSocketId, 'update:install', version);
}

export function emitReboot(
  io: TypedServer,
  deviceSocketId: string
): boolean {
  return emitToDevice(io, deviceSocketId, 'reboot');
}

export function emitPing(
  io: TypedServer,
  deviceSocketId: string
): boolean {
  return emitToDevice(io, deviceSocketId, 'ping');
}

// Broadcast to all connected devices
export function broadcastToAllDevices(
  io: TypedServer,
  event: keyof ServerToDeviceEvents,
  ...args: any[]
): number {
  const deviceNamespace = io.of('/device');
  let count = 0;
  
  deviceNamespace.sockets.forEach((socket) => {
    (socket as any).emit(event, ...args);
    count++;
  });
  
  return count;
}
