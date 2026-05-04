// Local API - Express API on localhost:3001

import express, { Request, Response } from 'express';
import type { DeviceIdentity } from './identity.js';
import type { AgentConfig } from './config-store.js';
import type { TypedSocket } from './socket-client.js';
import type { UpdateManager } from './update-manager.js';
import type { OfflineMode } from './offline-mode.js';
import { loadState, saveState, resetState } from './state-store.js';
import { getPairingCode, regeneratePairingCode, getPairingCodeTimeRemaining, formatTimeRemaining } from './pairing-code.js';
import { loadConfig, saveConfig } from './config-store.js';
import { loadIdentity } from './identity.js';
import { getStatus, getSavedNetworks, scan as wifiScan, connect as wifiConnect, forget as wifiForget } from './wifi-manager.js';
import type { SetupState } from '@shotclock/shared/types';

export function startLocalApi(
  identity: DeviceIdentity,
  config: AgentConfig,
  socket: TypedSocket,
  updateManager: UpdateManager,
  offlineMode: OfflineMode
): void {
  const app = express();
  const port = config.localApiPort || 3001;
  
  app.use(express.json());
  
  // GET /local/status - Get device status
  app.get('/local/status', (req: Request, res: Response) => {
    const state = loadState();
    const netStatus = getStatus();
    
    res.json({
      deviceId: identity.deviceId,
      deviceName: identity.deviceName,
      firmwareVersion: identity.firmwareVersion,
      mode: state.mode,
      status: 'running',
      isOnline: socket?.connected ?? false,
      network: netStatus,
      lastUpdated: state.lastUpdated,
    });
  });
  
  // GET /local/state - Get current state
  app.get('/local/state', (req: Request, res: Response) => {
    const state = loadState();
    res.json({ state });
  });
  
  // POST /local/state - Update state
  app.post('/local/state', (req: Request, res: Response) => {
    try {
      const state = saveState(req.body);
      res.json({ state });
    } catch (error) {
      res.status(400).json({ error: 'Invalid state' });
    }
  });
  
  // GET /local/config - Get config
  app.get('/local/config', (req: Request, res: Response) => {
    const config = loadConfig();
    const state = loadState();
    
    res.json({
      config,
      displayProfile: state.displayProfile,
      calibrationData: state.calibrationData,
    });
  });
  
  // POST /local/config - Update config
  app.post('/local/config', (req: Request, res: Response) => {
    try {
      const config = saveConfig(req.body);
      res.json({ config });
    } catch (error) {
      res.status(400).json({ error: 'Invalid config' });
    }
  });
  
  // GET /local/pairing-code - Get current pairing code
  app.get('/local/pairing-code', (req: Request, res: Response) => {
    const code = getPairingCode();
    const timeRemaining = getPairingCodeTimeRemaining();
    
    res.json({
      code: code?.code,
      expiresAt: code?.expiresAt,
      timeRemaining,
      formattedTime: formatTimeRemaining(timeRemaining),
    });
  });
  
  // POST /local/pairing-code/regenerate - Regenerate pairing code
  app.post('/local/pairing-code/regenerate', (req: Request, res: Response) => {
    const code = regeneratePairingCode();
    res.json({
      code: code.code,
      expiresAt: code.expiresAt,
    });
  });
  
  // GET /api/setup/status - Get setup status
  app.get('/api/setup/status', (req: Request, res: Response) => {
    const setupState: SetupState = {
      step: config.mode === 'setup' ? 'ap_created' : 'complete',
    };
    res.json({ state: setupState });
  });
  
  // GET /api/wifi/networks - Scan for networks
  app.get('/api/wifi/networks', async (req: Request, res: Response) => {
    try {
      const networks = await wifiScan();
      res.json({ networks });
    } catch (error) {
      res.status(500).json({ error: 'Failed to scan networks' });
    }
  });
  
  // POST /api/wifi/connect - Connect to network
  app.post('/api/wifi/connect', async (req: Request, res: Response) => {
    try {
      const { ssid, password } = req.body;
      
      if (!ssid) {
        res.status(400).json({ error: 'SSID is required' });
        return;
      }
      
      const success = await wifiConnect(ssid, password);
      res.json({ success, ssid });
    } catch (error) {
      res.status(500).json({ error: 'Connection failed' });
    }
  });
  
  // POST /api/wifi/forget - Forget network
  app.post('/api/wifi/forget', async (req: Request, res: Response) => {
    try {
      const { ssid } = req.body;
      
      if (!ssid) {
        res.status(400).json({ error: 'SSID is required' });
        return;
      }
      
      const success = await wifiForget(ssid);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to forget network' });
    }
  });
  
  // POST /api/setup/complete - Complete setup
  app.post('/api/setup/complete', (req: Request, res: Response) => {
    try {
      saveConfig({ mode: 'online' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to complete setup' });
    }
  });
  
  // GET /local/update/status - Get update status
  app.get('/local/update/status', (req: Request, res: Response) => {
    const status = updateManager.getStatus();
    res.json({ status });
  });
  
  // POST /local/update/check - Check for updates
  app.post('/local/update/check', async (req: Request, res: Response) => {
    try {
      const result = await updateManager.checkForUpdates();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Update check failed' });
    }
  });
  
  // POST /local/update/install - Install update
  app.post('/local/update/install', async (req: Request, res: Response) => {
    try {
      const { version } = req.body;
      
      if (!version) {
        res.status(400).json({ error: 'Version is required' });
        return;
      }
      
      await updateManager.installUpdate(version);
      res.json({ success: true, message: 'Update installation started' });
    } catch (error) {
      res.status(500).json({ error: 'Update installation failed' });
    }
  });
  
  // Start server
  app.listen(port, '127.0.0.1', () => {
    console.log(`Local API server running on http://127.0.0.1:${port}`);
  });
}
