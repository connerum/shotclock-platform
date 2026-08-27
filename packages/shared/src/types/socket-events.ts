// Socket event types for Shotclock Platform
// Server -> Device and Device -> Server events
// This file is the single source of truth for all shared types

// Timer types
export type TimerMode = 'stop' | 'run' | 'pause';

export type SportType = 'basketball' | 'wrestling' | 'volleyball';

export const THREE_PANEL_SPORTS_ADS_CAPABILITY = 'three-panel-sports-ads';
export const THREE_PANEL_AD_BEHAVIORS_CAPABILITY = 'three-panel-ad-behaviors';

export type PracticeBoardUnit = 'offense' | 'defense';

export type PracticeBoardPosition =
  | 'ALL'
  | 'QB'
  | 'WR'
  | 'RB'
  | 'TE'
  | 'OL'
  | 'DL'
  | 'LB'
  | 'Safety'
  | 'Nickel'
  | 'Corner'
  | 'Other';

export interface PracticeBoardAssignment {
  id: string;
  position: PracticeBoardPosition;
  customPosition?: string;
  drillName: string;
}

export interface PracticeBoardDrill {
  id: string;
  unit?: PracticeBoardUnit;
  title: string;
  durationSeconds: number;
  assignments: PracticeBoardAssignment[];
}

export type PracticeBoardTimerStatus = 'idle' | 'running' | 'paused' | 'complete';

export interface PracticeBoardWeather {
  locationLabel: string;
  timezone: string;
  temperatureF: number;
  wetBulbF: number;
  description: string;
  weatherCode: number;
  observedAt: string;
}

export interface PracticeBoardState {
  drills: PracticeBoardDrill[];
  activeDrillId?: string;
  timerStatus: PracticeBoardTimerStatus;
  remainingSeconds: number;
  startedAt?: number;
  overviewUntil?: number;
  schoolLogoUrl?: string;
  weather?: PracticeBoardWeather;
}

export interface PracticeBoardSavedPreload {
  id: string;
  name: string;
  board: PracticeBoardState;
  createdAt: number;
  updatedAt: number;
}

export const PITCHKOUNT_PITCH_TYPES = [
  'Fastball',
  'Four-Seam',
  'Two-Seam',
  'Sinker',
  'Cutter',
  'Slider',
  'Curveball',
  'Changeup',
  'Splitter',
  'Knuckleball',
  'Other',
] as const;

export type PitchKountPitchType = typeof PITCHKOUNT_PITCH_TYPES[number];

export const PITCHKOUNT_DAILY_LIMIT = 110;
export const PITCHKOUNT_MAIN_SLIDE_DURATION_MS = 45000;
export const PITCHKOUNT_STATS_SLIDE_DURATION_MS = 10000;

export interface PitchKountState {
  pitcherName: string;
  pitcherNumber: string;
  teamName: string;
  headshotUrl?: string;
  pitchCount: number;
  pitchSpeedMph: number;
  showPitchSpeed: boolean;
  pitchType: PitchKountPitchType;
  strikes: number;
  balls: number;
  era: number;
  wins: number;
  losses: number;
  inningsPitched: string;
  strikeouts: number;
  walks: number;
  whip: number;
}

export interface PitchKountSavedPlayer {
  id: string;
  state: PitchKountState;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_PITCHKOUNT_STATE: PitchKountState = {
  pitcherName: 'PITCHER NAME',
  pitcherNumber: '00',
  teamName: 'HOME',
  pitchCount: 0,
  pitchSpeedMph: 0,
  showPitchSpeed: true,
  pitchType: 'Fastball',
  strikes: 0,
  balls: 0,
  era: 0,
  wins: 0,
  losses: 0,
  inningsPitched: '0.0',
  strikeouts: 0,
  walks: 0,
  whip: 0,
};

export function normalizePitchKountState(value: unknown): PitchKountState {
  const state = value && typeof value === 'object' ? value as Partial<PitchKountState> : {};
  const pitchType = PITCHKOUNT_PITCH_TYPES.includes(state.pitchType as PitchKountPitchType)
    ? state.pitchType as PitchKountPitchType
    : DEFAULT_PITCHKOUNT_STATE.pitchType;
  const inningsPitched = typeof state.inningsPitched === 'string' && /^\d{1,3}(?:\.[012])?$/.test(state.inningsPitched.trim())
    ? state.inningsPitched.trim()
    : DEFAULT_PITCHKOUNT_STATE.inningsPitched;

  return {
    pitcherName: normalizePitchKountText(state.pitcherName, DEFAULT_PITCHKOUNT_STATE.pitcherName, 28),
    pitcherNumber: normalizePitcherNumber(state.pitcherNumber),
    teamName: normalizePitchKountText(state.teamName, DEFAULT_PITCHKOUNT_STATE.teamName, 20),
    ...(normalizePitchKountMediaUrl(state.headshotUrl) ? { headshotUrl: normalizePitchKountMediaUrl(state.headshotUrl) } : {}),
    pitchCount: normalizePitchKountInteger(state.pitchCount, 999),
    pitchSpeedMph: normalizePitchKountInteger(state.pitchSpeedMph, 120),
    showPitchSpeed: state.showPitchSpeed !== false,
    pitchType,
    strikes: normalizePitchKountInteger(state.strikes, 999),
    balls: normalizePitchKountInteger(state.balls, 999),
    era: normalizePitchKountDecimal(state.era, 99.99),
    wins: normalizePitchKountInteger(state.wins, 99),
    losses: normalizePitchKountInteger(state.losses, 99),
    inningsPitched,
    strikeouts: normalizePitchKountInteger(state.strikeouts, 999),
    walks: normalizePitchKountInteger(state.walks, 999),
    whip: normalizePitchKountDecimal(state.whip, 99.99),
  };
}

function normalizePitchKountMediaUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().slice(0, 512);
  if (/^\/media\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/.test(normalized)) return normalized;
  if (/^https:\/\/[^\s]+$/i.test(normalized)) return normalized;
  return undefined;
}

function normalizePitchKountText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
  return normalized || fallback;
}

function normalizePitcherNumber(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return DEFAULT_PITCHKOUNT_STATE.pitcherNumber;
  return String(value).replace(/[^0-9A-Za-z-]/g, '').slice(0, 3) || DEFAULT_PITCHKOUNT_STATE.pitcherNumber;
}

function normalizePitchKountInteger(value: unknown, maximum: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(maximum, Math.round(number)));
}

function normalizePitchKountDecimal(value: unknown, maximum: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(maximum, Math.round(number * 100) / 100));
}

export interface TimerState {
  mode: TimerMode;
  homeScore: number;
  awayScore: number;
  homeSets?: number;
  awaySets?: number;
  homeTimeouts?: number;
  awayTimeouts?: number;
  period?: number;
  shotClock: number;
  gameClock: number;
  isRunning: boolean;
  isPaused: boolean;
  lastUpdated: number;
  primaryResetSequence?: number;
  primaryResetEventId?: string;
}

export interface PrimaryClockResetAction {
  kind: 'primary-clock-reset';
  eventId: string;
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
  colorCorrection?: ColorCorrectionConfig;
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

export interface ColorCorrectionConfig {
  rgbToBgr: boolean;
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
  | 'basketball'
  | 'wrestling'
  | 'volleyball'
  | 'practice-board'
  | 'pitchkount'
  | 'shot-clock' 
  | 'media' 
  | 'calibration' 
  | 'blank';

export interface DeviceMode {
  type: ModeType;
  subMode?: string;
  scoreboardBranding?: ScoreboardBranding;
  sportDisplayLayout?: SportDisplayLayout;
  practiceBoard?: PracticeBoardState;
  pitchKount?: PitchKountState;
}

export interface SportDisplayMedia {
  mediaUrl: string;
  mediaMimeType: string;
}

export interface SportDisplayLayout {
  type: 'three-panel';
  adPlaylist: SportDisplayMedia[];
  rotationIntervalMs?: number;
  adMode?: SportDisplayAdMode;
}

export type SportDisplayAdMode =
  | 'offset-timed'
  | 'mirrored-timed'
  | 'offset-on-timer-reset';

export interface ScoreboardBranding {
  enabled: boolean;
  showTimeouts?: boolean;
  homeLabel?: string;
  awayLabel?: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  homeColor?: string;
  awayColor?: string;
  volleyballTopDisplay?: 'empty' | 'school-logo' | 'ads';
  volleyballTopMediaUrl?: string;
  volleyballTopMediaMimeType?: string;
  volleyballTopMediaPlaylist?: Array<{
    mediaUrl: string;
    mediaMimeType: string;
  }>;
  volleyballTopRotationIntervalMs?: number;
}

export type PresentationOverlayType =
  | 'advertisement'
  | 'school-logo'
  | 'sponsor'
  | 'team-intro'
  | 'champion'
  | 'sound-horn'
  | 'music'
  | 'emergency-weather'
  | 'emergency-medical'
  | 'clear';

export type PresentationOverlayAccent = 'blue' | 'green' | 'yellow' | 'orange' | 'purple' | 'red';

export interface PresentationOverlay {
  type: PresentationOverlayType;
  title: string;
  message?: string;
  accent: PresentationOverlayAccent;
  active: boolean;
  startedAt: number;
  durationMs?: number;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaPlaylist?: Array<{
    mediaUrl: string;
    mediaMimeType: string;
  }>;
  rotationIntervalMs?: number;
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
  presentationOverlay?: PresentationOverlay;
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
  preview?: boolean;
  brightness?: number;
  orientation?: 'landscape' | 'portrait';
}

export interface DeviceCommandAck {
  success: boolean;
  error?: string;
}

// Server -> Device events
export interface ServerToDeviceEvents {
  'state:update': (state: TimerState, ack?: (response: DeviceCommandAck) => void) => void;
  'config:update': (config: DisplayConfigPayload, ack?: (response: DeviceCommandAck) => void) => void;
  'mode:set': (mode: DeviceMode, ack?: (response: DeviceCommandAck) => void) => void;
  'presentation:show': (overlay: PresentationOverlay, ack?: (response: DeviceCommandAck) => void) => void;
  'pairing:complete': (payload: PairingResponse, ack?: (response: DeviceCommandAck) => void) => void;
  'update:check': (ack?: (response: DeviceCommandAck) => void) => void;
  'update:install': (version: string, ack?: (response: DeviceCommandAck) => void) => void;
  'factory:reset': (ack?: (response: DeviceCommandAck) => void) => void;
  'reboot': (ack?: (response: DeviceCommandAck) => void) => void;
  'ping': (ack?: (response: DeviceCommandAck) => void) => void;
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
  viewport: { x: 960, y: 640, width: 256, height: 192, rotation: 0, scaleX: 1, scaleY: 1 },
  safeZone: { top: 8, right: 8, bottom: 8, left: 8 },
  fontSize: { shotClock: 92, gameClock: 28, score: 28, period: 14, label: 10 },
  colors: {
    background: '#000000',
    foreground: '#ffffff',
    accent: '#00ff00',
    homeTeam: '#ff0000',
    awayTeam: '#0000ff',
    warning: '#ffff00',
    danger: '#ff0000'
  },
  colorCorrection: { rgbToBgr: true }
};
