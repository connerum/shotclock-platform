// Server -> Device socket events

import type { TimerState, DisplayProfile, DeviceMode, PairingResponse, CalibrationData } from '../types/index.js';

export interface ServerToDeviceEvents {
  'state:update': (state: TimerState) => void;
  'config:update': (config: DisplayConfigPayload) => void;
  'mode:set': (mode: DeviceMode) => void;
  'pairing:complete': (payload: PairingResponse) => void;
  'update:check': () => void;
  'update:install': (version: string) => void;
  'reboot': () => void;
  'ping': () => void;
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
