// Socket.IO server setup

import { Server as SocketIOServer, Socket } from 'socket.io';
import { ServerToDeviceEvents } from '@shotclock/shared/socket';
import { setupDeviceHandlers } from './handlers/device-handler.js';
import { setupAdminHandlers } from './handlers/admin-handler.js';
import { authenticateSessionValue, isSuperUser, readSessionCookie, verifyDeviceToken } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

export type TypedServer = SocketIOServer<any, ServerToDeviceEvents>;
export type TypedSocket = Socket<any, ServerToDeviceEvents>;

export function setupSocketServer(io: TypedServer): void {
  console.log('Setting up Socket.IO server...');

  // Device namespace - for Pi agents
  const deviceNamespace = io.of('/device');

  deviceNamespace.use(async (socket, next) => {
    try {
      const deviceId = typeof socket.handshake.auth?.deviceId === 'string'
        ? socket.handshake.auth.deviceId.trim()
        : '';
      const token = typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : '';
      if (!/^shotclock-[a-zA-Z0-9_-]{4,64}$/.test(deviceId) || token.length < 32) {
        return next(new Error('Device authentication required'));
      }
      const device = await prisma.device.findUnique({
        where: { deviceId },
        select: { authTokenHash: true },
      });
      if (!verifyDeviceToken(token, device?.authTokenHash)) {
        return next(new Error('Device authentication failed'));
      }
      socket.data.deviceId = deviceId;
      socket.data.authenticatedDeviceId = deviceId;
      next();
    } catch (error) {
      console.error('Device socket authentication error:', error);
      next(new Error('Device authentication failed'));
    }
  });
  
  deviceNamespace.on('connection', (socket: Socket) => {
    console.log('Device connected:', socket.id);
    setupDeviceHandlers(socket as TypedSocket, io);
  });

  // Admin namespace - for web dashboard
  const adminNamespace = io.of('/admin');

  adminNamespace.use(async (socket, next) => {
    try {
      const user = await authenticateSessionValue(readSessionCookie(socket.handshake.headers.cookie));
      if (!user || !isSuperUser(user)) return next(new Error('Administrator authentication required'));
      socket.data.userId = user.id;
      socket.data.userEmail = user.email;
      next();
    } catch (error) {
      console.error('Admin socket authentication error:', error);
      next(new Error('Administrator authentication failed'));
    }
  });
  
  adminNamespace.on('connection', (socket: Socket) => {
    console.log('Admin connected:', socket.id);
    setupAdminHandlers(socket, io);
  });

  console.log('Socket.IO namespaces registered: /device, /admin');
}
