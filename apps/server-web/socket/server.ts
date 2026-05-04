// Socket.IO server setup

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { ServerToDeviceEvents, DeviceToServerEvents } from '@shotclock/shared/socket';
import { setupDeviceHandlers } from './handlers/device-handler.js';
import { setupAdminHandlers } from './handlers/admin-handler.js';

export type TypedServer = SocketIOServer<DeviceToServerEvents, ServerToDeviceEvents>;
export type TypedSocket = Socket<DeviceToServerEvents, ServerToDeviceEvents>;

export function setupSocketServer(io: SocketIOServer): void {
  console.log('Setting up Socket.IO server...');

  // Device namespace - for Pi agents
  const deviceNamespace = io.of('/device');
  
  deviceNamespace.on('connection', (socket: Socket) => {
    console.log('Device connected:', socket.id);
    setupDeviceHandlers(socket as TypedSocket, io);
  });

  // Admin namespace - for web dashboard
  const adminNamespace = io.of('/admin');
  
  adminNamespace.on('connection', (socket: Socket) => {
    console.log('Admin connected:', socket.id);
    setupAdminHandlers(socket as TypedSocket, io);
  });

  console.log('Socket.IO namespaces registered: /device, /admin');
}

// Helper to get all connected devices
export function getConnectedDevices(io: SocketIOServer): string[] {
  const devices: string[] = [];
  const deviceNamespace = io.of('/device');
  
  deviceNamespace.sockets.forEach((socket) => {
    devices.push(socket.id);
  });
  
  return devices;
}

// Helper to emit to a specific device
export function emitToDevice(
  io: SocketIOServer,
  deviceSocketId: string,
  event: keyof ServerToDeviceEvents,
  ...args: any[]
): void {
  const deviceNamespace = io.of('/device');
  const socket = deviceNamespace.sockets.get(deviceSocketId);
  
  if (socket) {
    socket.emit(event, ...args);
  }
}

// Broadcast to all admin sockets
export function broadcastToAdmins(
  io: SocketIOServer,
  event: string,
  ...args: any[]
): void {
  const adminNamespace = io.of('/admin');
  
  adminNamespace.sockets.forEach((socket) => {
    socket.emit(event, ...args);
  });
}
