# Shotclock Platform

Sports Scoreboard & Display Management System

## Overview

Shotclock is a monorepo containing the complete platform for managing sports scoreboard displays. It includes a web dashboard for controlling displays, a local agent that runs on Raspberry Pi devices, and a fullscreen kiosk application.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Shotclock Platform                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         apps/                                         │   │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌────────────────────────┐  │   │
│  │  │ server-web  │  │    pi-agent     │  │      pi-kiosk         │  │   │
│  │  │  Next.js    │  │  Node.js/TS     │  │   React/Vite/TS      │  │   │
│  │  │  Dashboard  │  │  Device Agent   │  │   Fullscreen Display  │  │   │
│  │  │  + Socket.IO│  │  + Local API     │  │                      │  │   │
│  │  └─────────────┘  └─────────────────┘  └────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        packages/                                      │   │
│  │  ┌───────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │   │
│  │  │  shared   │  │  display-core   │  │      sports-core        │  │   │
│  │  │  Types    │  │  Display Math   │  │  Timer/Scoreboard Logic │  │   │
│  │  │  Schemas  │  │  Calibration    │  │                        │  │   │
│  │  │  Events   │  │                 │  │                        │  │   │
│  │  └───────────┘  └─────────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌───────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  prisma/  │  │  scripts/  │  │  systemd/    │  │      docs/      │   │
│  │  Schema   │  │  Install    │  │  Services    │  │   Documentation │   │
│  │  + Seed   │  │  Launch     │  │              │  │                 │   │
│  │           │  │  Build      │  │              │  │                 │   │
│  └───────────┘  └────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

Device Network Flow:

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser    │◀───────▶│  Next.js     │◀───────▶│   SQLite     │
│  Dashboard   │  HTTP/   │  Server      │  Prisma │  Database    │
└──────────────┘  Socket  └──────────────┘         └──────────────┘
                            │     ▲
                            │     │
                      Socket.IO │
                            │     │
         ┌──────────────────┼─────┼──────────────────┐
         │                  │     │                  │
         │           ┌──────▼─────▼──────┐           │
         │           │   Pi Agent         │           │
         │           │   (Socket Client)  │           │
         │           └─────────┬─────────┘           │
         │                     │                     │
         │            ┌────────▼────────┐            │
         │            │  Pi Kiosk      │            │
         │            │  (Chromium)    │            │
         │            └────────────────┘            │
         │                                         │
    ┌────▼────┐                              ┌────▼────┐
    │ Setup   │                              │  WiFi   │
    │ AP      │                              │ Network │
    │ (CAP)   │                              │         │
    └─────────┘                              └─────────┘
```

## Packages

### @shotclock/shared
Shared TypeScript types, schemas, and Socket.IO event contracts.

### @shotclock/display-core
Display profile management, viewport math, and calibration helpers.

### @shotclock/sports-core
Timer state, scoreboard state, and wrestling match state logic.

## Apps

### @shotclock/server-web
Next.js 14 application with:
- Dashboard UI for device management
- Email/password authentication with per-user device ownership
- Socket.IO server for real-time communication
- REST API for device configuration
- Prisma ORM for data persistence
- Device-scoped media uploads for ads, logo, sponsor, team intro, and music

### @shotclock/pi-agent
Node.js agent that runs on Raspberry Pi:
- Socket.IO client connecting to server
- Local API on port 3001
- WiFi management and captive portal
- Firmware update handling
- Offline mode support

### @shotclock/pi-kiosk
React kiosk application:
- Mode-based rendering (setup, pairing, shot-clock, calibration, etc.)
- Basketball, wrestling, volleyball, media, and emergency overlays
- Local API polling for state updates
- CSS transform-based viewport scaling
- Fullscreen Chromium display

## Development

### Prerequisites

- Node.js 20 LTS, Node.js 22 LTS, or Node.js 24 LTS
- pnpm 10+
- SQLite through Prisma

### Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development servers
pnpm dev
```

### Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### Database Setup

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Seed database
pnpm prisma db seed
```

## Project Structure

```
shotclock-platform/
├── apps/
│   ├── server-web/          # Next.js dashboard + Socket.IO server
│   ├── pi-agent/            # Raspberry Pi agent service
│   └── pi-kiosk/            # Chromium kiosk application
├── packages/
│   ├── shared/              # Shared types and schemas
│   ├── display-core/        # Display profile utilities
│   └── sports-core/          # Sports timing logic
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts              # Database seeder
├── scripts/
│   ├── install-pi.sh        # Pi installation script
│   ├── launch-kiosk.sh      # Kiosk launch script
│   └── build-release.sh     # Release builder
├── systemd/
│   ├── shotclock-agent.service
│   └── shotclock-kiosk.service
├── docs/
│   ├── setup.md             # Quick start guide
│   ├── pi-setup.md          # Detailed Pi setup
│   ├── captive-portal.md    # Portal documentation
│   ├── remote-updates.md    # OTA update system
│   ├── controller-abstraction.md
│   └── agent-prompts.md
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

## API Reference

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/devices | List all devices |
| POST | /api/devices | Register device |
| GET | /api/devices/:id | Get device |
| PATCH | /api/devices/:id | Update device |
| GET | /api/devices/:id/config | Get display config |
| PATCH | /api/devices/:id/config | Update display config |
| GET | /api/devices/:id/state | Get display state |
| POST | /api/devices/:id/state | Update display state |
| POST | /api/devices/:id/command | Send command |
| GET | /api/devices/:id/media | List device presentation media |
| POST | /api/devices/:id/media | Upload device presentation media |
| PATCH | /api/devices/:id/media/:assetId | Enable/select device media |
| DELETE | /api/devices/:id/media/:assetId | Delete device media |
| POST | /api/pair | Initiate pairing |
| GET | /api/pair/:code | Validate pairing code |
| GET | /api/updates/manifest | Get update manifest |
| GET | /api/updates/releases | List releases |
| POST | /api/updates/releases | Create release |

### Local API (Pi Agent)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /local/status | Device status |
| GET | /local/state | Current state |
| POST | /local/state | Update state |
| GET | /local/config | Display config |
| POST | /local/config | Update config |
| GET | /local/pairing-code | Get pairing code |
| POST | /local/pairing-code/regenerate | Regenerate code |
| GET | /api/setup/status | Setup status |
| GET | /api/wifi/networks | WiFi scan |
| POST | /api/wifi/connect | Connect WiFi |
| POST | /api/wifi/forget | Forget WiFi |
| POST | /api/setup/complete | Complete setup |
| GET | /local/update/status | Update status |
| POST | /local/update/check | Check updates |
| POST | /local/update/install | Install update |

### Socket.IO Events

**Server → Device:**
- `state:update` - Update timer/score state
- `config:update` - Update display config
- `mode:set` - Set device mode
- `presentation:show` - Show ads, logo, sponsor, intro, music, sound, or emergency overlay
- `factory:reset` - Reset pairing/network/display state
- `update:check` - Check for updates
- `update:install` - Install update
- `reboot` - Reboot device
- `ping` - Ping device

**Device → Server:**
- `device:hello` - Initial hello with capabilities
- `device:heartbeat` - Periodic heartbeat
- `device:state:ack` - State update acknowledgment
- `device:config:ack` - Config update acknowledgment
- `device:update:status` - Update progress

## Deployment

### Production Build

```bash
./scripts/build-release.sh 0.2.0
```

This creates:
- `/opt/shotclock/releases/0.2.0/` - Release files
- `/opt/shotclock/releases/shotclock-0.2.0.tar.gz` - Archive

### Pi Installation

```bash
# SSH into Pi
# Download platform
git clone https://github.com/connerum/shotclock-platform.git
cd shotclock-platform

# Run installer
chmod +x scripts/install-pi.sh
sudo ./scripts/install-pi.sh

# Configure the central server and kiosk desktop user
sudo nano /opt/shotclock/shared/.env

# Build the Pi packages
pnpm install
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/pi-agent build
pnpm --filter @shotclock/pi-kiosk build

# Point services at this checkout
sudo ln -sfn "$PWD" /opt/shotclock/current
sudo systemctl daemon-reload
```

### Systemd Services

```bash
# Start services
sudo systemctl start shotclock-agent
sudo systemctl start shotclock-kiosk

# Enable on boot
sudo systemctl enable shotclock-agent
sudo systemctl enable shotclock-kiosk

# View logs
journalctl -u shotclock-agent -f
journalctl -u shotclock-kiosk -f
```

## License

Private - All rights reserved
