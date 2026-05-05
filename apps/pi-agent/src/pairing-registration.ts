import type { DeviceIdentity } from './identity.js';
import type { AgentConfig } from './config-store.js';
import { getPairingCode } from './pairing-code.js';
import { loadState } from './state-store.js';

export async function registerPairingCodeWithServer(
  identity: DeviceIdentity,
  config: AgentConfig
): Promise<boolean> {
  if (identity.pairedAt) return true;

  const pairingCode = getPairingCode();
  if (!pairingCode) return false;

  const state = loadState();
  const serverUrl = config.serverUrl.replace(/\/$/, '');

  try {
    const response = await fetch(`${serverUrl}/api/device-status/${identity.deviceId}/pairing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        deviceName: identity.deviceName,
        firmwareVersion: identity.firmwareVersion,
        controllerType: identity.controllerType,
        capabilities: ['shot-clock', 'scoreboard', 'timer', 'media'],
        displayProfile: state.displayProfile,
        pairingCode: pairingCode.code,
        pairingCodeExpiresAt: pairingCode.expiresAt,
      }),
    });

    if (!response.ok) {
      console.warn(`Server rejected pairing code registration: HTTP ${response.status}`);
      return false;
    }

    console.log(`Registered pairing code ${pairingCode.code} with server`);
    return true;
  } catch (error) {
    console.warn('Failed to register pairing code with server:', error);
    return false;
  }
}
