// WiFi Manager - Network management wrapper using nmcli

import { exec } from 'child_process';
import { promisify } from 'util';
import type { WiFiNetwork, WiFiSecurity } from '@shotclock/shared/types';

const execAsync = promisify(exec);

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
    try {
      console.log(`Connecting to WiFi: ${ssid}`);
      
      if (password) {
        await execAsync(`nmcli dev wifi connect "${ssid}" password "${password}" ifname ${this.iface}`);
      } else {
        await execAsync(`nmcli dev wifi connect "${ssid}" ifname ${this.iface}`);
      }
      
      console.log(`Connected to ${ssid}`);
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${ssid}:`, error);
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
      const { stdout } = await execAsync(`nmcli -t -f ACTIVE,SSID,IP4.ADDRESS dev show ${this.iface}`);
      const lines = stdout.split('\n').filter(Boolean);
      
      let connected = false;
      let ssid: string | undefined;
      let ip: string | undefined;
      
      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key === 'ACTIVE') {
          connected = value === 'yes';
        } else if (key === 'SSID') {
          ssid = value;
        } else if (key === 'IP4.ADDRESS') {
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

  private parseSecurity(security: string): WiFiSecurity {
    const s = security?.toLowerCase() || '';
    if (s.includes('wpa3')) return 'wpa3';
    if (s.includes('wpa2')) return 'wpa2';
    if (s === '' || s === '--') return 'open';
    return 'unknown';
  }
}

export const wifiManager = new WiFiManager();
