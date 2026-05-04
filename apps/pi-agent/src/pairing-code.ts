// Pairing Code - Generate and display pairing code

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface PairingCodeData {
  code: string;
  expiresAt: number;
  deviceId?: string;
}

const PAIRING_DIR = path.join(os.homedir(), '.shotclock');
const PAIRING_FILE = path.join(PAIRING_DIR, 'pairing.json');

const PAIRING_CODE_LENGTH = 6;
const PAIRING_CODE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function ensurePairingDir(): void {
  if (!fs.existsSync(PAIRING_DIR)) {
    fs.mkdirSync(PAIRING_DIR, { recursive: true });
  }
}

export function generatePairingCode(): PairingCodeData {
  const digits = '0123456789';
  let code = '';
  
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  
  const pairingData: PairingCodeData = {
    code,
    expiresAt: Date.now() + PAIRING_CODE_EXPIRY_MS,
  };
  
  savePairingCode(pairingData);
  return pairingData;
}

export function savePairingCode(data: PairingCodeData): void {
  try {
    ensurePairingDir();
    fs.writeFileSync(PAIRING_FILE, JSON.stringify(data, null, 2));
    console.log(`Pairing code saved: ${data.code}`);
  } catch (error) {
    console.error('Error saving pairing code:', error);
    throw error;
  }
}

export function loadPairingCode(): PairingCodeData | null {
  try {
    ensurePairingDir();
    
    if (fs.existsSync(PAIRING_FILE)) {
      const data = fs.readFileSync(PAIRING_FILE, 'utf-8');
      const pairingData = JSON.parse(data) as PairingCodeData;
      
      // Check if expired
      if (pairingData.expiresAt < Date.now()) {
        console.log('Pairing code expired');
        return null;
      }
      
      return pairingData;
    }
  } catch (error) {
    console.error('Error loading pairing code:', error);
  }
  
  return null;
}

export function clearPairingCode(): void {
  try {
    if (fs.existsSync(PAIRING_FILE)) {
      fs.unlinkSync(PAIRING_FILE);
    }
  } catch (error) {
    console.error('Error clearing pairing code:', error);
  }
}

export function getPairingCode(): PairingCodeData | null {
  const existing = loadPairingCode();
  if (existing) {
    return existing;
  }
  
  return generatePairingCode();
}

export function regeneratePairingCode(): PairingCodeData {
  clearPairingCode();
  return generatePairingCode();
}

export function isPairingCodeValid(): boolean {
  const code = loadPairingCode();
  return code !== null && code.expiresAt > Date.now();
}

export function getPairingCodeTimeRemaining(): number {
  const code = loadPairingCode();
  if (!code) {
    return 0;
  }
  
  const remaining = code.expiresAt - Date.now();
  return Math.max(0, remaining);
}

export function formatTimeRemaining(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
