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
- [ ] Scores can be updated from dashboard
- [ ] Clock syncs to kiosk display within 1 second
- [ ] Mode switching works (shot-clock, game-clock, calibration)

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

---

## 10. Remote Updates

- [ ] Update check endpoint works: `POST /local/update/check`
- [ ] Update manifest is fetched from server
- [ ] Update status is reported: `GET /local/update/status`
- [ ] Update can be installed: `POST /local/update/install`
- [ ] Agent reboots and runs new version after update
- [ ] Rollback works by switching `/opt/shotclock/current` symlink

---

## 11. Systemd Services

- [ ] `shotclock-agent.service` installs correctly to `/etc/systemd/system/`
- [ ] `shotclock-kiosk.service` installs correctly to `/etc/systemd/system/`
- [ ] `systemctl enable shotclock-agent` succeeds
- [ ] `systemctl enable shotclock-kiosk` succeeds
- [ ] `systemctl start shotclock-agent` starts the agent
- [ ] `systemctl start shotclock-kiosk` starts the kiosk
- [ ] Services restart on failure (`Restart=on-failure`)
- [ ] Logs are captured by journald

---

## 12. Installation Script

- [ ] `install-pi.sh` runs without errors on a fresh Raspberry Pi OS Lite install
- [ ] Node.js 22 is installed
- [ ] pnpm is installed globally
- [ ] Chromium and dependencies are installed (`chromium-browser` on older Raspberry Pi OS, `chromium` on Debian/Raspberry Pi OS Trixie)
- [ ] NetworkManager, hostapd, dnsmasq are installed
- [ ] `/opt/shotclock` directory structure is created
- [ ] Config templates are copied to `/opt/shotclock/shared/config/`
- [ ] `shotclock` user is created
- [ ] Ownership is set correctly
- [ ] Services are enabled
- [ ] Script is idempotent (running twice doesn't break anything)

---

## 13. Configuration Templates

- [ ] `hostapd.conf.template` exists and has correct format
- [ ] `dnsmasq.conf.template` exists and has correct format
- [ ] `wpa_supplicant.conf.template` exists and has correct format
- [ ] `agent.env.template` exists and has correct format
- [ ] Templates contain `{{PLACEHOLDER}}` for user-specific values
- [ ] Install script copies templates to `/opt/shotclock/shared/config/`

---

## 14. Captive Portal

- [ ] AP mode starts when device is in setup mode
- [ ] SSID "Shotclock-Setup" (or configured name) is broadcast
- [ ] DHCP serves IP addresses in 192.168.4.0/24 range
- [ ] DNS redirects all requests to 192.168.4.1
- [ ] Portal page loads when connecting to AP
- [ ] WiFi network list populates
- [ ] WiFi connection can be initiated
- [ ] Setup completion transitions device out of setup mode

---

## 15. Documentation

- [ ] `docs/setup.md` exists with accurate dev setup instructions
- [ ] `docs/pi-setup.md` exists with accurate Pi deployment instructions
- [ ] `docs/captive-portal.md` exists with accurate portal flow
- [ ] `docs/remote-updates.md` exists with accurate update process
- [ ] `docs/controller-abstraction.md` exists with accurate profiles
- [ ] `docs/agent-prompts.md` exists with accurate troubleshooting
- [ ] `docs/test-checklist.md` exists (this file)

---

## 16. GitHub Push

- [ ] All changes committed with descriptive message
- [ ] Commits pushed to `github.com/connerum/shotclock-platform`
- [ ] No sensitive data (tokens, passwords) in commits
- [ ] `.gitignore` excludes `node_modules`, `.next`, `dist`
- [ ] Repository is public or token has correct access

---

## 17. Final Build Verification

Run this command and verify all packages build:
```bash
cd /home/shotclock/shotclock-platform && pnpm build
```

Expected output order:
1. ✓ @shotclock/shared builds
2. ✓ @shotclock/display-core builds
3. ✓ @shotclock/sports-core builds
4. ✓ @shotclock/pi-agent builds
5. ✓ @shotclock/pi-kiosk builds
6. ✓ @shotclock/server-web builds

---

## Sign-Off

| Check | Name | Date |
|-------|------|------|
| All items complete | | |
| Build verified clean | | |
| Docs verified accurate | | |
| Pushed to GitHub | | |
