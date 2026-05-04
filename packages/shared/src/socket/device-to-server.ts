// Device -> Server socket events

import type { HelloPayload, HeartbeatPayload, UpdateStatusPayload } from '../types/index.js';

export interface DeviceToServerEvents {
  'device:hello': (data: HelloPayload) => void;
  'device:heartbeat': (data: HeartbeatPayload) => void;
  'device:state:ack': (data: { success: boolean; error?: string }) => void;
  'device:config:ack': (data: { success: boolean; error?: string }) => void;
  'device:update:status': (data: UpdateStatusPayload) => void;
}

export type DeviceToServerEventName = keyof DeviceToServerEvents;

export function createDeviceToServerEmitter() {
  return {
    emitHello: (data: HelloPayload) => data,
    emitHeartbeat: (data: HeartbeatPayload) => data,
    emitStateAck: (success: boolean, error?: string) => ({ success, error }),
    emitConfigAck: (success: boolean, error?: string) => ({ success, error }),
    emitUpdateStatus: (data: UpdateStatusPayload) => data,
  };
}
