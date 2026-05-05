# Shotclock Platform Setup Guide

Quick start guide for setting up the Shotclock Platform.

## Prerequisites

- Node.js 20 LTS or 22 LTS (Node 23 is not supported)
- pnpm 8+
- PostgreSQL 14+ (for production)
- Raspberry Pi OS or similar (for Pi deployment)

## Development Setup

### 1. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install Node.js dependencies
pnpm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Set Up Database

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Seed the database
pnpm prisma db seed
```

### 4. Start Development Servers

```bash
# Start all packages in development mode
pnpm dev
```

This starts:
- Server Web: http://localhost:3000
- Pi Agent API: http://localhost:3001
- Pi Kiosk dev server: http://localhost:5173 or the next available Vite port
- Built Pi Kiosk on device: served by the Pi Agent at http://localhost:3001/

## Pi Deployment

### 1. Flash Raspberry Pi OS

1. Download Raspberry Pi OS Lite from https://www.raspberrypi.com/software/
2. Flash to SD card using Raspberry Pi Imager
3. Enable SSH and configure WiFi

### 2. Run Installation Script

```bash
# SSH into your Pi
ssh pi@raspberrypi.local

# Download the platform
git clone https://github.com/connerum/shotclock-platform.git
cd shotclock-platform

# Run the installation script
chmod +x scripts/install-pi.sh
sudo ./scripts/install-pi.sh
```

On Raspberry Pi OS/Debian Trixie, use the latest installer from this repo. Older installer versions may fail because Trixie provides `chromium` instead of `chromium-browser` and no longer provides `libgconf-2-4`. If the installer stops there, run:

```bash
cd shotclock-platform
git pull
sudo ./scripts/install-pi.sh
```

### 3. Configure WiFi

1. The Pi will create a setup AP named like "Shotclock-Setup-1e4b35" while it is unpaired
2. Connect to it with password "shotclock123"
3. Open http://192.168.4.1:8080 in a browser
4. Select your WiFi network and enter credentials
5. Click "Complete Setup"

### 4. Start Services

```bash
sudo systemctl start shotclock-agent
sudo systemctl start shotclock-kiosk
```

## Pairing a Device

1. Open the dashboard at http://your-server:3000
2. Go to the "Pair" page
3. Enter the pairing code shown on the Pi display
4. The device will appear in the device list

## Troubleshooting

### Agent won't start

Check logs:
```bash
journalctl -u shotclock-agent -f
```

### Kiosk display is blank

Check if Chromium is running:
```bash
ps aux | grep chromium
```

### Can't connect to device

1. Check network connectivity
2. Verify pairing code hasn't expired
3. Check firewall settings

## Next Steps

- See [pi-setup.md](./pi-setup.md) for detailed Pi setup
- See [captive-portal.md](./captive-portal.md) for portal flow
- See [remote-updates.md](./remote-updates.md) for firmware updates
- See [controller-abstraction.md](./controller-abstraction.md) for display profiles
