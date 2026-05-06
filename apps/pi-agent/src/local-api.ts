// Local API - Express API on localhost:3001

import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import type { DeviceIdentity } from './identity.js';
import type { AgentConfig } from './config-store.js';
import type { TypedSocket } from './socket-client.js';
import type { UpdateManager } from './update-manager.js';
import type { OfflineMode } from './offline-mode.js';
import { loadEffectiveState, loadState, saveState } from './state-store.js';
import { getPairingCode, regeneratePairingCode, getPairingCodeTimeRemaining, formatTimeRemaining } from './pairing-code.js';
import { saveConfig as saveAgentConfig, loadConfig as loadAgentConfig } from './config-store.js';
import { setupAP } from './setup-ap.js';
import { wifiManager } from './wifi-manager.js';
import type { DeviceMode, TimerState } from '@shotclock/shared/types';
import { rebaseTimerStateToLocalClock } from '@shotclock/shared/timer';
import { getSetupApConfig } from './setup-mode.js';

interface SetupState {
  step: 'initial' | 'ap_created' | 'network_selected' | 'network_connected' | 'complete';
  ssid?: string;
}

export function startLocalApi(
  identity: DeviceIdentity,
  config: AgentConfig,
  _socket: TypedSocket,
  updateManager: UpdateManager,
  _offlineMode: OfflineMode
): void {
  const app = express();
  const port = config.localApiPort || 3001;
  const kioskDistDir = resolveKioskDistDir();
  
  app.use(express.json());
  
  // GET /local/status - Get device status
  app.get('/local/status', async (_req: Request, res: Response) => {
    const state = loadState();
    const netStatus = await wifiManager.getStatus();
    
    res.json({
      deviceId: identity.deviceId,
      deviceName: identity.deviceName,
      firmwareVersion: identity.firmwareVersion,
      mode: state.mode,
      setupAp: getSetupApConfig(identity, loadAgentConfig()),
      status: 'running',
      isOnline: _socket.connected,
      network: netStatus,
      lastUpdated: state.lastUpdated,
    });
  });
  
  // GET /local/state - Get current state
  app.get('/local/state', (_req: Request, res: Response) => {
    const state = loadState();
    res.json({ state });
  });
  
  // POST /local/state - Update state
  app.post('/local/state', (req: Request, res: Response) => {
    try {
      const { mode, timerState } = req.body;
      const state = saveState({
        ...(mode && { mode: mode as DeviceMode }),
        ...(timerState && { timerState: rebaseTimerStateToLocalClock(timerState as TimerState) }),
      });
      res.json({ state });
    } catch (error) {
      res.status(400).json({ error: 'Invalid state' });
    }
  });
  
  // GET /local/config - Get config
  app.get('/local/config', (_req: Request, res: Response) => {
    const configData = loadAgentConfig();
    const state = loadEffectiveState();
    
    res.json({
      config: configData,
      displayProfile: state.displayProfile,
      calibrationData: state.calibrationData,
      setupAp: getSetupApConfig(identity, configData),
    });
  });
  
  // POST /local/config - Update config
  app.post('/local/config', (req: Request, res: Response) => {
    try {
      const { displayProfile, calibrationData, ...agentConfigUpdates } = req.body;
      const configData = Object.keys(agentConfigUpdates).length > 0
        ? saveAgentConfig(agentConfigUpdates)
        : loadAgentConfig();

      if (displayProfile || calibrationData) {
        saveState({
          ...(displayProfile && { displayProfile }),
          ...(calibrationData && { calibrationData }),
        });
      }

      const state = loadState();
      res.json({
        config: configData,
        displayProfile: state.displayProfile,
        calibrationData: state.calibrationData,
      });
    } catch (error) {
      res.status(400).json({ error: 'Invalid config' });
    }
  });
  
  // GET /local/pairing-code - Get current pairing code
  app.get('/local/pairing-code', (_req: Request, res: Response) => {
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
  app.post('/local/pairing-code/regenerate', (_req: Request, res: Response) => {
    const code = regeneratePairingCode();
    res.json({
      code: code.code,
      expiresAt: code.expiresAt,
    });
  });
  
  // GET /api/setup/status - Get setup status
  app.get('/api/setup/status', (_req: Request, res: Response) => {
    const currentConfig = loadAgentConfig();
    const setupState: SetupState = {
      step: currentConfig.mode === 'setup' ? 'ap_created' : 'complete',
    };
    res.json({ configured: currentConfig.mode !== 'setup', state: setupState });
  });
  
  // GET /api/wifi/networks - Scan for networks
  app.get('/api/wifi/networks', async (_req: Request, res: Response) => {
    try {
      const networks = await wifiManager.scan();
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
      
      const success = await wifiManager.connect(ssid, password);
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
      
      const success = await wifiManager.forget(ssid);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to forget network' });
    }
  });
  
  // POST /api/setup/complete - Complete setup
  app.post('/api/setup/complete', async (_req: Request, res: Response) => {
    try {
      saveAgentConfig({ mode: 'online' });
      await setupAP.stop();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to complete setup' });
    }
  });
  
  // GET /local/update/status - Get update status
  app.get('/local/update/status', (_req: Request, res: Response) => {
    const status = updateManager.getStatus();
    res.json({ status });
  });
  
  // POST /local/update/check - Check for updates
  app.post('/local/update/check', async (_req: Request, res: Response) => {
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

  if (kioskDistDir) {
    app.use(express.static(kioskDistDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(kioskDistDir, 'index.html'));
    });
    console.log(`Serving kiosk UI from ${kioskDistDir}`);
  } else {
    app.get('/', (_req: Request, res: Response) => {
      res.status(503).send('Shotclock kiosk build not found. Run pnpm --filter @shotclock/pi-kiosk build.');
    });
  }
  
  // Start server
  app.listen(port, '0.0.0.0', () => {
    console.log(`Local API server running on http://0.0.0.0:${port}`);
  });
}

function resolveKioskDistDir(): string | null {
  const candidates = [
    process.env.KIOSK_DIST_DIR,
    path.join(process.cwd(), 'apps', 'pi-kiosk', 'dist'),
    path.join(process.cwd(), 'pi-kiosk', 'dist'),
    path.join(process.cwd(), 'pi-kiosk'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return null;
}
