// Socket event types for Shotclock Platform
// Server -> Device and Device -> Server events
// This file is the single source of truth for all shared types

// Timer types
export type TimerMode = 'stop' | 'run' | 'pause';

export interface TimerState {
  mode: TimerMode;
  homeScore: number;
  awayScore: number;
  homeSets?: number;
  awaySets?: number;
  period?: number;
  shotClock: number;
  gameClock: number;
  isRunning: boolean;
  isPaused: boolean;
  lastUpdated: number;
}

// Display types
export type ControllerType = 
  | 'generic' 
  | 'xbox-controller' 
  | 'playstation-controller' 
  | 'custom';

export interface DisplayProfile {
  id: string;
  name: string;
  controllerType: ControllerType;
  viewport: Viewport;
  safeZone: SafeZone;
  fontSize: FontSizeConfig;
  colors: ColorConfig;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface SafeZone {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FontSizeConfig {
  shotClock: number;
  gameClock: number;
  score: number;
  period: number;
  label: number;
}

export interface ColorConfig {
  background: string;
  foreground: string;
  accent: string;
  homeTeam: string;
  awayTeam: string;
  warning: string;
  danger: string;
}

export interface CalibrationData {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  timestamp: number;
}

// Device types
export type ModeType = 
  | 'setup' 
  | 'pairing' 
  | 'offline' 
  | 'shot-clock' 
  | 'media' 
  | 'calibration' 
  | 'blank';

export interface DeviceMode {
  type: ModeType;
  subMode?: string;
}

export interface NetworkStatus {
  ssid?: string;
  signalStrength: number;
  ipAddress?: string;
  isConnected: boolean;
}

export interface DisplayStatePayload {
  mode: DeviceMode;
  timerState?: TimerState;
  mediaAssetId?: string;
  calibrationData?: CalibrationData;
}

// Update types
export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'staged' | 'installing' | 'error';

export interface UpdateManifest {
  latestVersion: string;
  releases: FirmwareRelease[];
  minServerVersion: string;
}

export interface FirmwareRelease {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  checksum: string;
  size: number;
  notes: string;
  isMandatory: boolean;
}

export interface DeviceUpdate {
  deviceId: string;
  currentVersion: string;
  targetVersion: string;
  status: UpdateStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface UpdateStatusPayload {
  deviceId: string;
  status: UpdateStatus;
  progress?: number;
  version?: string;
  error?: string;
}

// WiFi types
export interface WiFiNetwork {
  ssid: string;
  signalStrength: number;
  security: WiFiSecurity;
  isSaved: boolean;
}

export type WiFiSecurity = 'open' | 'wpa2' | 'wpa3' | 'wpa2-wpa3' | 'unknown';

// Pairing types
export interface PairingRequest {
  deviceId: string;
  deviceName: string;
  pairingCode: string;
  organizationId?: string;
  firmwareVersion: string;
  controllerType: ControllerType;
  displayProfile: DisplayProfile;
}

export interface PairingResponse {
  success: boolean;
  deviceId?: string;
  organizationId?: string;
  venueId?: string;
  serverUrl?: string;
  error?: string;
}

// Socket event payloads
export interface HelloPayload {
  deviceId: string;
  deviceName: string;
  firmwareVersion: string;
  controllerType: ControllerType;
  capabilities: string[];
  displayProfile: DisplayProfile;
  pairingCode?: string;
  pairingCodeExpiresAt?: number;
  timestamp: number;
}

export interface HeartbeatPayload {
  deviceId: string;
  mode: DeviceMode;
  displayState: DisplayStatePayload;
  networkStatus: NetworkStatus;
  timestamp: number;
}

export interface DisplayConfigPayload {
  displayProfile: DisplayProfile;
  calibrationData?: CalibrationData;
  brightness?: number;
  orientation?: 'landscape' | 'portrait';
}

// Server -> Device events
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

// Device -> Server events
export interface DeviceToServerEvents {
  'device:hello': (data: HelloPayload) => void;
  'device:heartbeat': (data: HeartbeatPayload) => void;
  'device:state:ack': (data: { success: boolean; error?: string }) => void;
  'device:config:ack': (data: { success: boolean; error?: string }) => void;
  'device:update:status': (data: UpdateStatusPayload) => void;
}

// Default display profile
export const DEFAULT_DISPLAY_PROFILE: DisplayProfile = {
  id: 'default-generic',
  name: 'Default Generic Display',
  controllerType: 'generic',
  viewport: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0, scaleX: 1, scaleY: 1 },
  safeZone: { top: 40, right: 40, bottom: 40, left: 40 },
  fontSize: { shotClock: 200, gameClock: 120, score: 150, period: 80, label: 40 },
  colors: {
    background: '#000000',
    foreground: '#ffffff',
    accent: '#00ff00',
    homeTeam: '#ff0000',
    awayTeam: '#0000ff',
    warning: '#ffff00',
    danger: '#ff0000'
  }
};
