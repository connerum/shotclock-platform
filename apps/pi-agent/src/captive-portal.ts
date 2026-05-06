// Captive Portal - Express server for setup WiFi provisioning

import express, { Request, Response } from 'express';
import { setupAP } from './setup-ap.js';
import { wifiManager } from './wifi-manager.js';
import { loadConfig, saveConfig } from './config-store.js';
import { isPaired, loadIdentity, markAsPaired } from './identity.js';
import { saveState } from './state-store.js';
import { registerPairingCodeWithServer } from './pairing-registration.js';
import { reconnectSocketClient } from './socket-client.js';

interface SetupState {
  step: 'initial' | 'ap_created' | 'network_selected' | 'network_connected' | 'complete';
  ssid?: string;
  password?: string;
}

interface CaptivePortalConfig {
  apSsid: string;
  apPassword: string;
  portalHost: string;
  portalUrl: string;
  fallbackPortalUrl: string;
  apChannel: number;
  serverIp: string;
  serverPort: number;
}

const DEFAULT_CONFIG: CaptivePortalConfig = {
  apSsid: 'Shotclock-Setup',
  apPassword: 'shotclock123',
  portalHost: 'sportsboard.local',
  portalUrl: 'http://sportsboard.local',
  fallbackPortalUrl: 'http://192.168.4.1:8080',
  apChannel: 6,
  serverIp: '192.168.4.1',
  serverPort: 8080,
};

const portalApp = express();
let servers: ReturnType<typeof portalApp.listen>[] = [];
let setupState: SetupState = { step: 'initial' };
let routesRegistered = false;
let activePortalConfig: CaptivePortalConfig = DEFAULT_CONFIG;

/**
 * Start the captive portal server
 */
export async function startCaptivePortal(config: Partial<CaptivePortalConfig> = {}): Promise<boolean> {
  const portalConfig = { ...DEFAULT_CONFIG, ...config };
  activePortalConfig = portalConfig;
  setupState = { ...setupState, step: 'ap_created' };

  if (servers.length > 0) {
    console.log(`Captive portal already running at ${portalConfig.portalUrl}`);
    return true;
  }
  
  if (!routesRegistered) {
    portalApp.use(express.json());
  
    // Setup state endpoint
    portalApp.get('/api/setup/status', (_req: Request, res: Response) => {
      res.json({ state: setupState, configured: setupState.step === 'complete' });
    });

    portalApp.get('/', (_req: Request, res: Response) => {
      res.redirect('/setup');
    });

    portalApp.get(['/generate_204', '/gen_204', '/hotspot-detect.html', '/ncsi.txt', '/connecttest.txt'], (_req: Request, res: Response) => {
      res.redirect('/setup');
    });
  
    // WiFi networks endpoint
    portalApp.get('/api/wifi/networks', async (_req: Request, res: Response) => {
      try {
        const networks = await wifiManager.scan();
        res.json({ networks });
      } catch (error) {
        res.status(500).json({ error: 'Failed to scan networks' });
      }
    });
  
    // WiFi connect endpoint
    portalApp.post('/api/wifi/connect', (req: Request, res: Response) => {
      try {
        const { ssid, password } = req.body;
      
      if (!ssid) {
        res.status(400).json({ error: 'SSID is required' });
        return;
      }
      
      setupState = { ...setupState, step: 'network_selected', ssid };
      saveState({ mode: { type: 'offline' } });

      res.json({
        success: true,
        ssid,
        message: 'Credentials received. The setup AP will disconnect while the display joins WiFi.',
      });

      setTimeout(() => {
        void connectToWifiFromPortal(ssid, password);
      }, 250);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Connection error' });
    }
  });
  
    // WiFi forget endpoint
    portalApp.post('/api/wifi/forget', async (req: Request, res: Response) => {
      try {
        const { ssid } = req.body;
      
      if (!ssid) {
        res.status(400).json({ error: 'SSID is required' });
        return;
      }
      
      const success = await wifiManager.forget(ssid);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to forget network' });
    }
  });
  
    // Setup complete endpoint
    portalApp.post('/api/setup/complete', (req: Request, res: Response) => {
      try {
        const { organizationId, venueId } = req.body;
      
      // Update config to go online
      saveConfig({ mode: 'online' });
      
      // Mark device as paired if organization/venue provided
      if (organizationId && venueId) {
        markAsPaired(organizationId, venueId);
      }
      
      setupState = { ...setupState, step: 'complete' };
      
      // Stop the AP
      setupAP.stop();
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Setup completion failed' });
    }
  });
  
    // Fallback to setup page
    portalApp.get('/setup', (_req: Request, res: Response) => {
      res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Shotclock Setup</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --panel-soft: #f0f4f8;
      --text: #172033;
      --muted: #667085;
      --line: #d9e0ea;
      --brand: #245581;
      --brand-strong: #173f63;
      --accent: #b34039;
      --success: #16803d;
      --shadow: 0 18px 48px rgba(23, 32, 51, 0.12);
    }

    * { box-sizing: border-box; }

    body {
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(36, 85, 129, 0.12), transparent 28rem),
        linear-gradient(180deg, #ffffff 0%, var(--bg) 52%, #eef2f6 100%);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    main {
      width: min(100%, 620px);
      margin: 0 auto;
    }

    .shell {
      overflow: hidden;
      border: 1px solid rgba(217, 224, 234, 0.9);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: var(--shadow);
    }

    .hero {
      padding: 28px 28px 24px;
      background: linear-gradient(135deg, #245581 0%, #1c496f 62%, #173f63 100%);
      color: #ffffff;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(30px, 8vw, 44px);
      line-height: 1;
      letter-spacing: 0;
    }

    h2 {
      margin: 0 0 10px;
      color: var(--text);
      font-size: 21px;
      line-height: 1.15;
      letter-spacing: 0;
    }

    .hero-copy {
      max-width: 38rem;
      margin: 12px 0 0;
      color: rgba(255, 255, 255, 0.82);
      font-size: 15px;
      line-height: 1.45;
    }

    .content {
      display: grid;
      gap: 16px;
      padding: 18px;
    }

    .status,
    .info,
    #networks {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel);
    }

    .status,
    .info {
      padding: 18px;
    }

    .info {
      display: grid;
      gap: 12px;
      background: var(--panel-soft);
    }

    .info-row {
      display: grid;
      gap: 4px;
    }

    .kicker,
    label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .value {
      overflow-wrap: anywhere;
      color: var(--text);
      font-size: 20px;
      font-weight: 800;
      line-height: 1.15;
    }

    .password {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    #status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
    }

    #status p {
      margin: 0;
    }

    #step {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #e9f2fa;
      color: var(--brand);
      font-size: 13px;
      font-weight: 800;
    }

    .hint {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }

    .error { color: var(--accent); }

    form {
      display: grid;
      gap: 12px;
    }

    input {
      width: 100%;
      min-height: 48px;
      margin-top: 6px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #ffffff;
      color: var(--text);
      font: inherit;
      outline: none;
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }

    input:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 4px rgba(36, 85, 129, 0.14);
    }

    .btn {
      min-height: 50px;
      margin-top: 4px;
      border: 0;
      border-radius: 12px;
      background: var(--brand);
      color: #ffffff;
      cursor: pointer;
      font: inherit;
      font-weight: 800;
      box-shadow: 0 10px 22px rgba(36, 85, 129, 0.22);
    }

    .btn:hover { background: var(--brand-strong); }

    #message {
      min-height: 21px;
      margin: 12px 0 0;
    }

    #networks {
      overflow: hidden;
      background: #ffffff;
    }

    #networks:empty { display: none; }
    #networks .hint {
      margin: 0;
      padding: 16px;
    }

    .network {
      padding: 14px 16px;
      border-top: 1px solid var(--line);
      color: var(--text);
      cursor: pointer;
      font-weight: 700;
    }

    .network:first-child { border-top: 0; }
    .network:hover { background: #f5f8fb; }

    @media (max-width: 520px) {
      body { padding: 14px; }
      .hero { padding: 24px 20px; }
      .content { padding: 14px; }
      #status {
        display: grid;
        align-items: start;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="shell">
      <header class="hero">
        <p class="eyebrow">CourtCast Display</p>
        <h1>Network Setup</h1>
        <p class="hero-copy">Connect this sportsboard to the venue WiFi. The setup network will turn off once the display joins your network.</p>
      </header>

      <div class="content">
        <div class="info">
          <div class="info-row">
            <span class="kicker">Connected Setup Network</span>
            <span class="value">${activePortalConfig.apSsid}</span>
          </div>
          <div class="info-row">
            <span class="kicker">Setup Password</span>
            <span class="value password">${activePortalConfig.apPassword}</span>
          </div>
        </div>

        <div id="status" class="status">
          <p><strong>Setup status</strong></p>
          <span id="step">${setupState.step}</span>
        </div>

        <div class="status">
          <h2>Join Venue WiFi</h2>
          <p class="hint">Network scanning may be unavailable while this display is broadcasting setup WiFi. Select a network if one appears, or enter the network name manually.</p>
          <form id="manual-form">
            <label for="ssid">Network Name</label>
            <input id="ssid" name="ssid" autocomplete="off" required>
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password">
            <button class="btn" type="submit">Connect Display</button>
          </form>
          <p id="message" class="hint"></p>
        </div>

        <div id="networks"></div>
      </div>
    </section>
  </main>
  <script>
    const networksEl = document.getElementById('networks');
    const messageEl = document.getElementById('message');
    const ssidInput = document.getElementById('ssid');
    const passwordInput = document.getElementById('password');
    let loadingNetworks = false;

    async function refresh() {
      const res = await fetch('/api/setup/status');
      const data = await res.json();
      document.getElementById('step').textContent = data.state.step;
      
      if (data.state.step === 'initial' || data.state.step === 'ap_created') {
        loadNetworks();
      }
      
      if (data.state.step === 'complete') {
        document.getElementById('status').innerHTML = '<p style="color:#16803d;font-weight:800">Setup complete. Restarting...</p>';
      }
    }
    
    async function loadNetworks() {
      if (loadingNetworks) return;
      loadingNetworks = true;
      try {
        const res = await fetch('/api/wifi/networks');
        const { networks } = await res.json();
        networksEl.innerHTML = '';

        if (!networks || networks.length === 0) {
          networksEl.innerHTML = '<p class="hint">No networks found. Enter the network name manually.</p>';
          return;
        }

        for (const network of networks) {
          const item = document.createElement('div');
          item.className = 'network';
          item.textContent = network.ssid + ' (' + network.signalStrength + '%)';
          item.addEventListener('click', () => {
            ssidInput.value = network.ssid;
            passwordInput.focus();
          });
          networksEl.appendChild(item);
        }
      } catch (e) {
        networksEl.innerHTML = '<p class="hint">Unable to scan networks. Enter the network name manually.</p>';
      } finally {
        loadingNetworks = false;
      }
    }
    
    async function connect(ssid, password) {
      messageEl.textContent = 'Sending credentials...';
      const res = await fetch('/api/wifi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        messageEl.textContent = data.error || 'Failed to send credentials.';
        messageEl.className = 'hint error';
        return;
      }
      messageEl.textContent = data.message || 'Connecting. This setup WiFi will disconnect.';
      messageEl.className = 'hint';
    }

    document.getElementById('manual-form').addEventListener('submit', (event) => {
      event.preventDefault();
      connect(ssidInput.value.trim(), passwordInput.value);
    });
    
    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`);
    });

    routesRegistered = true;
  }
  
  const fallbackStarted = await listen('0.0.0.0', portalConfig.serverPort, portalConfig);
  const friendlyStarted = portalConfig.serverPort === 80
    ? fallbackStarted
    : await listen('0.0.0.0', 80, portalConfig);

  return fallbackStarted || friendlyStarted;
}

/**
 * Stop the captive portal server
 */
export function stopCaptivePortal(): void {
  for (const activeServer of servers) {
    activeServer.close();
  }
  servers = [];
}

async function connectToWifiFromPortal(ssid: string, password?: string): Promise<void> {
  console.log(`Setup portal received WiFi credentials for ${ssid}`);
  await setupAP.stop();

  const success = await wifiManager.connect(ssid, password);
  if (success) {
    setupState = {
      ...setupState,
      step: 'network_connected',
      ssid,
      password,
    };
    const paired = isPaired();
    saveConfig({ mode: paired ? 'online' : 'pairing' });
    saveState({ mode: { type: paired ? 'shot-clock' : 'pairing' } });
    const identity = loadIdentity();
    if (identity && !paired) {
      void registerPairingCodeWithServer(identity, loadConfig());
    }
    setTimeout(() => reconnectSocketClient(), 1000);
    stopCaptivePortal();
    return;
  }

  console.error(`Setup portal failed to connect to WiFi: ${ssid}`);
  setupState = { ...setupState, step: 'ap_created', ssid: undefined, password: undefined };
  saveState({ mode: { type: 'setup' } });
  await setupAP.start();
}

function listen(host: string, port: number, portalConfig: CaptivePortalConfig): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let pendingServer: ReturnType<typeof portalApp.listen> | null = null;

    pendingServer = portalApp.listen(port, host, () => {
      if (pendingServer) {
        servers.push(pendingServer);
      }
      const displayHost = port === 80
        ? portalConfig.portalHost
        : host === '0.0.0.0' ? portalConfig.serverIp : host;
      const displayUrl = port === 80 ? `http://${displayHost}` : `http://${displayHost}:${port}`;
      console.log(`Captive portal running at ${displayUrl}`);
      settled = true;
      resolve(true);
    });

    pendingServer.on('clientError', (error, socket) => {
      console.warn('Captive portal client error:', error.message);
      if (socket.writable) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
    });

    pendingServer.once('error', (error: NodeJS.ErrnoException) => {
      pendingServer?.close();
      console.error(`Captive portal failed to start on port ${port}:`, error);

      if (!settled) {
        settled = true;
        resolve(false);
      }
    });
  });
}
