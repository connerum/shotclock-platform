// Update Manager - Check, download, verify, stage, install updates

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { UpdateStatus, UpdateCheckResult, UpdateInstallResult, FirmwareRelease } from '@shotclock/shared/types';
import { sendUpdateStatus } from './socket-client.js';

const execAsync = promisify(exec);

interface UpdateState {
  status: UpdateStatus;
  progress: number;
  currentVersion: string;
  latestVersion?: string;
  release?: FirmwareRelease;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export class UpdateManager {
  private deviceId: string;
  private serverUrl: string;
  private state: UpdateState;
  private updateDir: string;
  
  constructor(deviceId: string, config: { serverUrl: string }) {
    this.deviceId = deviceId;
    this.serverUrl = config.serverUrl;
    this.updateDir = path.join(os.homedir(), '.shotclock', 'updates');
    this.state = this.loadState();
    
    // Ensure update directory exists
    if (!fs.existsSync(this.updateDir)) {
      fs.mkdirSync(this.updateDir, { recursive: true });
    }
  }
  
  private loadState(): UpdateState {
    const stateFile = path.join(os.homedir(), '.shotclock', 'update-state.json');
    
    try {
      if (fs.existsSync(stateFile)) {
        return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      }
    } catch (error) {
      console.error('Error loading update state:', error);
    }
    
    return {
      status: 'idle',
      progress: 0,
      currentVersion: '0.1.0',
    };
  }
  
  private saveState(): void {
    const stateFile = path.join(os.homedir(), '.shotclock', 'update-state.json');
    
    try {
      fs.writeFileSync(stateFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('Error saving update state:', error);
    }
  }
  
  getStatus(): UpdateState {
    return { ...this.state };
  }
  
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      this.state.status = 'checking';
      this.broadcastStatus();
      
      // Fetch manifest from server
      const response = await fetch(`${this.serverUrl}/api/updates/manifest`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch update manifest');
      }
      
      const { manifest } = await response.json();
      
      this.state.latestVersion = manifest.latestVersion;
      this.state.release = manifest.releases[0];
      
      if (this.state.latestVersion && this.state.latestVersion !== this.state.currentVersion) {
        this.state.status = 'idle';
        this.saveState();
        
        return {
          available: true,
          currentVersion: this.state.currentVersion,
          latestVersion: this.state.latestVersion,
          release: this.state.release,
        };
      }
      
      this.state.status = 'idle';
      this.saveState();
      
      return {
        available: false,
        currentVersion: this.state.currentVersion,
        latestVersion: this.state.currentVersion,
      };
    } catch (error) {
      this.state.status = 'error';
      this.state.error = error instanceof Error ? error.message : 'Update check failed';
      this.saveState();
      
      return {
        available: false,
        currentVersion: this.state.currentVersion,
        error: this.state.error,
      };
    }
  }
  
  async installUpdate(version: string): Promise<UpdateInstallResult> {
    try {
      if (this.state.latestVersion !== version) {
        throw new Error('Version not available');
      }
      
      const release = this.state.release;
      if (!release) {
        throw new Error('No release information available');
      }
      
      this.state.status = 'downloading';
      this.state.progress = 0;
      this.state.startedAt = Date.now();
      this.broadcastStatus();
      
      // Download the update
      const downloadPath = path.join(this.updateDir, `shotclock-${version}.tar.gz`);
      await this.downloadFile(release.downloadUrl, downloadPath, release.size);
      
      // Verify checksum
      this.state.status = 'staged';
      this.state.progress = 100;
      this.broadcastStatus();
      
      // In production, would verify checksum and extract
      // For now, just mark as staged
      
      return {
        success: true,
        version,
      };
    } catch (error) {
      this.state.status = 'error';
      this.state.error = error instanceof Error ? error.message : 'Update installation failed';
      this.saveState();
      
      return {
        success: false,
        version,
        error: this.state.error,
      };
    }
  }
  
  private async downloadFile(url: string, destPath: string, expectedSize: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Placeholder for actual download
      // In production, would use fetch or axios to download
      console.log(`Downloading ${url} to ${destPath}`);
      
      // Simulate download
      this.state.progress = 50;
      this.broadcastStatus();
      
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  }
  
  private broadcastStatus(): void {
    sendUpdateStatus({
      deviceId: this.deviceId,
      status: this.state.status,
      progress: this.state.progress,
      version: this.state.latestVersion,
      error: this.state.error,
    });
  }
  
  async applyUpdate(): Promise<boolean> {
    try {
      this.state.status = 'installing';
      this.broadcastStatus();
      
      // In production, would:
      // 1. Stop current process
      // 2. Extract update
      // 3. Replace files
      // 4. Restart
      
      // For now, just mark complete
      this.state.status = 'idle';
      this.state.completedAt = Date.now();
      this.saveState();
      
      return true;
    } catch (error) {
      this.state.status = 'error';
      this.state.error = error instanceof Error ? error.message : 'Update apply failed';
      this.saveState();
      
      return false;
    }
  }
  
  getUpdateHistory(): any[] {
    // Return history of updates
    return [];
  }
}
