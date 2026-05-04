// Setup AP - hostapd + dnsmasq management for setup access point

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { CaptivePortalConfig } from '@shotclock/shared/types';

const execAsync = promisify(exec);

const DEFAULT_AP_CONFIG: CaptivePortalConfig = {
  apSsid: 'Shotclock-Setup',
  apPassword: 'shotclock123',
  apChannel: 6,
  serverIp: '192.168.4.1',
  serverPort: 3001,
};

const HOSTAPD_CONF = `/etc/hostapd/hostapd.conf`;
const DNSMASQ_CONF = `/etc/dnsmasq.d/shotclock-setup.conf`;

export class SetupAP {
  private config: CaptivePortalConfig;
  private isRunning = false;

  constructor(config: Partial<CaptivePortalConfig> = {}) {
    this.config = { ...DEFAULT_AP_CONFIG, ...config };
  }

  /**
   * Start the setup access point
   */
  async start(): Promise<boolean> {
    try {
      console.log('Starting setup AP...');
      
      // Configure hostapd
      await this.configureHostapd();
      
      // Configure dnsmasq
      await this.configureDnsmasq();
      
      // Enable IP forwarding
      await execAsync('echo 1 > /proc/sys/net/ipv4/ip_forward');
      
      // Setup NAT
      await this.setupNat();
      
      // Start hostapd
      await execAsync('sudo systemctl start hostapd');
      
      // Start dnsmasq
      await execAsync('sudo systemctl start dnsmasq');
      
      this.isRunning = true;
      console.log(`Setup AP started: ${this.config.apSsid}`);
      return true;
    } catch (error) {
      console.error('Failed to start setup AP:', error);
      return false;
    }
  }

  /**
   * Stop the setup access point
   */
  async stop(): Promise<boolean> {
    try {
      console.log('Stopping setup AP...');
      
      await execAsync('sudo systemctl stop hostapd', { timeout: 5000 }).catch(() => {});
      await execAsync('sudo systemctl stop dnsmasq', { timeout: 5000 }).catch(() => {});
      
      this.isRunning = false;
      console.log('Setup AP stopped');
      return true;
    } catch (error) {
      console.error('Failed to stop setup AP:', error);
      return false;
    }
  }

  /**
   * Check if AP is running
   */
  async isActive(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('systemctl is-active hostapd');
      return stdout.trim() === 'active';
    } catch {
      return this.isRunning;
    }
  }

  /**
   * Get AP configuration
   */
  getConfig(): CaptivePortalConfig {
    return { ...this.config };
  }

  private async configureHostapd(): Promise<void> {
    const config = `
interface=wlan0
driver=nl80211
ssid=${this.config.apSsid}
hw_mode=g
channel=${this.config.apChannel}
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=${this.config.apPassword}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
`.trim();

    await fs.promises.writeFile(HOSTAPD_CONF, config);
    await execAsync(`sudo systemctl unmask hostapd`);
  }

  private async configureDnsmasq(): Promise<void> {
    const config = `
interface=wlan0
dhcp-range=192.168.4.10,192.168.4.100,12h
dhcp-option=3,${this.config.serverIp}
dhcp-option=6,${this.config.serverIp}
address=/#/${this.config.serverIp}
`.trim();

    await fs.promises.writeFile(DNSMASQ_CONF, config);
  }

  private async setupNat(): Promise<void> {
    try {
      await execAsync('sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE');
      await execAsync('sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT');
      await execAsync('sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT');
    } catch (error) {
      console.error('NAT setup error (may be expected):', error);
    }
  }

  /**
   * Configure AP settings
   */
  updateConfig(config: Partial<CaptivePortalConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const setupAP = new SetupAP();
