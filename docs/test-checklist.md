# Shotclock Platform - Test Checklist

## Definition of Done

All items must pass before deployment is considered complete.

---

## 1. Server Starts Locally

- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @shotclock/shared build` succeeds
- [ ] `pnpm --filter @shotclock/display-core build` succeeds
- [ ] `pnpm --filter @shotclock/sports-core build` succeeds
- [ ] `pnpm --filter @shotclock/server-web build` succeeds
- [ ] `pnpm --filter @shotclock/pi-agent build` succeeds
- [ ] `pnpm --filter @shotclock/pi-kiosk build` succeeds
- [ ] `pnpm build` (full monorepo) completes with zero errors
- [ ] Database migrations run: `pnpm prisma migrate dev`
- [ ] Production migration path runs: `pnpm prisma migrate deploy`
- [ ] Server starts: `pnpm --filter @shotclock/server-web dev`
- [ ] Server responds on port 3000

---

## 2. Web Dashboard Loads

- [ ] Dashboard accessible at http://localhost:3000
- [ ] No console errors on page load
- [ ] Navigation between pages works:
  - [ ] Devices list page (`/devices`)
  - [ ] Device detail page (`/devices/[deviceId]`)
  - [ ] Pair page (`/pair`)
  - [ ] Releases page (`/releases`)
- [ ] API routes respond correctly:
  - [ ] `GET /api/devices`
  - [ ] `GET /api/devices/[deviceId]`
  - [ ] `POST /api/devices/[deviceId]/command`
  - [ ] `GET /api/devices/[deviceId]/media`
  - [ ] `POST /api/devices/[deviceId]/media`
  - [ ] `GET /api/updates/manifest`
  - [ ] `POST /api/pair`

---

## 3. Pi Agent Starts

- [ ] `pnpm --filter @shotclock/pi-agent build` completes successfully
- [ ] `pnpm --filter @shotclock/pi-agent dev` starts without errors
- [ ] Local API responds at http://localhost:3001
- [ ] Health endpoint responds: `curl http://localhost:3001/local/status`
- [ ] Config endpoint responds: `curl http://localhost:3001/local/config`
- [ ] State endpoint responds: `curl http://localhost:3001/local/state`
- [ ] Socket.IO connects to server (check logs)
- [ ] Device identity is generated at `~/.shotclock/device.json`

---

## 4. Kiosk App Starts Fullscreen

- [ ] `pnpm --filter @shotclock/pi-kiosk build` completes successfully
- [ ] Vite build produces `dist/index.html` and `dist/assets/`
- [ ] `launch-kiosk.sh` script is executable
- [ ] Chromium launches in kiosk mode
- [ ] Kiosk loads without errors
- [ ] Display shows ShotClock interface
- [ ] Timer controls respond (if test controller connected)

---

## 5. Pi Enters Setup Mode (Fresh Boot Simulation)

- [ ] Agent starts in `setup` mode when no config exists
- [ ] Captive portal API responds:
  - [ ] `GET /api/setup/status`
  - [ ] `GET /api/wifi/networks`
  - [ ] `POST /api/wifi/connect`
  - [ ] `POST /api/setup/complete`
- [ ] WiFi scan returns available networks
- [ ] WiFi connect attempt works (with valid credentials)
- [ ] Setup complete transitions agent to `online` mode

---

## 6. Device Pairing

- [ ] Pairing code is generated: `curl http://localhost:3001/local/pairing-code`
- [ ] Pairing code displays on kiosk
- [ ] Dashboard pair page loads at `/pair`
- [ ] Entering pairing code on dashboard succeeds
- [ ] Device appears in device list after pairing
- [ ] Socket.IO connection established after pairing
- [ ] Device shows "online" status in dashboard

---

## 7. Display Control

- [ ] Timer can be started from dashboard
- [ ] Timer can be stopped from dashboard
- [ ] Timer can be reset from dashboard
- [ ] Basketball scores and period update the Pi display immediately
- [ ] Wrestling scores and period update the Pi display immediately
- [ ] Volleyball scores, sets, and set number update the Pi display immediately
- [ ] Clock syncs to kiosk display within 1 second
- [ ] Sport selection works (basketball, wrestling, volleyball)
- [ ] Mode switching works (setup, pairing, offline, sport modes, media, calibration, blank)
- [ ] Presentation overlays work over each sport mode

---

## 8. Controller Abstraction

- [ ] Generic controller type works
- [ ] Controller type is configurable per device
- [ ] Button mappings apply correctly:
  - [ ] Start/Stop Timer
  - [ ] Pause Timer
  - [ ] Reset Shot Clock
  - [ ] Reset Game Clock
  - [ ] Score adjustment
  - [ ] Period navigation

---

## 9. Display Calibration

- [ ] Calibration mode can be entered: `POST /local/state` with `{"mode": {"type": "calibration"}}`
- [ ] Test pattern displays on kiosk
- [ ] Calibration data can be saved: `POST /local/config` with calibration data
- [ ] Saved calibration persists across agent restarts
- [ ] Calibration can be reset
- [ ] RGB to BGR color correction is enabled by default
- [ ] Color correction can be disabled from device settings
- [ ] Saved color correction state persists across Pi restarts

---

## 10. Presentation Media

- [ ] Device settings page has Presentation Media section
- [ ] Ads upload accepts image/video files
- [ ] Ads can have multiple active files
- [ ] Logo upload accepts image/video files
- [ ] Sponsor upload accepts image/video files
- [ ] Team Intro upload accepts video/audio files
- [ ] Music upload accepts audio files
- [ ] Preview links open uploaded files
- [ ] Enabling/selecting files updates active state correctly
- [ ] Deleting files removes the media record and file
- [ ] Uploaded media is stored under `apps/server-web/public/media/devices/`
- [ ] Metadata is stored in `DeviceMediaAsset`
- [ ] Run Ads sends an active ad asset to the Pi when available
- [ ] School Logo sends the active logo asset to the Pi when available
- [ ] Sponsor sends the active sponsor asset to the Pi when available
- [ ] Team Intro sends the active intro asset to the Pi when available
- [ ] Music sends the active audio asset to the Pi when available
- [ ] Clear Display hides active presentation overlay

---

## 11. Remote Updates

- [ ] Update check endpoint works: `POST /local/update/check`
- [ ] Update manifest is fetched from server
- [ ] Update status is reported: `GET /local/update/status`
- [ ] Update can be installed: `POST /local/update/install`
- [ ] Agent reboots and runs new version after update
- [ ] Rollback works by switching `/opt/shotclock/current` symlink

---

## 12. Systemd Services

- [ ] `shotclock-agent.service` installs correctly to `/etc/systemd/system/`
- [ ] `shotclock-kiosk.service` installs correctly to `/etc/systemd/system/`
- [ ] `shotclock-kiosk.service` runs as root and loads `/opt/shotclock/shared/.env`
- [ ] `/opt/shotclock/shared/.env` sets `KIOSK_USER` to the active desktop user
- [ ] `/opt/shotclock/shared/.env` sets `KIOSK_HIDE_CURSOR=true` for production displays
- [ ] `systemctl enable shotclock-agent` succeeds
- [ ] `systemctl enable shotclock-kiosk` succeeds
- [ ] `systemctl start shotclock-agent` starts the agent
- [ ] `systemctl start shotclock-kiosk` starts the kiosk
- [ ] Services restart on failure (`Restart=on-failure`)
- [ ] Logs are captured by journald

---

## 13. Installation Script

- [ ] `install-pi.sh` runs without errors on a fresh Raspberry Pi OS with Desktop install
- [ ] Node.js 22 is installed
- [ ] pnpm is installed globally
- [ ] Chromium and dependencies are installed (`chromium-browser` on older Raspberry Pi OS, `chromium` on Debian/Raspberry Pi OS Trixie)
- [ ] `unclutter` is installed so the kiosk cursor hides before manual mouse movement
- [ ] NetworkManager, hostapd, dnsmasq, avahi-daemon, libnss-mdns, iproute2, iptables, rfkill, iw, and wireless-regdb are installed
- [ ] Raspberry Pi 5 embedded-power installs schedule `PSU_MAX_CURRENT=5000` in EEPROM
- [ ] Raspberry Pi 5 embedded-power installs schedule `POWER_OFF_ON_HALT=0` and `WAIT_FOR_POWER_BUTTON=0`
- [ ] Embedded Raspberry Pi 5 test unit completes one hard power cycle after EEPROM scheduling
- [ ] Embedded Raspberry Pi 5 cold panel power-on does not fall back to red LED before boot
- [ ] If cold power-on falls back to red but delayed manual button boot succeeds, hardware power sequencing/delayed J2 pulse is added
- [ ] `/opt/shotclock` directory structure is created
- [ ] `/home/shotclock/.shotclock` exists before services start
- [ ] Config templates are copied to `/opt/shotclock/shared/config/`
- [ ] `shotclock` user is created
- [ ] Ownership is set correctly
- [ ] Services are enabled
- [ ] Script is idempotent (running twice doesn't break anything)

---

## 14. Configuration Templates

- [ ] `hostapd.conf.template` exists and has correct format
- [ ] `dnsmasq.conf.template` exists and has correct format
- [ ] `wpa_supplicant.conf.template` exists and has correct format
- [ ] `agent.env.template` exists and has correct format
- [ ] Templates contain `{{PLACEHOLDER}}` for user-specific values
- [ ] Install script copies templates to `/opt/shotclock/shared/config/`

---

## 15. Captive Portal

- [ ] AP mode starts when device is in setup mode
- [ ] SSID with the configured setup prefix and device suffix is broadcast
- [ ] `wlan0` has `192.168.4.1/24` while setup AP is active
- [ ] `hostapd` and `dnsmasq` are active while setup AP is active
- [ ] DHCP serves IP addresses in 192.168.4.0/24 range
- [ ] DNS redirects all requests to 192.168.4.1
- [ ] `sportsboard.local` resolves to the Pi while connected to the setup AP
- [ ] Portal page loads at `http://sportsboard.local` when connecting to AP
- [ ] Portal fallback page loads at `http://192.168.4.1:8080`
- [ ] WiFi network list populates
- [ ] WiFi connection can be initiated
- [ ] Setup completion transitions device out of setup mode

---

## 16. Documentation

- [ ] `docs/setup.md` exists with accurate dev setup instructions
- [ ] `docs/pi-setup.md` exists with accurate Pi deployment instructions
- [ ] `docs/courtcast-deployment.md` exists with accurate server and Pi production deployment instructions
- [ ] `docs/captive-portal.md` exists with accurate portal flow
- [ ] `docs/remote-updates.md` exists with accurate update process
- [ ] `docs/controller-abstraction.md` exists with accurate profiles
- [ ] `docs/agent-prompts.md` exists with accurate troubleshooting
- [ ] `docs/test-checklist.md` exists (this file)

---

## 17. GitHub Push

- [ ] All changes committed with descriptive message
- [ ] Commits pushed to `github.com/connerum/shotclock-platform`
- [ ] No sensitive data (tokens, passwords) in commits
- [ ] `.gitignore` excludes `node_modules`, `.next`, `dist`
- [ ] Repository is public or token has correct access

---

## 18. Final Build Verification

Run this command and verify all packages build:
```bash
cd ~/shotclock-platform
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/pi-agent build
pnpm --filter @shotclock/pi-kiosk build
```

For the server:

```bash
cd /opt/courtcast/shotclock-platform
pnpm prisma generate
pnpm prisma migrate deploy
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/server-web build
```

---

## Sign-Off

| Check | Name | Date |
|-------|------|------|
| All items complete | | |
| Build verified clean | | |
| Docs verified accurate | | |
| Pushed to GitHub | | |
