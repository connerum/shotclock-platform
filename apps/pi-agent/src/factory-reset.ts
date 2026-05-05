import { execFile } from 'child_process';
import { promisify } from 'util';
import { resetConfig } from './config-store.js';
import { clearPairedStatus } from './identity.js';
import { clearPairingCode } from './pairing-code.js';
import { resetState, saveState } from './state-store.js';
import { wifiManager } from './wifi-manager.js';

const execFileAsync = promisify(execFile);

export async function prepareFactoryReset(): Promise<void> {
  console.log('Preparing factory reset');

  clearPairingCode();

  try {
    clearPairedStatus();
  } catch (error) {
    console.warn('Factory reset could not clear paired identity state:', error);
  }

  resetConfig();
  resetState();
  saveState({ mode: { type: 'setup' } });
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
