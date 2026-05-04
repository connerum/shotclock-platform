// Admin socket event handlers

import type { TypedSocket, TypedServer } from '../server.js';
import { emitToDevice } from '../emitters/to-device.js';

export function setupAdminHandlers(socket: TypedSocket, io: TypedServer): void {
  // Handle admin requesting device list
  socket.on('admin:get-devices', async () => {
    const deviceNamespace = io.of('/device');
    const devices: any[] = [];
    
    deviceNamespace.sockets.forEach((devSocket) => {
      devices.push({
        socketId: devSocket.id,
        deviceId: devSocket.data.deviceId,
        deviceName: devSocket.data.deviceName,
        firmwareVersion: devSocket.data.firmwareVersion,
      });
    });
    
    socket.emit('admin:device-list', devices);
  });

  // Handle admin sending command to device
  socket.on('admin:send-command', async (data: {
    deviceSocketId: string;
    command: string;
    payload?: any;
  }) => {
    console.log('Admin command to device:', data.deviceSocketId, data.command);
    
    switch (data.command) {
      case 'state:update':
        emitToDevice(io, data.deviceSocketId, 'state:update', data.payload);
        break;
      case 'config:update':
        emitToDevice(io, data.deviceSocketId, 'config:update', data.payload);
        break;
      case 'mode:set':
        emitToDevice(io, data.deviceSocketId, 'mode:set', data.payload);
        break;
      case 'update:check':
        emitToDevice(io, data.deviceSocketId, 'update:check');
        break;
      case 'update:install':
        emitToDevice(io, data.deviceSocketId, 'update:install', data.payload.version);
        break;
      case 'reboot':
        emitToDevice(io, data.deviceSocketId, 'reboot');
        break;
      case 'ping':
        emitToDevice(io, data.deviceSocketId, 'ping');
        break;
    }
    
    socket.emit('admin:command-sent', {
      deviceSocketId: data.deviceSocketId,
      command: data.command,
      success: true,
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Admin disconnected:', socket.id);
  });
}
