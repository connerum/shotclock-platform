// Device socket event handlers with Prisma integration

import type { TypedSocket, TypedServer } from '../server.js';
import type { HelloPayload, HeartbeatPayload, UpdateStatusPayload } from '@shotclock/shared/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function setupDeviceHandlers(socket: TypedSocket, io: TypedServer): void {
  // Handle device hello
  socket.on('device:hello', async (data: HelloPayload) => {
    console.log('Device hello:', data.deviceId, data.deviceName);
    
    try {
      const existingDevice = await prisma.device.findUnique({
        where: { deviceId: data.deviceId },
      });

      const isPaired = isDevicePaired(existingDevice);
      const pairingCodeExp = data.pairingCodeExpiresAt
        ? new Date(data.pairingCodeExpiresAt)
        : data.pairingCode
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : undefined;

      // Update or create device in database
      const device = await prisma.device.upsert({
        where: { deviceId: data.deviceId },
        update: {
          name: data.deviceName,
          firmwareVersion: data.firmwareVersion,
          controllerType: data.controllerType,
          capabilities: JSON.stringify(data.capabilities || []),
          displayProfile: JSON.stringify(data.displayProfile),
          ...(data.pairingCode && !isPaired ? {
            pairingCode: data.pairingCode,
            pairingCodeExp,
            status: 'unpaired',
            mode: 'pairing',
          } : {}),
          isOnline: true,
          lastSeen: new Date(),
          ...(isPaired ? { status: 'paired' } : {}),
        },
        create: {
          deviceId: data.deviceId,
          name: data.deviceName,
          firmwareVersion: data.firmwareVersion,
          controllerType: data.controllerType,
          capabilities: JSON.stringify(data.capabilities || []),
          displayProfile: JSON.stringify(data.displayProfile),
          pairingCode: data.pairingCode || null,
          pairingCodeExp,
          mode: data.pairingCode ? 'pairing' : 'setup',
          isOnline: true,
          lastSeen: new Date(),
          status: data.pairingCode ? 'unpaired' : 'online',
        },
      });
      
      // Join device room for targeted messaging
      socket.join(`device:${data.deviceId}`);
      socket.data.deviceId = data.deviceId;
      socket.data.deviceName = data.deviceName;
      socket.data.firmwareVersion = data.firmwareVersion;
      
      // Send initial config to device after hello
      (socket as any).emit('config:update', {
        displayProfile: data.displayProfile,
      });

      if (isDevicePaired(device)) {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || 'http://localhost:3000';
        const payload = {
          success: true,
          deviceId: device.deviceId,
          organizationId: device.organizationId || undefined,
          venueId: device.venueId || undefined,
          serverUrl,
        };
        (socket as any).emit('pairing:complete', payload);
        (socket as any).emit('mode:set', { type: 'shot-clock' });
      }
    } catch (error) {
      console.error('Error handling device hello:', error);
    }
  });

  // Handle device heartbeat
  socket.on('device:heartbeat', async (data: HeartbeatPayload) => {
    console.log('Device heartbeat:', data.deviceId, data.mode);
    
    try {
      const existingDevice = await prisma.device.findUnique({
        where: { deviceId: data.deviceId },
      });
      const isPaired = isDevicePaired(existingDevice);
      const existingPairedMode = existingDevice?.mode && !['setup', 'pairing'].includes(existingDevice.mode)
        ? existingDevice.mode
        : 'shot-clock';
      const nextMode = isPaired && ['setup', 'pairing'].includes(data.mode.type)
        ? existingPairedMode
        : data.mode.type;

      // Update last seen and mode
      await prisma.device.update({
        where: { deviceId: data.deviceId },
        data: {
          lastSeen: new Date(),
          mode: nextMode,
          isOnline: true,
          status: isPaired ? 'paired' : 'online',
        },
      }).catch(() => {}); // Ignore if device doesn't exist
      
      // Broadcast to admins
      const adminNamespace = io.of('/admin') as any;
      adminNamespace.emit('admin:device-status', {
        deviceId: data.deviceId,
        mode: data.mode,
        status: data,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error handling heartbeat:', error);
    }
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
  socket.on('device:update:status', async (data: UpdateStatusPayload) => {
    console.log('Device update status:', data.deviceId, data.status, data.progress);
    
    try {
      // Find or create device update record
      const existingUpdate = await prisma.deviceUpdate.findFirst({
        where: { deviceId: data.deviceId },
        orderBy: { createdAt: 'desc' },
      });

      if (existingUpdate) {
        await prisma.deviceUpdate.update({
          where: { id: existingUpdate.id },
          data: {
            status: data.status,
            error: data.error,
            completedAt: data.status === 'idle' ? new Date() : undefined,
          },
        });
      }
      
      // Broadcast to admins
      const adminNamespace = io.of('/admin') as any;
      adminNamespace.emit('admin:update-status', {
        deviceId: data.deviceId,
        status: data,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error handling update status:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('Device disconnected:', socket.id, socket.data.deviceId);
    
    const deviceId = socket.data.deviceId;
    
    if (deviceId) {
      try {
        // Mark device as offline
        await prisma.device.update({
          where: { deviceId },
          data: {
            isOnline: false,
            status: 'offline',
          },
        }).catch(() => {});
      } catch (error) {
        console.error('Error marking device offline:', error);
      }
    }
    
    // Broadcast to admins
    const adminNamespace = io.of('/admin') as any;
    if (deviceId) {
      adminNamespace.emit('admin:device-offline', {
        deviceId,
        timestamp: Date.now(),
      });
    }
  });
}

function isDevicePaired(device: { status: string; mode: string; pairingCode: string | null } | null | undefined): boolean {
  if (!device) return false;
  return device.status === 'paired' || (!device.pairingCode && device.mode !== 'setup');
}
