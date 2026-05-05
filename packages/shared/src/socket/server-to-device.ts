// Server -> Device socket events

import type { TimerState, DisplayProfile, DeviceMode, PairingResponse, CalibrationData, DeviceCommandAck } from '../types/index.js';

export interface ServerToDeviceEvents {
  'state:update': (state: TimerState, ack?: (response: DeviceCommandAck) => void) => void;
  'config:update': (config: DisplayConfigPayload, ack?: (response: DeviceCommandAck) => void) => void;
  'mode:set': (mode: DeviceMode, ack?: (response: DeviceCommandAck) => void) => void;
  'pairing:complete': (payload: PairingResponse, ack?: (response: DeviceCommandAck) => void) => void;
  'update:check': (ack?: (response: DeviceCommandAck) => void) => void;
  'update:install': (version: string, ack?: (response: DeviceCommandAck) => void) => void;
  'reboot': (ack?: (response: DeviceCommandAck) => void) => void;
  'ping': (ack?: (response: DeviceCommandAck) => void) => void;
}

export interface DisplayConfigPayload {
  displayProfile: DisplayProfile;
  calibrationData?: CalibrationData;
  preview?: boolean;
  brightness?: number;
  orientation?: 'landscape' | 'portrait';
}

export type ServerToDeviceEventName = keyof ServerToDeviceEvents;

export function createServerToDeviceEmitter() {
  return {
    emitStateUpdate: (state: TimerState) => state,
    emitConfigUpdate: (config: DisplayConfigPayload) => config,
    emitModeSet: (mode: DeviceMode) => mode,
    emitPairingComplete: (payload: PairingResponse) => payload,
    emitUpdateCheck: () => null,
    emitUpdateInstall: (version: string) => version,
    emitReboot: () => null,
    emitPing: () => null,
  };
}
