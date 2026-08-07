// Identity - Device identity management

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomBytes, randomUUID } from 'crypto';
import { RUNTIME_VERSION } from './runtime-version.js';

export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
  firmwareVersion: string;
  controllerType: 'generic' | 'xbox-controller' | 'playstation-controller' | 'custom';
  createdAt: number;
  pairedAt?: number;
  organizationId?: string;
  venueId?: string;
  authToken?: string;
}

const IDENTITY_DIR = path.join(os.homedir(), '.shotclock');
const IDENTITY_FILE = path.join(IDENTITY_DIR, 'device.json');

const FIRMWARE_VERSION = RUNTIME_VERSION;

function ensureIdentityDir(): void {
  if (!fs.existsSync(IDENTITY_DIR)) {
    fs.mkdirSync(IDENTITY_DIR, { recursive: true });
  }
}

export function loadIdentity(): DeviceIdentity | null {
  try {
    ensureIdentityDir();
    
    if (fs.existsSync(IDENTITY_FILE)) {
      const data = fs.readFileSync(IDENTITY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading identity:', error);
  }
  
  return null;
}

export function generateIdentity(): DeviceIdentity {
  const identity: DeviceIdentity = {
    deviceId: `shotclock-${randomUUID().substring(0, 8)}`,
    deviceName: `Shotclock Display ${randomUUID().substring(0, 4)}`,
    firmwareVersion: FIRMWARE_VERSION,
    controllerType: 'generic',
    createdAt: Date.now(),
    authToken: getConfiguredOrGeneratedAuthToken(),
  };
  
  saveIdentity(identity);
  return identity;
}

export function ensureDeviceAuthToken(identity: DeviceIdentity): DeviceIdentity {
  const configured = process.env.DEVICE_AUTH_TOKEN?.trim();
  const authToken = isValidConfiguredToken(configured)
    ? configured
    : identity.authToken && identity.authToken.length >= 32
      ? identity.authToken
      : getConfiguredOrGeneratedAuthToken();
  if (identity.authToken === authToken && identity.firmwareVersion === FIRMWARE_VERSION) return identity;
  return updateIdentity({ authToken, firmwareVersion: FIRMWARE_VERSION });
}

export function saveIdentity(identity: DeviceIdentity): void {
  try {
    ensureIdentityDir();
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2), { mode: 0o600 });
    fs.chmodSync(IDENTITY_FILE, 0o600);
    console.log('Identity saved');
  } catch (error) {
    console.error('Error saving identity:', error);
    throw error;
  }
}

export function updateIdentity(updates: Partial<DeviceIdentity>): DeviceIdentity {
  const current = loadIdentity();
  if (!current) {
    throw new Error('No identity found');
  }
  
  const updated: DeviceIdentity = { ...current, ...updates };
  saveIdentity(updated);
  return updated;
}

export function markAsPaired(organizationId: string, venueId: string): DeviceIdentity {
  return updateIdentity({
    pairedAt: Date.now(),
    organizationId,
    venueId,
  });
}

export function clearPairedStatus(): DeviceIdentity {
  const identity = loadIdentity();
  if (!identity) {
    throw new Error('No identity found');
  }
  
  const updated: DeviceIdentity = {
    ...identity,
    pairedAt: undefined,
    organizationId: undefined,
    venueId: undefined,
  };
  
  saveIdentity(updated);
  return updated;
}

export function isPaired(): boolean {
  const identity = loadIdentity();
  return identity?.pairedAt !== undefined;
}

export function getIdentityPath(): string {
  return IDENTITY_FILE;
}

export function getFirmwareVersion(): string {
  return FIRMWARE_VERSION;
}

function getConfiguredOrGeneratedAuthToken(): string {
  const configured = process.env.DEVICE_AUTH_TOKEN?.trim();
  if (isValidConfiguredToken(configured)) return configured;
  return randomBytes(32).toString('hex');
}

function isValidConfiguredToken(value: string | undefined): value is string {
  return Boolean(value && value.length >= 32 && !value.startsWith('replace-') && !value.startsWith('development-'));
}
