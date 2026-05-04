// Device socket event handlers

import type { TypedSocket, TypedServer } from '../server.js';
import type { HelloPayload, HeartbeatPayload, UpdateStatusPayload } from '@shotclock/shared/types';

export function setupDeviceHandlers(socket: TypedSocket, io: TypedServer): void {
  // Handle device hello
  socket.on('device:hello', async (data: HelloPayload) => {
    console.log('Device hello:', data.deviceId, data.deviceName);
    
    // Acknowledge hello
    socket.emit('device:config:ack', { success: true });
    
    // Store device info in socket data
    socket.data.deviceId = data.deviceId;
    socket.data.deviceName = data.deviceName;
    socket.data.firmwareVersion = data.firmwareVersion;
  });

  // Handle device heartbeat
  socket.on('device:heartbeat', async (data: HeartbeatPayload) => {
    console.log('Device heartbeat:', data.deviceId, data.mode);
    
    // Broadcast to admins
    const adminNamespace = io.of('/admin');
    adminNamespace.emit('admin:device-status', {
      deviceId: data.deviceId,
      mode: data.mode,
      status: data,
      timestamp: Date.now(),
    });
  });

  // Handle state acknowledgment
  socket.on('device:state:ack', (data: { success: boolean; error?: string }) => {
    if (!data.success) {
      console.error('Device state ack error:', data.error);
    }
  });

  // Handle config acknowledgment
  socket.on('device:config:ack', (data: { success: boolean; error?: string }) => {
    if (!data.success) {
      console.error('Device config ack error:', data.error);
    }
  });

  // Handle update status
  socket.on('device:update:status', (data: UpdateStatusPayload) => {
    console.log('Device update status:', data.deviceId, data.status, data.progress);
    
    // Broadcast to admins
    const adminNamespace = io.of('/admin');
    adminNamespace.emit('admin:update-status', {
      deviceId: data.deviceId,
      status: data,
      timestamp: Date.now(),
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Device disconnected:', socket.id, socket.data.deviceId);
    
    // Broadcast to admins
    const adminNamespace = io.of('/admin');
    if (socket.data.deviceId) {
      adminNamespace.emit('admin:device-offline', {
        deviceId: socket.data.deviceId,
        timestamp: Date.now(),
      });
    }
  });
}
