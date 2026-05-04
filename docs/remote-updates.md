# Remote Updates Documentation

How the remote firmware update framework works.

## Overview

Shotclock devices can receive firmware updates over-the-air (OTA). The system supports:
- Version checking
- Download with progress
- Staged updates
- Automatic installation on reboot

## Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Update Flow                                │
└─────────────────────────────────────────────────────────────────┘

     Server                              Device (Pi Agent)
        │                                      │
        │  1. check-for-updates               │
        │◀─────────────────────────────────────│
        │                                      │
        │  2. update-manifest                  │
        │  { latest: "0.2.0", releases: [...] }│
        │─────────────────────────────────────▶│
        │                                      │
        │  (if update available)                │
        │  3. download-firmware                 │
        │◀─────────────────────────────────────│
        │                                      │
        │  4. binary-data                      │
        │  (chunked transfer)                   │
        │─────────────────────────────────────▶│
        │                                      │
        │  5. verify-checksum                  │
        │◀─────────────────────────────────────│
        │                                      │
        │  6. stage-update                     │
        │◀─────────────────────────────────────│
        │                                      │
        │  7. apply-on-reboot                  │
        │◀─────────────────────────────────────│
        │                                      │
        │  8. reboot                           │
        │◀─────────────────────────────────────│
        │                                      │
        │  [Device reboots]                    │
        │  [New version runs]                  │
        │                                      │
```

## Update Manifest

The update manifest is served at `GET /api/updates/manifest`:

```json
{
  "latestVersion": "0.2.0",
  "minServerVersion": "0.1.0",
  "releases": [
    {
      "version": "0.2.0",
      "releaseDate": "2024-02-01T00:00:00Z",
      "downloadUrl": "https://releases.shotclock.local/0.2.0/agent.tar.gz",
      "checksum": "sha256:a1b2c3d4e5f6...",
      "size": 52428800,
      "notes": "Bug fixes and performance improvements",
      "isMandatory": false,
      "minServerVersion": "0.1.0"
    },
    {
      "version": "0.1.0",
      "releaseDate": "2024-01-01T00:00:00Z",
      "downloadUrl": "https://releases.shotclock.local/0.1.0/agent.tar.gz",
      "checksum": "sha256:...",
      "size": 50000000,
      "notes": "Initial release",
      "isMandatory": false,
      "minServerVersion": "0.1.0"
    }
  ]
}
```

## Local API Endpoints

### Check Update Status

```bash
GET /local/update/status
```

Response:
```json
{
  "status": {
    "status": "idle",
    "progress": 0,
    "currentVersion": "0.1.0",
    "latestVersion": "0.2.0",
    "release": {...}
  }
}
```

### Check for Updates

```bash
POST /local/update/check
```

Response:
```json
{
  "available": true,
  "currentVersion": "0.1.0",
  "latestVersion": "0.2.0",
  "release": {
    "version": "0.2.0",
    "size": 52428800,
    "notes": "Bug fixes..."
  }
}
```

### Install Update

```bash
POST /local/update/install
{"version": "0.2.0"}
```

Response:
```json
{
  "success": true,
  "message": "Update installation started"
}
```

## Update Manager Implementation

The `UpdateManager` class handles:

1. **State Management**
   - Tracks current update state
   - Persists state across restarts
   - Reports progress via Socket.IO

2. **Download**
   - HTTP download with progress
   - Resumable downloads (future)
   - Concurrent chunk downloads (future)

3. **Verification**
   - SHA256 checksum verification
   - Size validation
   - Signature verification (future)

4. **Staging**
   - Extracts to staging directory
   - Verifies installation script
   - Prepares rollback info

5. **Installation**
   - Updates symlink to new version
   - Schedules install on reboot
   - Handles failures gracefully

## Server-Side Management

### Dashboard UI

The releases page (`/releases`) allows administrators to:
- View all firmware releases
- Upload new releases
- Set mandatory updates
- View update status across devices

### Socket.IO Events

Devices receive updates via Socket.IO:

```typescript
// From server to device
socket.on('update:check', () => {...})
socket.on('update:install', (version: string) => {...})

// From device to server
socket.emit('device:update:status', {
  deviceId: string,
  status: UpdateStatus,
  progress?: number,
  version?: string,
  error?: string
})
```

## Release Management

### Creating a Release

1. Build the release:
   ```bash
   ./scripts/build-release.sh 0.2.0
   ```

2. Upload to release server:
   ```bash
   scp shotclock-0.2.0.tar.gz releases@releases.shotclock.local:/var/www/releases/
   ```

3. Create release via API:
   ```bash
   curl -X POST http://localhost:3000/api/updates/releases \
     -H "Content-Type: application/json" \
     -d '{
       "version": "0.2.0",
       "downloadUrl": "https://releases.shotclock.local/0.2.0/agent.tar.gz",
       "checksum": "sha256:...",
       "size": 52428800,
       "notes": "Bug fixes"
     }'
   ```

### Mandatory Updates

Set `isMandatory: true` to force devices to update. Non-mandatory updates can be deferred by the user.

## Troubleshooting

### Update fails to download

Check:
- Network connectivity
- URL is accessible
- Disk space available

### Checksum mismatch

1. Re-download the release
2. Verify checksum on server
3. Report if issue persists

### Device stuck in update

1. Check update state: `curl http://localhost:3001/local/update/status`
2. Clear staging: `rm -rf ~/.shotclock/updates/`
3. Retry update

### Rollback

If an update fails, the device can rollback:

```bash
# List available versions
ls /opt/shotclock/releases/

# Switch to a different version
ln -sfn /opt/shotclock/releases/0.1.0 /opt/shotclock/current
systemctl restart shotclock-agent
```
