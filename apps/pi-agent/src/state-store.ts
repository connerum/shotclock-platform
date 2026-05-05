// State Store - Local state cache management

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { DeviceMode, TimerState, DisplayProfile, CalibrationData } from '@shotclock/shared/types';

export interface DeviceState {
  mode: DeviceMode;
  timerState?: TimerState;
  displayProfile: DisplayProfile;
  calibrationData?: CalibrationData;
  lastUpdated: number;
}

const STATE_DIR = path.join(os.homedir(), '.shotclock');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

const DEFAULT_DISPLAY_PROFILE: DisplayProfile = {
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
    danger: '#ff0000',
  },
};

const DEFAULT_STATE: DeviceState = {
  mode: { type: 'setup' },
  displayProfile: DEFAULT_DISPLAY_PROFILE,
  lastUpdated: Date.now(),
};

let previewState: Partial<Pick<DeviceState, 'displayProfile' | 'calibrationData'>> | null = null;

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

export function loadEffectiveState(): DeviceState {
  return {
    ...loadState(),
    ...(previewState?.displayProfile && { displayProfile: previewState.displayProfile }),
    ...(previewState?.calibrationData && { calibrationData: previewState.calibrationData }),
  };
}

export function setConfigPreview(preview: Partial<Pick<DeviceState, 'displayProfile' | 'calibrationData'>>): DeviceState {
  previewState = {
    ...previewState,
    ...preview,
  };

  return loadEffectiveState();
}

export function clearConfigPreview(): void {
  previewState = null;
}

export function saveState(state: Partial<DeviceState>): DeviceState {
  try {
    ensureStateDir();

    if (state.displayProfile || state.calibrationData) {
      clearConfigPreview();
    }
    
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

export function updateTimerState(timerState: TimerState): DeviceState {
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
