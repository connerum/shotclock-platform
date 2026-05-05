import { Server as SocketIOServer } from 'socket.io';
import { DeviceToServerEvents, ServerToDeviceEvents } from '@shotclock/shared/socket';

type AppSocketServer = SocketIOServer<DeviceToServerEvents, ServerToDeviceEvents>;

declare global {
  var __shotclockSocketIO: AppSocketServer | undefined;
  var socketIO: AppSocketServer | undefined;
}

export function setServerIO(io: AppSocketServer) {
  globalThis.__shotclockSocketIO = io;
  globalThis.socketIO = io;
}

export function getServerIO(): AppSocketServer | null {
  return globalThis.__shotclockSocketIO || globalThis.socketIO || null;
}
