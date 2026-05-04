// Captive Portal - Express server for setup on 192.168.4.1

import express, { Request, Response } from 'express';
import type { CaptivePortalConfig, SetupState } from '@shotclock/shared/types';
import { setupAP } from './setup-ap.js';
import { wifiManager } from './wifi-manager.js';
import { saveConfig, loadConfig } from './config-store.js';
import { markAsPaired } from './identity.js';
import { getPairingCode, regeneratePairingCode } from './pairing-code.js';

const DEFAULT_CONFIG: CaptivePortalConfig = {
  apSsid: 'Shotclock-Setup',
  apPassword: 'shotclock123',
  apChannel: 6,
  serverIp: '192.168.4.1',
  serverPort: 3001,
};

const portalApp = express();
let server: ReturnType<typeof server.listen> | null = null;
let setupState: SetupState = { step: 'initial' };

/**
 * Start the captive portal server
 */
export function startCaptivePortal(config: Partial<CaptivePortalConfig> = {}): void {
  const portalConfig = { ...DEFAULT_CONFIG, ...config };
  
  portalApp.use(express.json());
  portalApp.use(express.static('public'));
  
  // Setup state endpoint
  portalApp.get('/api/setup/status', (req: Request, res: Response) => {
    res.json({ state: setupState });
  });
  
  // WiFi networks endpoint
  portalApp.get('/api/wifi/networks', async (req: Request, res: Response) => {
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
  portalApp.get('*', (req: Request, res: Response) => {
    res.send(`
      <!DOCTYPE html>
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
        </style>
      </head>
      <body>
        <h1>Shotclock Setup</h1>
        <div id="status" class="status">
          <p><strong>Step:</strong> <span id="step">${setupState.step}</span></p>
          <p><strong>AP:</strong> ${portalConfig.apSsid}</p>
        </div>
        <div id="networks"></div>
        <script>
          async function refresh() {
            const res = await fetch('/api/setup/status');
            const { state } = await res.json();
            document.getElementById('step').textContent = state.step;
            
            if (state.step === 'initial' || state.step === 'device_connected') {
              loadNetworks();
            }
          }
          
          async function loadNetworks() {
            const res = await fetch('/api/wifi/networks');
            const { networks } = await res.json();
            document.getElementById('networks').innerHTML = networks.map(n => 
              '<div class=\"network\" onclick=\"connect(\\'' + n.ssid + '\\')\">' + n.ssid + ' (' + n.signalStrength + '%)</div>'
            ).join('');
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
      </html>
    `);
  });
  
  server = portalApp.listen(portalConfig.serverPort, portalConfig.serverIp, () => {
    console.log(`Captive portal running at http://${portalConfig.serverIp}:${portalConfig.serverPort}`);
  });
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
