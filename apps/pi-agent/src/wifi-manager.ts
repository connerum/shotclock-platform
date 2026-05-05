// WiFi Manager - Network management wrapper using nmcli

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import type { WiFiNetwork, WiFiSecurity } from '@shotclock/shared/types';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export class WiFiManager {
  private iface = 'wlan0';

  /**
   * Scan for available WiFi networks
   */
  async scan(): Promise<WiFiNetwork[]> {
    try {
      // Use nmcli to scan and get results
      await execAsync(`nmcli dev wifi list --rescan yes`, { timeout: 10000 });
      const { stdout } = await execAsync(`nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list ifname ${this.iface}`);
      
      const networks: WiFiNetwork[] = [];
      const lines = stdout.split('\n').filter(Boolean);
      
      for (const line of lines) {
        const [ssid, signalStr, security] = line.split(':');
        if (ssid && ssid.trim()) {
          const signal = parseInt(signalStr) || 0;
          networks.push({
            ssid: ssid.trim(),
            signalStrength: signal,
            security: this.parseSecurity(security),
            isSaved: await this.isNetworkSaved(ssid.trim()),
          });
        }
      }
      
      return networks;
    } catch (error) {
      console.error('WiFi scan error:', error);
      return [];
    }
  }

  /**
   * Connect to a WiFi network
   */
  async connect(ssid: string, password?: string): Promise<boolean> {
    const trimmedSsid = ssid.trim();

    try {
      console.log(`Connecting to WiFi: ${trimmedSsid}`);

      await this.prepareClientMode();

      let connected = await this.connectFromScan(trimmedSsid, password);
      if (!connected) {
        console.log(`WiFi ${trimmedSsid} was not available in scan results; trying saved/manual profile`);
        connected = await this.connectFromProfile(trimmedSsid, password);
      }

      if (connected) {
        console.log(`Connected to ${trimmedSsid}`);
        return true;
      }

      console.error(`WiFi commands completed, but ${this.iface} did not report a connection to ${trimmedSsid}`);
      return false;
    } catch (error) {
      console.error(`Failed to connect to ${trimmedSsid}:`, error);
      return false;
    }
  }

  /**
   * Disconnect from current WiFi network
   */
  async disconnect(): Promise<boolean> {
    try {
      await execAsync(`nmcli dev disconnect ${this.iface}`);
      return true;
    } catch (error) {
      console.error('Disconnect error:', error);
      return false;
    }
  }

  /**
   * Forget (remove) a saved WiFi network
   */
  async forget(ssid: string): Promise<boolean> {
    try {
      await execAsync(`nmcli connection delete "${ssid}"`);
      return true;
    } catch (error) {
      console.error(`Failed to forget ${ssid}:`, error);
      return false;
    }
  }

  /**
   * Get current connection status
   */
  async getStatus(): Promise<{ connected: boolean; ssid?: string; ip?: string }> {
    try {
      const { stdout } = await execFileAsync('nmcli', ['-t', '-f', 'GENERAL.STATE,GENERAL.CONNECTION,IP4.ADDRESS', 'device', 'show', this.iface]);
      const lines = stdout.split('\n').filter(Boolean);
      
      let connected = false;
      let ssid: string | undefined;
      let ip: string | undefined;
      
      for (const line of lines) {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) continue;

        const key = line.slice(0, separatorIndex);
        const value = line.slice(separatorIndex + 1);
        if (key === 'GENERAL.STATE') {
          connected = value.includes('(connected)') || value.startsWith('100');
        } else if (key === 'GENERAL.CONNECTION' && value !== '--') {
          ssid = value;
        } else if (key === 'IP4.ADDRESS[1]' || key === 'IP4.ADDRESS') {
          ip = value.split('/')[0];
        }
      }
      
      return { connected, ssid, ip };
    } catch (error) {
      console.error('Status error:', error);
      return { connected: false };
    }
  }

  /**
   * Check if a network is saved
   */
  async isNetworkSaved(ssid: string): Promise<boolean> {
    try {
      await execAsync(`nmcli connection show "${ssid}"`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get saved networks
   */
  async getSavedNetworks(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`nmcli -t -f NAME connection show`);
      return stdout.split('\n').filter(Boolean);
    } catch (error) {
      console.error('Get saved networks error:', error);
      return [];
    }
  }

  async forgetSavedWifiNetworks(): Promise<void> {
    try {
      const { stdout } = await execFileAsync('nmcli', ['-t', '-f', 'NAME,TYPE', 'connection', 'show']);
      const wifiProfiles = stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [name, type] = line.split(':');
          return { name, type };
        })
        .filter((profile) => profile.name && profile.type === '802-11-wireless');

      for (const profile of wifiProfiles) {
        console.log(`Forgetting saved WiFi profile: ${profile.name}`);
        await execFileAsync('nmcli', ['connection', 'delete', profile.name]).catch((error) => {
          console.warn(`Failed to delete WiFi profile ${profile.name}:`, this.formatCommandError(error));
        });
      }

      await execFileAsync('nmcli', ['dev', 'disconnect', this.iface]).catch(() => {});
    } catch (error) {
      console.warn('Failed to forget saved WiFi profiles:', this.formatCommandError(error));
    }
  }

  private parseSecurity(security: string): WiFiSecurity {
    const s = security?.toLowerCase() || '';
    if (s.includes('wpa3')) return 'wpa3';
    if (s.includes('wpa2')) return 'wpa2';
    if (s === '' || s === '--') return 'open';
    return 'unknown';
  }

  private async prepareClientMode(): Promise<void> {
    await execFileAsync('rfkill', ['unblock', 'wifi']).catch(() => {});
    await execFileAsync('ip', ['addr', 'flush', 'dev', this.iface]).catch(() => {});
    await execFileAsync('ip', ['link', 'set', this.iface, 'up']).catch(() => {});
    await execFileAsync('nmcli', ['device', 'set', this.iface, 'managed', 'yes']);
    await execFileAsync('nmcli', ['radio', 'wifi', 'on']);
    await this.waitForManagedDevice(15000);
    await execFileAsync('nmcli', ['device', 'wifi', 'rescan', 'ifname', this.iface], { timeout: 15000 }).catch(() => {});
  }

  private async connectFromScan(ssid: string, password?: string): Promise<boolean> {
    const args = ['dev', 'wifi', 'connect', ssid];
    if (password) {
      args.push('password', password);
    }
    args.push('ifname', this.iface);

    try {
      await execFileAsync('nmcli', args, { timeout: 45000 });
      return this.waitForConnection(ssid, 20000);
    } catch (error) {
      console.warn(`Scan-based WiFi connect failed for ${ssid}:`, this.formatCommandError(error));
      return false;
    }
  }

  private async connectFromProfile(ssid: string, password?: string): Promise<boolean> {
    const profileName = `shotclock-${ssid}`;

    await execFileAsync('nmcli', ['connection', 'delete', profileName]).catch(() => {});
    await execFileAsync('nmcli', [
      'connection',
      'add',
      'type',
      'wifi',
      'ifname',
      this.iface,
      'con-name',
      profileName,
      'ssid',
      ssid,
    ]);

    await execFileAsync('nmcli', [
      'connection',
      'modify',
      profileName,
      'connection.autoconnect',
      'yes',
      '802-11-wireless.hidden',
      'yes',
      'ipv4.method',
      'auto',
      'ipv6.method',
      'auto',
    ]);

    if (password) {
      await execFileAsync('nmcli', [
        'connection',
        'modify',
        profileName,
        '802-11-wireless-security.key-mgmt',
        'wpa-psk',
        '802-11-wireless-security.psk',
        password,
      ]);
    }

    try {
      await execFileAsync('nmcli', ['connection', 'up', profileName], { timeout: 60000 });
      const connectedByProfile = await this.waitForConnection(profileName, 30000);
      if (connectedByProfile) {
        return true;
      }
      return this.waitForConnection(ssid, 30000);
    } catch (error) {
      console.error(`Profile-based WiFi connect failed for ${ssid}:`, this.formatCommandError(error));
      return false;
    }
  }

  private async waitForManagedDevice(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastState = '';

    while (Date.now() < deadline) {
      const { stdout } = await execFileAsync('nmcli', ['-t', '-f', 'GENERAL.STATE', 'device', 'show', this.iface]).catch((error: any) => ({
        stdout: error.stdout || '',
      }));
      lastState = stdout.trim();
      if (!lastState.includes('unmanaged')) {
        return;
      }
      await this.sleep(500);
    }

    throw new Error(`${this.iface} stayed unmanaged after AP shutdown: ${lastState}`);
  }

  private async waitForConnection(ssid: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getStatus();
      if (status.connected && status.ssid === ssid && status.ip) {
        return true;
      }
      await this.sleep(1000);
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatCommandError(error: unknown): string {
    if (error && typeof error === 'object') {
      const maybeError = error as { message?: string; stderr?: string; stdout?: string };
      return [maybeError.message, maybeError.stderr, maybeError.stdout].filter(Boolean).join('\n');
    }
    return String(error);
  }
}

export const wifiManager = new WiFiManager();
