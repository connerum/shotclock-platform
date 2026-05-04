// State Store - Local state cache management

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { DeviceMode, TimerStatePayload, DisplayConfigPayload } from '@shotclock/shared/types';

export interface CachedState {
  mode: DeviceMode;
  timerState?: TimerStatePayload;
  config?: DisplayConfigPayload;
  lastUpdated: number;
}

export interface DeviceState extends CachedState {
  displayProfile: DisplayConfigPayload['displayProfile'];
  calibrationData?: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    timestamp: number;
  };
}

const STATE_DIR = path.join(os.homedir(), '.shotclock');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

const DEFAULT_STATE: DeviceState = {
  mode: { type: 'setup' },
  displayProfile: {
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
      danger: '#ff0000',
    },
  },
  lastUpdated: Date.now(),
};

function ensureStateDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

export function loadState(): DeviceState {
  try {
    ensureStateDir();
    
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const state = JSON.parse(data);
      return { ...DEFAULT_STATE, ...state };
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
  
  return { ...DEFAULT_STATE };
}

export function saveState(state: Partial<DeviceState>): DeviceState {
  try {
    ensureStateDir();
    
    const currentState = loadState();
    const newState: DeviceState = {
      ...currentState,
      ...state,
      lastUpdated: Date.now(),
    };
    
    fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
    
    return newState;
  } catch (error) {
    console.error('Error saving state:', error);
    throw error;
  }
}

export function resetState(): DeviceState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch (error) {
    console.error('Error resetting state:', error);
  }
  
  return { ...DEFAULT_STATE, lastUpdated: Date.now() };
}

export function updateTimerState(timerState: TimerStatePayload): DeviceState {
  return saveState({ timerState });
}

export function updateMode(mode: DeviceMode): DeviceState {
  return saveState({ mode });
}

export function updateCalibration(calibration: DeviceState['calibrationData']): DeviceState {
  return saveState({ calibrationData: calibration });
}

export function getStatePath(): string {
  return STATE_FILE;
}
