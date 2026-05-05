// Setup AP - hostapd + dnsmasq management for setup access point

import * as fs from 'fs';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface CaptivePortalConfig {
  apSsid: string;
  apPassword: string;
  apChannel: number;
  apInterface: string;
  wanInterface: string;
  serverIp: string;
  serverPort: number;
}

const DEFAULT_AP_CONFIG: CaptivePortalConfig = {
  apSsid: 'Shotclock-Setup',
  apPassword: 'shotclock123',
  apChannel: 6,
  apInterface: 'wlan0',
  wanInterface: 'eth0',
  serverIp: '192.168.4.1',
  serverPort: 8080,
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

      // Bring the AP interface up and assign the address dnsmasq/portal bind to.
      await this.configureApInterface();
      
      // Enable IP forwarding
      await fs.promises.writeFile('/proc/sys/net/ipv4/ip_forward', '1\n');
      
      // Setup NAT
      await this.setupNat();
      
      // Start hostapd
      await execAsync('systemctl start hostapd');
      
      // Start dnsmasq
      await execAsync('systemctl start dnsmasq');
      
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
      
      await execAsync('systemctl stop hostapd').catch(() => {});
      await execAsync('systemctl stop dnsmasq').catch(() => {});
      await this.removeApAddress().catch(() => {});
      
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
    const apInterface = this.getSafeInterfaceName(this.config.apInterface);
    const config = `
interface=${apInterface}
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
    await execAsync('systemctl unmask hostapd');
  }

  private async configureDnsmasq(): Promise<void> {
    const apInterface = this.getSafeInterfaceName(this.config.apInterface);
    const serverIp = this.getSafeIpv4Address(this.config.serverIp);
    const config = `
interface=${apInterface}
dhcp-range=192.168.4.10,192.168.4.100,12h
dhcp-option=3,${serverIp}
dhcp-option=6,${serverIp}
address=/#/${serverIp}
listen-address=${serverIp}
`.trim();

    await fs.promises.writeFile(DNSMASQ_CONF, config);
  }

  private async configureApInterface(): Promise<void> {
    const iface = this.getSafeInterfaceName(this.config.apInterface);
    const serverIp = this.getSafeIpv4Address(this.config.serverIp);

    await execFileAsync('rfkill', ['unblock', 'wifi']).catch(() => {});
    await execFileAsync('ip', ['link', 'set', iface, 'up']);

    const { stdout } = await execFileAsync('ip', ['addr', 'show', 'dev', iface]);
    if (stdout.includes(`inet ${serverIp}/`)) {
      return;
    }

    await execFileAsync('ip', ['addr', 'flush', 'dev', iface]);
    await execFileAsync('ip', ['addr', 'add', `${serverIp}/24`, 'dev', iface]);
  }

  private async removeApAddress(): Promise<void> {
    const iface = this.getSafeInterfaceName(this.config.apInterface);
    const serverIp = this.getSafeIpv4Address(this.config.serverIp);
    await execFileAsync('ip', ['addr', 'del', `${serverIp}/24`, 'dev', iface]);
  }

  private async setupNat(): Promise<void> {
    try {
      const apInterface = this.getSafeInterfaceName(this.config.apInterface);
      const wanInterface = this.getSafeInterfaceName(this.config.wanInterface);
      await execAsync(`iptables -t nat -C POSTROUTING -o ${wanInterface} -j MASQUERADE || iptables -t nat -A POSTROUTING -o ${wanInterface} -j MASQUERADE`);
      await execAsync(`iptables -C FORWARD -i ${apInterface} -o ${wanInterface} -j ACCEPT || iptables -A FORWARD -i ${apInterface} -o ${wanInterface} -j ACCEPT`);
      await execAsync(`iptables -C FORWARD -i ${wanInterface} -o ${apInterface} -m state --state RELATED,ESTABLISHED -j ACCEPT || iptables -A FORWARD -i ${wanInterface} -o ${apInterface} -m state --state RELATED,ESTABLISHED -j ACCEPT`);
    } catch (error) {
      console.error('NAT setup error (may be expected):', error);
    }
  }

  private getSafeInterfaceName(name: string): string {
    if (!/^[a-zA-Z0-9_.:-]+$/.test(name)) {
      throw new Error(`Invalid network interface name: ${name}`);
    }
    return name;
  }

  private getSafeIpv4Address(address: string): string {
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)) {
      throw new Error(`Invalid IPv4 address: ${address}`);
    }
    if (address.split('.').some((octet) => Number(octet) > 255)) {
      throw new Error(`Invalid IPv4 address: ${address}`);
    }
    return address;
  }

  /**
   * Configure AP settings
   */
  updateConfig(config: Partial<CaptivePortalConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const setupAP = new SetupAP();
