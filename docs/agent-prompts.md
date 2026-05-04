# AI Agent Prompts for Pi Agent

Instructions for AI agents assisting with Shotclock Pi Agent operations.

## System Overview

The Shotclock Pi Agent is a Node.js service running on Raspberry Pi devices that:
- Maintains connection to the central server via Socket.IO
- Manages local display state and configuration
- Handles firmware updates
- Provides a local API for kiosk control
- Manages WiFi and captive portal for setup

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Pi Agent                                 │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│  │  Socket.IO  │   │  Local API  │   │   Update Manager    │  │
│  │   Client    │   │  :3001      │   │                     │  │
│  └──────┬──────┘   └──────┬──────┘   └──────────┬──────────┘  │
│         │                  │                     │              │
│  ┌──────┴─────────────────┴─────────────────────┴──────────┐  │
│  │                    State Store                           │  │
│  │              ~/.shotclock/state.json                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Identity Store                          │  │
│  │              ~/.shotclock/device.json                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│  │  WiFi       │   │  Captive    │   │     Heartbeat       │  │
│  │  Manager    │   │  Portal     │   │       Loop          │  │
│  └─────────────┘   └─────────────┘   └─────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main entry point, initializes all components |
| `src/config-store.ts` | Persistent configuration at `~/.shotclock/config.json` |
| `src/state-store.ts` | Display state cache at `~/.shotclock/state.json` |
| `src/identity.ts` | Device identity at `~/.shotclock/device.json` |
| `src/socket-client.ts` | Socket.IO connection to central server |
| `src/local-api.ts` | Express API on port 3001 |
| `src/wifi-manager.ts` | NetworkManager wrapper |
| `src/captive-portal.ts` | Setup portal server |
| `src/update-manager.ts` | Firmware update handling |

## Common Tasks

### 1. Checking Agent Status

```bash
# Check if agent is running
systemctl status shotclock-agent

# View recent logs
journalctl -u shotclock-agent -n 50

# Check local API
curl http://localhost:3001/local/status
```

### 2. Resetting Device

To factory reset a device:

```bash
# Stop services
sudo systemctl stop shotclock-agent
sudo systemctl stop shotclock-kiosk

# Remove state files
rm -rf ~/.shotclock/config.json
rm -rf ~/.shotclock/state.json
# Keep device.json to preserve identity

# Reset config to defaults
# Edit ~/.shotclock/config.json:
{
  "mode": "setup",
  "serverUrl": "http://localhost:3000"
}

# Restart
sudo systemctl start shotclock-agent
sudo systemctl start shotclock-kiosk
```

### 3. Debugging Connection Issues

```bash
# Check network status
nmcli device wifi list
nmcli device status

# Test server connectivity
curl -v http://your-server:3000/api/health

# Check Socket.IO connection
# Enable debug logging:
DEBUG=socket.io:* systemctl restart shotclock-agent
journalctl -u shotclock-agent -f
```

### 4. Manual Pairing

If the device isn't pairing automatically:

```bash
# Get current pairing code
curl http://localhost:3001/local/pairing-code

# Regenerate if expired
curl -X POST http://localhost:3001/local/pairing-code/regenerate

# The device should appear in the dashboard at /pair
```

### 5. Updating Configuration

```bash
# View current config
curl http://localhost:3001/local/config

# Update config
curl -X POST http://localhost:3001/local/config \
  -H "Content-Type: application/json" \
  -d '{"deviceName": "Gym Display 1", "brightness": 80}'

# Update display profile
curl -X POST http://localhost:3001/local/config \
  -H "Content-Type: application/json" \
  -d '{"displayProfile": {"fontSize": {"shotClock": 250}}}'
```

### 6. Calibration

```bash
# Enter calibration mode
curl -X POST http://localhost:3001/local/state \
  -H "Content-Type: application/json" \
  -d '{"mode": {"type": "calibration"}}'

# After calibrating on the kiosk:
curl -X POST http://localhost:3001/local/config \
  -H "Content-Type: application/json" \
  -d '{"calibrationData": {"x": 10, "y": 5, "scaleX": 1.02, "scaleY": 0.98}}'

# Exit calibration mode
curl -X POST http://localhost:3001/local/state \
  -H "Content-Type: application/json" \
  -d '{"mode": {"type": "shot-clock"}}'
```

### 7. Forcing Updates

```bash
# Check for updates
curl -X POST http://localhost:3001/local/update/check

# Install specific version
curl -X POST http://localhost:3001/local/update/install \
  -H "Content-Type: application/json" \
  -d '{"version": "0.2.0"}'

# Check update status
curl http://localhost:3001/local/update/status
```

## Troubleshooting Guide

### Issue: Agent crashes on startup

1. Check Node.js version: `node --version` (needs 20+)
2. Check permissions: `ls -la ~/.shotclock/`
3. Verify port 3001 is free: `ss -tlnp | grep 3001`
4. Check for missing dependencies: `npm ls`

### Issue: Can't connect to WiFi

1. Verify SSID and password
2. Check if network is 2.4GHz
3. Try forgetting and re-adding:
   ```bash
   nmcli connection delete MyNetwork
   ```
3. Restart NetworkManager:
   ```bash
   sudo systemctl restart NetworkManager
   ```

### Issue: Kiosk shows "offline"

1. Agent might not be running: `systemctl status shotclock-agent`
2. Check Socket.IO connection in agent logs
3. Verify server URL is correct in config
4. Check firewall allows WebSocket connections

### Issue: Display calibration off

1. Ensure no physical display rotation
2. Reset calibration: `curl -X POST .../local/config -d '{"calibrationData": {"x":0,"y":0,"scaleX":1,"scaleY":1}}'`
3. Re-run calibration procedure
4. Check display resolution matches profile

### Issue: Updates fail to download

1. Check disk space: `df -h`
2. Verify URL is accessible: `curl -I <download-url>`
3. Clear update cache: `rm -rf ~/.shotclock/updates/`
4. Retry update

## Configuration Reference

### config.json

```json
{
  "serverUrl": "http://your-server:3000",
  "mode": "online|setup|pairing|offline",
  "heartbeatInterval": 30000,
  "pairingCodeLength": 6,
  "setupApSsid": "Shotclock-Setup",
  "setupApPassword": "shotclock123",
  "updateCheckInterval": 3600000,
  "localApiPort": 3001,
  "deviceName": "My Display"
}
```

### state.json

```json
{
  "mode": {"type": "shot-clock"},
  "displayProfile": {...},
  "calibrationData": {
    "x": 0, "y": 0,
    "scaleX": 1, "scaleY": 1,
    "rotation": 0
  },
  "lastUpdated": 1699900000000
}
```

### device.json

```json
{
  "deviceId": "shotclock-abc123",
  "deviceName": "Gym Display 1",
  "firmwareVersion": "0.1.0",
  "controllerType": "generic",
  "createdAt": 1699000000000,
  "pairedAt": 1699100000000,
  "organizationId": "org-123",
  "venueId": "venue-456"
}
```

## Emergency Recovery

### SSH Access Lost

1. Connect display via HDMI
2. Login locally with keyboard
3. Check network with `nmcli`
4. Reconfigure if needed

### Complete Reset

```bash
# Boot to single user mode
# Add to cmdline.txt: init=/bin/bash

# Mount filesystems
mount -o remount,rw /
mount -a

# Remove all Shotclock data
rm -rf ~/.shotclock/*
userdel -r shotclock 2>/dev/null || true

# Reinstall (from git)
cd /home/shotclock/shotclock-platform
git pull
./scripts/install-pi.sh
```
