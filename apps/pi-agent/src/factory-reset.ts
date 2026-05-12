import { execFile } from 'child_process';
import { promisify } from 'util';
import { resetConfig } from './config-store.js';
import { clearPairedStatus } from './identity.js';
import { clearPairingCode } from './pairing-code.js';
import { loadState, resetState, saveState } from './state-store.js';
import { wifiManager } from './wifi-manager.js';

const execFileAsync = promisify(execFile);

export async function prepareFactoryReset(): Promise<void> {
  console.log('Preparing factory reset');
  const previousState = loadState();
  const resetDisplayProfile = {
    ...previousState.displayProfile,
    viewport: {
      ...previousState.displayProfile.viewport,
      x: 0,
      y: 0,
      width: 256,
      height: 192,
    },
  };

  clearPairingCode();

  try {
    clearPairedStatus();
  } catch (error) {
    console.warn('Factory reset could not clear paired identity state:', error);
  }

  resetConfig();
  resetState();
  saveState({
    mode: { type: 'setup' },
    displayProfile: resetDisplayProfile,
    calibrationData: {
      x: 0,
      y: 0,
      width: 256,
      height: 192,
      scaleX: 1,
      scaleY: 1,
      rotation: resetDisplayProfile.viewport.rotation || 0,
      timestamp: Date.now(),
    },
  });
}

export function finishFactoryResetAndReboot(): void {
  setTimeout(() => {
    void (async () => {
      console.log('Finishing factory reset: forgetting WiFi profiles');
      await wifiManager.forgetSavedWifiNetworks();
      await rebootSystem();
    })();
  }, 500);
}

export async function rebootSystem(): Promise<void> {
  console.log('Rebooting system');

  try {
    await execFileAsync('systemctl', ['reboot']);
    return;
  } catch (error) {
    console.warn('systemctl reboot failed, trying reboot command:', error);
  }

  try {
    await execFileAsync('reboot', []);
  } catch (error) {
    console.error('Unable to reboot system:', error);
    process.exit(0);
  }
}
