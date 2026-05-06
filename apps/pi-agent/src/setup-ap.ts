// Setup AP - hostapd + dnsmasq management for setup access point

import * as fs from 'fs';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface CaptivePortalConfig {
  apSsid: string;
  apPassword: string;
  portalHost: string;
  apChannel: number;
  apInterface: string;
  wanInterface: string;
  apCountry: string;
  serverIp: string;
  serverPort: number;
}

const DEFAULT_AP_CONFIG: CaptivePortalConfig = {
  apSsid: 'Shotclock-Setup',
  apPassword: 'shotclock123',
  portalHost: 'sportsboard.local',
  apChannel: 6,
  apInterface: 'wlan0',
  wanInterface: 'eth0',
  apCountry: process.env.SETUP_AP_COUNTRY || process.env.WIFI_COUNTRY || 'US',
  serverIp: '192.168.4.1',
  serverPort: 8080,
};

const HOSTAPD_CONF = `/etc/hostapd/hostapd.conf`;
const HOSTAPD_DEFAULTS = `/etc/default/hostapd`;
const DNSMASQ_CONF = `/etc/dnsmasq.d/shotclock-setup.conf`;
const AVAHI_HOSTS = `/etc/avahi/hosts`;

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
      console.log(`Starting setup AP: ${this.config.apSsid}`);

      await this.stopApServices();
      
      // Configure hostapd
      await this.configureHostapd();
      
      // Configure dnsmasq
      await this.configureDnsmasq();
      await this.configureMdnsAlias();

      // Bring the AP interface up and assign the address dnsmasq/portal bind to.
      await this.releaseApInterface();
      await this.configureApInterface();
      
      // Enable IP forwarding
      await fs.promises.writeFile('/proc/sys/net/ipv4/ip_forward', '1\n');
      
      // Setup NAT
      await this.setupNat();
      
      // Start hostapd
      await this.restartService('hostapd');
      
      // Start dnsmasq
      await this.restartService('dnsmasq');
      
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
      
      await this.stopApServices();
      await this.removeApAddress().catch(() => {});
      await this.restoreClientInterface().catch(() => {});
      
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
    const country = this.getSafeCountryCode(this.config.apCountry);
    const config = `
interface=${apInterface}
driver=nl80211
ssid=${this.config.apSsid}
hw_mode=g
channel=${this.config.apChannel}
wmm_enabled=1
country_code=${country}
ieee80211d=1
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=${this.config.apPassword}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
`.trim();

    await fs.promises.mkdir('/etc/hostapd', { recursive: true });
    await fs.promises.writeFile(HOSTAPD_CONF, config);
    await fs.promises.writeFile(HOSTAPD_DEFAULTS, `DAEMON_CONF="${HOSTAPD_CONF}"\n`);
    await execAsync('systemctl unmask hostapd');
  }

  private async configureDnsmasq(): Promise<void> {
    const apInterface = this.getSafeInterfaceName(this.config.apInterface);
    const serverIp = this.getSafeIpv4Address(this.config.serverIp);
    const portalHost = this.getSafeHostname(this.config.portalHost);
    const config = `
interface=${apInterface}
domain-needed
bogus-priv
dhcp-range=192.168.4.10,192.168.4.100,12h
dhcp-option=3,${serverIp}
dhcp-option=6,${serverIp}
address=/${portalHost}/${serverIp}
address=/#/${serverIp}
listen-address=${serverIp}
`.trim();

    await fs.promises.mkdir('/etc/dnsmasq.d', { recursive: true });
    await fs.promises.writeFile(DNSMASQ_CONF, config);
  }

  private async configureMdnsAlias(): Promise<void> {
    const serverIp = this.getSafeIpv4Address(this.config.serverIp);
    const portalHost = this.getSafeHostname(this.config.portalHost);

    if (!portalHost.endsWith('.local')) {
      return;
    }

    try {
      await fs.promises.mkdir('/etc/avahi', { recursive: true });

      const markerStart = '# BEGIN shotclock setup portal alias';
      const markerEnd = '# END shotclock setup portal alias';
      const block = `${markerStart}\n${serverIp} ${portalHost}\n${markerEnd}`;
      let current = '';

      try {
        current = await fs.promises.readFile(AVAHI_HOSTS, 'utf-8');
      } catch {
        current = '';
      }

      const pattern = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`);
      const next = pattern.test(current)
        ? current.replace(pattern, block)
        : `${current.trimEnd()}\n${block}\n`;

      await fs.promises.writeFile(AVAHI_HOSTS, next.trimStart());
      await execFileAsync('systemctl', ['restart', 'avahi-daemon']).catch(() => {});
    } catch (error) {
      console.warn(`Unable to configure mDNS alias for ${portalHost}:`, error);
    }
  }

  private async releaseApInterface(): Promise<void> {
    const iface = this.getSafeInterfaceName(this.config.apInterface);
    const country = this.getSafeCountryCode(this.config.apCountry);

    await execFileAsync('rfkill', ['unblock', 'wifi']).catch(() => {});
    await execFileAsync('iw', ['reg', 'set', country]).catch(() => {});
    await execFileAsync('nmcli', ['radio', 'wifi', 'on']).catch(() => {});
    await execFileAsync('nmcli', ['device', 'disconnect', iface]).catch(() => {});
    await execFileAsync('nmcli', ['device', 'set', iface, 'managed', 'no']).catch(() => {});
    await execFileAsync('systemctl', ['stop', `wpa_supplicant@${iface}.service`]).catch(() => {});
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

  private async restoreClientInterface(): Promise<void> {
    const iface = this.getSafeInterfaceName(this.config.apInterface);
    await execFileAsync('nmcli', ['device', 'set', iface, 'managed', 'yes']).catch(() => {});
    await execFileAsync('nmcli', ['radio', 'wifi', 'on']).catch(() => {});
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

  private getSafeHostname(hostname: string): string {
    const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
    const labels = normalized.split('.');
    const valid = normalized.length > 0
      && normalized.length <= 253
      && labels.length > 1
      && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));

    if (!valid) {
      throw new Error(`Invalid setup portal hostname: ${hostname}`);
    }

    return normalized;
  }

  private getSafeCountryCode(country: string): string {
    const normalized = country.toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) {
      throw new Error(`Invalid WiFi country code: ${country}`);
    }
    return normalized;
  }

  private async stopApServices(): Promise<void> {
    await execFileAsync('systemctl', ['stop', 'dnsmasq']).catch(() => {});
    await execFileAsync('systemctl', ['stop', 'hostapd']).catch(() => {});
  }

  private async restartService(service: string): Promise<void> {
    await execFileAsync('systemctl', ['restart', service]);
    try {
      await execFileAsync('systemctl', ['is-active', '--quiet', service]);
    } catch {
      const { stdout, stderr } = await execFileAsync('systemctl', ['status', service, '--no-pager', '-l']).catch((statusError: any) => ({
        stdout: statusError.stdout || '',
        stderr: statusError.stderr || '',
      }));
      throw new Error(`${service} failed to start\n${stdout}${stderr}`);
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
