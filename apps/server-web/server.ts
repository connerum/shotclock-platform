// Custom Next.js server with Socket.IO and Prisma

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { DeviceToServerEvents, ServerToDeviceEvents } from '@shotclock/shared/socket';
import { setupSocketServer, TypedServer } from './socket/server';
import { setServerIO } from './lib/socket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || process.env.SERVER_PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  // Store io instance globally for API routes
  (global as any).socketIO = io;
  setServerIO(io as SocketIOServer<DeviceToServerEvents, ServerToDeviceEvents>);

  // Setup Socket.IO handlers (includes device and admin handlers with Prisma integration)
  setupSocketServer(io as TypedServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on path /socket.io`);
  });
});

// Export helper for API routes to access Socket.IO instance
export function getServerIO() {
  return (global as any).socketIO as SocketIOServer<DeviceToServerEvents, ServerToDeviceEvents>;
}
