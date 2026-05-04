// Admin socket event handlers

import type { TypedServer } from '../server.js';
import { Socket } from 'socket.io';
import { 
  emitStateUpdate, 
  emitConfigUpdate, 
  emitModeSet, 
  emitUpdateCheck, 
  emitUpdateInstall, 
  emitReboot, 
  emitPing 
} from '../emitters/to-device.js';

export function setupAdminHandlers(socket: Socket, io: TypedServer): void {
  // Handle admin requesting device list
  socket.on('admin:get-devices', async () => {
    const deviceNamespace = io.of('/device');
    const devices: any[] = [];
    
    deviceNamespace.sockets.forEach((devSocket) => {
      devices.push({
        socketId: devSocket.id,
        deviceId: (devSocket as any).data.deviceId,
        deviceName: (devSocket as any).data.deviceName,
        firmwareVersion: (devSocket as any).data.firmwareVersion,
      });
    });
    
    socket.emit('admin:device-list', devices);
  });

  // Handle admin sending command to device
  socket.on('admin:send-command', async (data: {
    deviceId: string;
    command: string;
    payload?: any;
  }) => {
    console.log('Admin command to device:', data.deviceId, data.command);
    
    let success = false;
    
    switch (data.command) {
      case 'state:update':
        success = emitStateUpdate(io, data.deviceId, data.payload);
        break;
      case 'config:update':
        success = emitConfigUpdate(io, data.deviceId, data.payload);
        break;
      case 'mode:set':
        success = emitModeSet(io, data.deviceId, data.payload);
        break;
      case 'update:check':
        success = emitUpdateCheck(io, data.deviceId);
        break;
      case 'update:install':
        success = emitUpdateInstall(io, data.deviceId, data.payload?.version);
        break;
      case 'reboot':
        success = emitReboot(io, data.deviceId);
        break;
      case 'ping':
        success = emitPing(io, data.deviceId);
        break;
    }
    
    socket.emit('admin:command-sent', {
      deviceId: data.deviceId,
      command: data.command,
      success,
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Admin disconnected:', socket.id);
  });
}
