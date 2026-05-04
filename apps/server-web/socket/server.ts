// Socket.IO server setup

import { Server as SocketIOServer, Socket } from 'socket.io';
import { ServerToDeviceEvents } from '@shotclock/shared/socket';
import { setupDeviceHandlers } from './handlers/device-handler.js';
import { setupAdminHandlers } from './handlers/admin-handler.js';

export type TypedServer = SocketIOServer<any, ServerToDeviceEvents>;
export type TypedSocket = Socket<any, ServerToDeviceEvents>;

export function setupSocketServer(io: TypedServer): void {
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
    setupAdminHandlers(socket, io);
  });

  console.log('Socket.IO namespaces registered: /device, /admin');
}
