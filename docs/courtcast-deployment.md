# CourtCast Deployment Runbook

This runbook is for deploying the Shotclock Platform to:

- Server IP: `5.161.109.106`
- Domain: `courtcast.safety-linq.com`
- App directory: `/opt/courtcast/shotclock-platform`

## 1. DNS

Create this DNS record wherever `safety-linq.com` is managed:

```text
Type: A
Name: courtcast
Value: 5.161.109.106
TTL: 300
```

Verify from your local machine:

```bash
dig +short courtcast.safety-linq.com
```

Expected:

```text
5.161.109.106
```

## 2. Server Base Install

SSH into the server:

```bash
ssh root@5.161.109.106
```

Install system packages:

```bash
apt update && apt full-upgrade -y
apt install -y git curl nginx ufw certbot python3-certbot-nginx
```

Install Node 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
corepack enable
corepack prepare pnpm@10.25.0 --activate
```

Verify:

```bash
node -v
pnpm -v
```

The Node version should be `22.x`.

## 3. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

## 4. Clone And Build App

```bash
mkdir -p /opt/courtcast
cd /opt/courtcast
git clone https://github.com/connerum/shotclock-platform.git
cd shotclock-platform
```

Create the production environment file:

```bash
nano .env
```

Use:

```bash
NODE_ENV=production
SERVER_PORT=3000
PORT=3000

SERVER_URL=https://courtcast.safety-linq.com
NEXT_PUBLIC_SERVER_URL=https://courtcast.safety-linq.com
SOCKET_SERVER_URL=https://courtcast.safety-linq.com
DATABASE_URL=file:/opt/courtcast/data/prod.db
```

Install and build:

```bash
mkdir -p /opt/courtcast/data
mkdir -p apps/server-web/public/media/devices
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/server-web build
```

Optional demo seed:

```bash
pnpm prisma db seed
```

## 5. Systemd Service

Create the service:

```bash
nano /etc/systemd/system/courtcast.service
```

Paste:

```ini
[Unit]
Description=CourtCast Shotclock Platform
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/courtcast/shotclock-platform
EnvironmentFile=/opt/courtcast/shotclock-platform/.env
ExecStart=/usr/bin/pnpm --filter @shotclock/server-web start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=courtcast

[Install]
WantedBy=multi-user.target
```

Start it:

```bash
systemctl daemon-reload
systemctl enable courtcast
systemctl start courtcast
systemctl status courtcast
```

Check logs:

```bash
journalctl -u courtcast -f
```

Local server test:

```bash
curl -i http://127.0.0.1:3000/api/devices
```

The route requires authentication, so `401 Authentication required` is a valid unauthenticated health signal. For the public app shell, use:

```bash
curl -I http://127.0.0.1:3000/login
```

## 6. Nginx Reverse Proxy

Create the Nginx site:

```bash
nano /etc/nginx/sites-available/courtcast
```

Paste:

```nginx
server {
    listen 80;
    server_name courtcast.safety-linq.com;

    client_max_body_size 100M;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
ln -s /etc/nginx/sites-available/courtcast /etc/nginx/sites-enabled/courtcast
nginx -t
systemctl reload nginx
```

## 7. HTTPS Certificate

After DNS resolves:

```bash
certbot --nginx -d courtcast.safety-linq.com
```

Test renewal:

```bash
certbot renew --dry-run
```

Verify:

```bash
curl -I https://courtcast.safety-linq.com
curl -I https://courtcast.safety-linq.com/api/devices
```

Open:

```text
https://courtcast.safety-linq.com/devices
https://courtcast.safety-linq.com/pair
```

Initial super login:

```text
Email: conner@two-a-days.com
Password: PatchWork22!!
```

Create normal user accounts from the registration page as needed. Normal users only see and control devices they pair or own; the super account can see all paired devices.

## 8. Pi Display Setup

On each Raspberry Pi:

```bash
ssh admin@raspberrypi.local
sudo apt update && sudo apt full-upgrade -y
git clone https://github.com/connerum/shotclock-platform.git
cd shotclock-platform
sudo ./scripts/install-pi.sh
```

On Raspberry Pi OS based on Debian Trixie, older docs or stale checkouts may fail with:

```text
Package chromium-browser is not available
Unable to locate package libgconf-2-4
```

That means the script stopped before creating `/opt/shotclock/shared`. Pull the latest repo and rerun the installer:

```bash
cd ~/shotclock-platform
git pull
sudo ./scripts/install-pi.sh
```

The current installer detects whether the OS provides `chromium-browser` or `chromium`, skips unavailable legacy packages, and the kiosk launcher supports both executable names.

Configure the Pi agent:

```bash
sudo nano /opt/shotclock/shared/.env
```

Use:

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

Set `KIOSK_USER` to the Pi desktop login user that owns the HDMI session. On `display-40091`, that user is `admin`.

For NovaStar MSD300-1 controllers, keep the Pi kiosk output at `1024x768@60`. Field testing showed moving blue-dot artifacts on running basketball displays at higher Pi output resolutions, while static images and the idle basketball display stayed clean. `1024x768@60` stopped the artifacts. Keep RGB-to-BGR color correction enabled when this controller path needs it for correct LED colors.

Keep `KIOSK_HIDE_CURSOR=true` for production displays. The Pi installer installs `unclutter`, and the kiosk launcher starts it so the cursor is hidden immediately when Chromium opens. For Pi desktop maintenance, set `KIOSK_HIDE_CURSOR=false`, run `sudo pkill -x unclutter || true`, and restart `shotclock-kiosk`; set it back to `true` before returning to production.

For embedded Raspberry Pi 5 displays powered from the LED display power supply or direct 5V/GPIO rail, keep `PI5_PSU_MAX_CURRENT=5000` and `PI5_AUTO_BOOT_ON_POWER=true`. The installer applies `PSU_MAX_CURRENT=5000`, `POWER_OFF_ON_HALT=0`, and `WAIT_FOR_POWER_BUTTON=0` to EEPROM, avoiding low-power boot behavior during agent-triggered reboots and preventing the Pi from intentionally waiting for the power button when panel power is restored. After applying it the first time, shut down, remove panel power for at least 10 seconds, then restore power. If cold panel power makes the Pi turn green/HDMI and then return to red, but a later manual power-button press boots normally, add delayed Pi power sequencing or a delayed pulse across the Pi 5 J2 power-button pads; the LED power rail is not stable early enough for the Pi cold start.

If `/opt/shotclock/shared/.env` still does not exist, the install script did not finish. Create the directory manually only as a recovery step:

```bash
sudo mkdir -p /opt/shotclock/shared
sudo touch /opt/shotclock/shared/.env
sudo chown -R shotclock:shotclock /opt/shotclock/shared
```

Build on the Pi:

```bash
cd ~/shotclock-platform
pnpm install --frozen-lockfile
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/pi-agent build
pnpm --filter @shotclock/pi-kiosk build
```

Point services at this checkout:

```bash
sudo ln -sfn ~/shotclock-platform /opt/shotclock/current
sudo cp systemd/shotclock-agent.service /etc/systemd/system/shotclock-agent.service
sudo cp systemd/shotclock-kiosk.service /etc/systemd/system/shotclock-kiosk.service
sudo systemctl daemon-reload
sudo systemctl enable shotclock-agent
sudo systemctl enable shotclock-kiosk
sudo systemctl start shotclock-agent
sudo systemctl start shotclock-kiosk
```

Check logs:

```bash
journalctl -u shotclock-agent -f
journalctl -u shotclock-kiosk -f
```

## 9. Updating Existing Deployments

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
sudo systemctl status courtcast --no-pager
```

Pi update:

```bash
cd ~/shotclock-platform
git pull --ff-only
pnpm install --frozen-lockfile
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/pi-agent build
pnpm --filter @shotclock/pi-kiosk build
sudo ln -sfn "$PWD" /opt/shotclock/current
sudo systemctl restart shotclock-agent shotclock-kiosk
sudo systemctl status shotclock-agent shotclock-kiosk --no-pager
```

If `git pull --ff-only` is blocked by local database changes, do not commit the production SQLite file. On the server the production DB should be outside the repository at `/opt/courtcast/data/prod.db`. For accidental repo-local DB changes:

```bash
git restore prisma/dev.db
git pull --ff-only
```

If `git pull --ff-only` is blocked by local script edits on the Pi, inspect them first. If they are only emergency one-off deployment edits that are now in the repo, restore the file and pull:

```bash
git diff -- scripts/install-pi.sh scripts/launch-kiosk.sh
git restore scripts/install-pi.sh scripts/launch-kiosk.sh
git pull --ff-only
```

## 10. Pairing Flow

On the Pi display, get the pairing code.

In a browser, open:

```text
https://courtcast.safety-linq.com/pair
```

Enter the code. Then check:

```text
https://courtcast.safety-linq.com/devices
```

The display should appear online.

## 11. Device Media

Manage display media from:

```text
https://courtcast.safety-linq.com/devices/[deviceId]/settings
```

The Presentation Media section manages:

- Ads: multiple active images/videos, rotated when the Run Ads button is used.
- Logo: selected image/video for School Logo.
- Sponsor: selected image/video for Sponsor.
- Team Intro: selected video/audio for Team Intro.
- Music: selected audio for Music.

Storage model:

- SQLite stores metadata and slot assignment in `DeviceMediaAsset`.
- Files are stored on disk under `apps/server-web/public/media/devices/`.
- Nginx allows uploads up to `100M` through `client_max_body_size 100M`.

Back up both the SQLite database and the media directory:

```bash
tar -czf /root/courtcast-media-backup.tgz -C /opt/courtcast/shotclock-platform apps/server-web/public/media
cp /opt/courtcast/data/prod.db /root/courtcast-prod.db.backup
```

## 12. Color Correction

The kiosk output enables RGB to BGR channel swap correction by default for LED processor chains that swap red and blue channels. Toggle and save it per device from:

```text
https://courtcast.safety-linq.com/devices/[deviceId]/settings
```

## 13. Factory Reset

Factory reset is available from the device settings page. It removes the device record from the WebUI, clears pairing/network/display state on the Pi, and reboots the Pi back into setup mode.

After factory reset, repeat:

1. Connect to `Shotclock-Setup-xxxxxx`.
2. Open `http://sportsboard.local`.
3. Configure WiFi.
4. Pair the new code from `https://courtcast.safety-linq.com/pair`.

If the device you are using does not resolve `.local` names, use the fallback URL shown on the Pi: `http://192.168.4.1:8080`.

## 14. First LED Test Order

Use a normal HDMI monitor first.

Confirm:

- Kiosk opens full screen.
- Pairing code appears.
- Dashboard sees device.
- Mode changes work.
- Shot clock counts down.
- Basketball, wrestling, and volleyball score controls update the Pi immediately.
- Game Presentation buttons show uploaded media where configured.
- Calibration mode displays correctly.

Then connect HDMI to the LED processor and repeat calibration. For NovaStar MSD300-1, use the deployed `1024x768@60` Pi output before tuning app calibration. For other LED processors, use the processor's stable native resolution and refresh rate before calibration.
