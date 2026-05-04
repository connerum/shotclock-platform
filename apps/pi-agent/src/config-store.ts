// Config Store - Local JSON configuration management

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AgentConfig {
  serverUrl: string;
  mode: 'setup' | 'pairing' | 'online' | 'offline';
  heartbeatInterval: number;
  pairingCodeLength: number;
  setupApSsid: string;
  setupApPassword: string;
  updateCheckInterval: number;
  localApiPort: number;
  deviceName: string;
  organizationId?: string;
  venueId?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.shotclock');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: AgentConfig = {
  serverUrl: process.env.SERVER_URL || 'http://localhost:3030',
  mode: 'setup',
  heartbeatInterval: 30000,
  pairingCodeLength: 6,
  setupApSsid: 'Shotclock-Setup',
  setupApPassword: 'shotclock123',
  updateCheckInterval: 3600000,
  localApiPort: 3001,
  deviceName: 'Shotclock Display',
};

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): AgentConfig {
  try {
    ensureConfigDir();
    
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(data);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: Partial<AgentConfig>): AgentConfig {
  try {
    ensureConfigDir();
    
    const currentConfig = loadConfig();
    const newConfig = { ...currentConfig, ...config };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    console.log('Config saved');
    
    return newConfig;
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
}

export function resetConfig(): AgentConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  } catch (error) {
    console.error('Error resetting config:', error);
  }
  
  return { ...DEFAULT_CONFIG };
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
