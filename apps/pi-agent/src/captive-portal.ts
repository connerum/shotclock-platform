// Captive Portal - Express server for setup on 192.168.4.1

import express, { Request, Response } from 'express';
import { setupAP } from './setup-ap.js';
import { wifiManager } from './wifi-manager.js';
import { saveConfig } from './config-store.js';
import { markAsPaired } from './identity.js';

interface SetupState {
  step: 'initial' | 'ap_created' | 'network_selected' | 'network_connected' | 'complete';
  ssid?: string;
  password?: string;
}

interface CaptivePortalConfig {
  apSsid: string;
  apPassword: string;
  apChannel: number;
  serverIp: string;
  serverPort: number;
}

const DEFAULT_CONFIG: CaptivePortalConfig = {
  apSsid: 'Shotclock-Setup',
  apPassword: 'shotclock123',
  apChannel: 6,
  serverIp: '192.168.4.1',
  serverPort: 8080,
};

const portalApp = express();
let server: ReturnType<typeof portalApp.listen> | null = null;
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

  if (server) {
    console.log(`Captive portal already running at http://${portalConfig.serverIp}:${portalConfig.serverPort}`);
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
    portalApp.post('/api/wifi/connect', async (req: Request, res: Response) => {
      try {
        const { ssid, password } = req.body;
      
      if (!ssid) {
        res.status(400).json({ error: 'SSID is required' });
        return;
      }
      
      setupState = { ...setupState, step: 'network_selected', ssid };
      
      const success = await wifiManager.connect(ssid, password);
      
      if (success) {
        setupState = { 
          ...setupState, 
          step: 'network_connected',
          ssid,
          password 
        };
        res.json({ success: true, ssid });
      } else {
        res.status(500).json({ success: false, error: 'Failed to connect' });
      }
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
    body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; background: #000; color: #fff; }
    h1 { color: #00ff00; }
    .status { background: #222; padding: 15px; border-radius: 8px; margin: 10px 0; }
    .btn { background: #00ff00; color: #000; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
    .btn:hover { background: #00cc00; }
    input { background: #333; color: #fff; border: 1px solid #444; padding: 10px; border-radius: 5px; width: 100%; margin: 5px 0; }
    .network { background: #222; padding: 10px; margin: 5px 0; border-radius: 5px; cursor: pointer; }
    .network:hover { background: #333; }
    .info { background: #111; border: 1px solid #00ff00; padding: 15px; border-radius: 8px; margin: 10px 0; text-align: center; }
  </style>
</head>
<body>
  <h1>Shotclock Setup</h1>
  <div class="info">
    <p><strong>Connect to: ${activePortalConfig.apSsid}</strong></p>
    <p>Password: ${activePortalConfig.apPassword}</p>
  </div>
  <div id="status" class="status">
    <p><strong>Step:</strong> <span id="step">${setupState.step}</span></p>
  </div>
  <div id="networks"></div>
  <script>
    async function refresh() {
      const res = await fetch('/api/setup/status');
      const data = await res.json();
      document.getElementById('step').textContent = data.state.step;
      
      if (data.state.step === 'initial' || data.state.step === 'ap_created') {
        loadNetworks();
      }
      
      if (data.state.step === 'complete') {
        document.getElementById('status').innerHTML = '<p style="color:#00ff00">Setup Complete! Restarting...</p>';
      }
    }
    
    async function loadNetworks() {
      try {
        const res = await fetch('/api/wifi/networks');
        const { networks } = await res.json();
        document.getElementById('networks').innerHTML = networks.map(n => 
          '<div class="network" onclick="connect(\\'' + n.ssid + '\\')">' + n.ssid + ' (' + n.signalStrength + '%)</div>'
        ).join('');
      } catch (e) {
        document.getElementById('networks').innerHTML = '<p>Loading networks...</p>';
      }
    }
    
    async function connect(ssid) {
      const password = prompt('Enter password for ' + ssid);
      await fetch('/api/wifi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, password })
      });
      refresh();
    }
    
    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`);
    });

    routesRegistered = true;
  }
  
  return listen('0.0.0.0', portalConfig);
}

/**
 * Stop the captive portal server
 */
export function stopCaptivePortal(): void {
  if (server) {
    server.close();
    server = null;
  }
}

function listen(host: string, portalConfig: CaptivePortalConfig): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    server = portalApp.listen(portalConfig.serverPort, host, () => {
      const displayHost = host === '0.0.0.0' ? portalConfig.serverIp : host;
      console.log(`Captive portal running at http://${displayHost}:${portalConfig.serverPort}`);
      settled = true;
      resolve(true);
    });

    server.on('clientError', (error, socket) => {
      console.warn('Captive portal client error:', error.message);
      if (socket.writable) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
    });

    server.once('error', (error: NodeJS.ErrnoException) => {
      server?.close();
      server = null;
      console.error('Captive portal failed to start:', error);

      if (!settled) {
        settled = true;
        resolve(false);
      }
    });
  });
}
