# Shotclock Platform Setup Guide

Quick start guide for setting up the Shotclock Platform.

## Prerequisites

- Node.js 20 LTS, 22 LTS, or 24 LTS. Node 23 is not supported.
- pnpm 10+
- SQLite via Prisma. Production currently uses a SQLite file on the server.
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

## Current Production Stack

- Domain: `courtcast.safety-linq.com`
- Server app directory: `/opt/courtcast/shotclock-platform`
- Server database: SQLite at `/opt/courtcast/data/prod.db`
- Uploaded presentation media: `apps/server-web/public/media/devices/`
- Server service: `courtcast`
- Pi app symlink: `/opt/shotclock/current`
- Pi services: `shotclock-agent`, `shotclock-kiosk`

## Pi Deployment

### 1. Flash Raspberry Pi OS

1. Download Raspberry Pi OS with Desktop from https://www.raspberrypi.com/software/
2. Flash to SD card using Raspberry Pi Imager
3. Enable SSH and configure WiFi

### 2. Run Installation Script

```bash
# SSH into your Pi
ssh admin@raspberrypi.local

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
3. Open http://sportsboard.local in a browser
4. Select your WiFi network and enter credentials
5. Click "Complete Setup"

If `.local` does not resolve from your phone/tablet, use the fallback URL shown on the Pi: http://192.168.4.1:8080.

### 4. Configure And Build Pi App

Edit the shared Pi environment:

```bash
sudo nano /opt/shotclock/shared/.env
```

Minimum production values:

```bash
SERVER_URL=https://courtcast.safety-linq.com
AGENT_LOCAL_API_PORT=3001
DEVICE_NAME=Shotclock Display 01
SETUP_AP_SSID=Shotclock-Setup
SETUP_AP_PASSWORD=shotclock123
SETUP_PORTAL_HOST=sportsboard.local
KIOSK_USER=admin
KIOSK_DISPLAY_OUTPUT=auto
KIOSK_DISPLAY_MODE=1024x768
KIOSK_DISPLAY_RATE=60
KIOSK_HIDE_CURSOR=true
PI5_PSU_MAX_CURRENT=5000
PI5_AUTO_BOOT_ON_POWER=true
```

Set `KIOSK_USER` to the desktop login user that owns the HDMI session. On the current field Pi this is `admin`.

For NovaStar MSD300-1 deployments, keep `KIOSK_DISPLAY_MODE=1024x768` and `KIOSK_DISPLAY_RATE=60`. Field testing found that higher Pi output resolutions could show moving blue-dot artifacts on running basketball displays even though static images and the idle basketball display were clean. RGB-to-BGR color correction remains appropriate on this controller path when it is needed for correct colors.

Keep `KIOSK_HIDE_CURSOR=true` in production. The installer installs `unclutter`, and the kiosk launcher uses it to hide the cursor immediately. To temporarily show the cursor on the Pi desktop, set `KIOSK_HIDE_CURSOR=false` in `/opt/shotclock/shared/.env`, run `sudo pkill -x unclutter || true`, and restart `shotclock-kiosk`.

For embedded Raspberry Pi 5 installs powered from the LED display power supply or direct 5V/GPIO rail, keep `PI5_PSU_MAX_CURRENT=5000` and `PI5_AUTO_BOOT_ON_POWER=true`. The installer applies `PSU_MAX_CURRENT=5000`, `POWER_OFF_ON_HALT=0`, and `WAIT_FOR_POWER_BUTTON=0` to EEPROM so the Pi has the correct 5A assumption and does not intentionally wait for the power button. After this is first scheduled, shut down and remove panel power for at least 10 seconds before restarting. If the Pi starts green/HDMI then returns to red until the power button is pressed later, fix the embedded power sequencing: the shared LED rail is not stable early enough for the Pi cold start.

Build and point systemd at the checkout:

```bash
pnpm install
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/display-core build
pnpm --filter @shotclock/pi-agent build
pnpm --filter @shotclock/pi-kiosk build
sudo ln -sfn "$PWD" /opt/shotclock/current
sudo systemctl daemon-reload
```

### 5. Start Services

```bash
sudo systemctl start shotclock-agent
sudo systemctl start shotclock-kiosk
```

## Updating Production

Server update:

```bash
cd /opt/courtcast/shotclock-platform
git pull --ff-only
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
mkdir -p apps/server-web/public/media/devices
rm -rf apps/server-web/.next
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/server-web build
sudo systemctl restart courtcast
```

Pi update:

```bash
cd ~/shotclock-platform
git pull --ff-only
pnpm install --frozen-lockfile
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/display-core build
pnpm --filter @shotclock/pi-agent build
pnpm --filter @shotclock/pi-kiosk build
sudo ln -sfn "$PWD" /opt/shotclock/current
sudo systemctl restart shotclock-agent shotclock-kiosk
```

## Pairing a Device

1. Open the dashboard at http://your-server:3000
2. Log in. The production super account is `conner@two-a-days.com` / `PatchWork22!!`.
3. Go to the "Pair" page
4. Enter the pairing code shown on the Pi display
5. The device will appear in the device list

## Device Media

Device media is managed from:

```text
/devices/[deviceId]/settings
```

The Presentation Media section manages files for:

- Ads
- Logo
- Sponsor
- Team Intro
- Music

The database stores metadata and slot assignments in `DeviceMediaAsset`. Files are stored on disk under `apps/server-web/public/media/devices/`. This keeps SQLite small and gives a straightforward future path to object storage if needed.

## Color Correction

The Pi kiosk applies RGB to BGR color correction by default for LED processor chains that swap red and blue channels, such as Pi HDMI to NovaStar Taurus M3 to LED panels. Toggle and save this per device from:

```text
/devices/[deviceId]/settings
```

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
