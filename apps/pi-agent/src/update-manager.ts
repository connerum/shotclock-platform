import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable, Transform, type TransformCallback } from 'stream';
import { pipeline } from 'stream/promises';
import type { UpdateStatus, FirmwareRelease } from '@shotclock/shared/types';
import { sendUpdateStatus } from './socket-client.js';
import { RUNTIME_VERSION } from './runtime-version.js';

const execFileAsync = promisify(execFile);
const CURRENT_VERSION = RUNTIME_VERSION;

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
    this.serverUrl = config.serverUrl.replace(/\/$/, '');
    this.updateDir = path.join(os.homedir(), '.shotclock', 'updates');
    this.state = this.loadState();
    fs.mkdirSync(this.updateDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(this.updateDir, 0o700);

    if (this.state.currentVersion !== CURRENT_VERSION) {
      this.state = {
        ...this.state,
        status: 'idle',
        progress: 0,
        currentVersion: CURRENT_VERSION,
        completedAt: Date.now(),
        error: undefined,
      };
      this.saveState();
    }
  }

  private loadState(): UpdateState {
    const stateFile = path.join(os.homedir(), '.shotclock', 'update-state.json');
    try {
      if (fs.existsSync(stateFile)) return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    } catch (error) {
      console.error('Error loading update state:', error);
    }
    return { status: 'idle', progress: 0, currentVersion: CURRENT_VERSION };
  }

  private saveState(): void {
    const stateFile = path.join(os.homedir(), '.shotclock', 'update-state.json');
    fs.writeFileSync(stateFile, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    fs.chmodSync(stateFile, 0o600);
  }

  getStatus(): UpdateState {
    return { ...this.state };
  }

  async checkForUpdates(): Promise<{ available: boolean; currentVersion: string; latestVersion?: string; release?: FirmwareRelease; error?: string }> {
    try {
      this.state.status = 'checking';
      this.broadcastStatus();
      const response = await fetch(`${this.serverUrl}/api/updates/manifest`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Update manifest returned HTTP ${response.status}`);

      const data = await response.json() as { latestVersion: string | null; releases: FirmwareRelease[] };
      this.state.latestVersion = data.latestVersion || undefined;
      this.state.release = data.releases.find((release) => release.version === data.latestVersion);
      this.state.status = 'idle';
      this.state.error = undefined;
      this.saveState();

      return {
        available: Boolean(this.state.latestVersion && this.state.latestVersion !== this.state.currentVersion),
        currentVersion: this.state.currentVersion,
        latestVersion: this.state.latestVersion || this.state.currentVersion,
        release: this.state.release,
      };
    } catch (error) {
      this.state.status = 'error';
      this.state.error = error instanceof Error ? error.message : 'Update check failed';
      this.saveState();
      return { available: false, currentVersion: this.state.currentVersion, error: this.state.error };
    }
  }

  async installUpdate(version: string): Promise<{ success: boolean; version: string; error?: string }> {
    try {
      if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid release version');
      if (this.state.latestVersion !== version || this.state.release?.version !== version) throw new Error('Version is not available');
      const release = this.state.release;
      if (!release) throw new Error('Release metadata is missing');
      if (!Number.isSafeInteger(release.size) || release.size <= 0 || release.size > 2_000_000_000) throw new Error('Release size is invalid');

      const downloadUrl = new URL(release.downloadUrl, this.serverUrl);
      if (downloadUrl.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('Production updates require HTTPS');
      const expectedChecksum = normalizeChecksum(release.checksum);
      const downloadPath = path.join(this.updateDir, `shotclock-${version}.tar.gz`);
      const temporaryPath = `${downloadPath}.part`;

      this.state = { ...this.state, status: 'downloading', progress: 0, startedAt: Date.now(), error: undefined };
      this.broadcastStatus();
      const result = await this.downloadFile(downloadUrl.toString(), temporaryPath, release.size);
      if (result.size !== release.size) throw new Error(`Release size mismatch: expected ${release.size}, received ${result.size}`);
      if (result.checksum !== expectedChecksum) throw new Error('Release checksum mismatch');
      await fs.promises.rename(temporaryPath, downloadPath);
      await fs.promises.chmod(downloadPath, 0o600);
      await this.validateArchive(downloadPath);

      this.state.status = 'installing';
      this.state.progress = 100;
      this.saveState();
      this.broadcastStatus();

      const unit = `shotclock-update-${version.replace(/[^0-9A-Za-z_.-]/g, '-')}`;
      await execFileAsync('systemd-run', [
        '--unit', unit,
        '--collect',
        '/bin/bash',
        '/opt/shotclock/current/scripts/apply-pi-update.sh',
        downloadPath,
        version,
        expectedChecksum,
      ]);

      return { success: true, version };
    } catch (error) {
      this.state.status = 'error';
      this.state.error = error instanceof Error ? error.message : 'Update installation failed';
      this.saveState();
      this.broadcastStatus();
      return { success: false, version, error: this.state.error };
    }
  }

  private async downloadFile(url: string, destination: string, expectedSize: number): Promise<{ size: number; checksum: string }> {
    const response = await fetch(url, { signal: AbortSignal.timeout(10 * 60_000) });
    if (!response.ok || !response.body) throw new Error(`Download failed with HTTP ${response.status}`);

    let received = 0;
    const hash = createHash('sha256');
    const meter = new Transform({
      transform: (chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) => {
        received += chunk.length;
        if (received > expectedSize) return callback(new Error('Downloaded release exceeds declared size'));
        hash.update(chunk);
        this.state.progress = Math.min(99, Math.floor((received / expectedSize) * 100));
        this.broadcastStatus();
        callback(null, chunk);
      },
    });

    try {
      const webStream = response.body as unknown as Parameters<typeof Readable.fromWeb>[0];
      await pipeline(Readable.fromWeb(webStream), meter, fs.createWriteStream(destination, { mode: 0o600 }));
      return { size: received, checksum: hash.digest('hex') };
    } catch (error) {
      await fs.promises.rm(destination, { force: true });
      throw error;
    }
  }

  private async validateArchive(archivePath: string): Promise<void> {
    const { stdout } = await execFileAsync('tar', ['-tzf', archivePath], { maxBuffer: 8 * 1024 * 1024 });
    const entries = stdout.split('\n').filter(Boolean);
    if (entries.length === 0 || entries.length > 100_000) throw new Error('Release archive is empty or unreasonably large');
    for (const entry of entries) {
      const normalized = path.posix.normalize(entry);
      if (entry.startsWith('/') || normalized === '..' || normalized.startsWith('../')) {
        throw new Error(`Unsafe archive entry: ${entry}`);
      }
    }
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

  getUpdateHistory(): Array<{ version: string; installedAt: number }> {
    return this.state.completedAt ? [{ version: this.state.currentVersion, installedAt: this.state.completedAt }] : [];
  }
}

export function normalizeChecksum(value: string): string {
  const normalized = value.toLowerCase().replace(/^sha256:/, '').trim();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error('Release checksum must be a SHA-256 digest');
  return normalized;
}
