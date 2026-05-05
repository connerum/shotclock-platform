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
  serverUrl: process.env.SERVER_URL || process.env.SOCKET_SERVER_URL || 'http://localhost:3000',
  mode: 'setup',
  heartbeatInterval: parseInt(process.env.AGENT_HEARTBEAT_INTERVAL || '30000', 10),
  pairingCodeLength: parseInt(process.env.PAIRING_CODE_LENGTH || '6', 10),
  setupApSsid: process.env.SETUP_AP_SSID || 'Shotclock-Setup',
  setupApPassword: process.env.SETUP_AP_PASSWORD || 'shotclock123',
  updateCheckInterval: parseInt(process.env.UPDATE_CHECK_INTERVAL || '3600000', 10),
  localApiPort: parseInt(process.env.AGENT_LOCAL_API_PORT || '3001', 10),
  deviceName: process.env.DEVICE_NAME || process.env.DEFAULT_DEVICE_NAME || 'Shotclock Display',
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
