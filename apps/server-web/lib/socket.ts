import { Server as SocketIOServer } from 'socket.io';
import { DeviceToServerEvents, ServerToDeviceEvents } from '@shotclock/shared/socket';

let socketIO: SocketIOServer<DeviceToServerEvents, ServerToDeviceEvents> | null = null;

export function setServerIO(io: SocketIOServer<DeviceToServerEvents, ServerToDeviceEvents>) {
  socketIO = io;
}

export function getServerIO(): SocketIOServer<DeviceToServerEvents, ServerToDeviceEvents> | null {
  return socketIO;
}
