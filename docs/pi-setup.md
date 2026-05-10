# Raspberry Pi OS Setup Guide

Detailed setup instructions for deploying Shotclock on Raspberry Pi.

## Hardware Requirements

- Raspberry Pi 4B or 5
- 16GB+ microSD card
- Compatible display (HDMI)
- Optional: Game controller for scoreboard control

## Raspberry Pi OS Setup

### 1. Flash the OS

Use Raspberry Pi Imager and choose Raspberry Pi OS with Desktop for display units. Raspberry Pi OS Lite can run the agent, but the Chromium kiosk expects an active graphical desktop session on the HDMI output.

In Raspberry Pi Imager advanced options:

- Enable SSH.
- Set the hostname, for example `display-40091`.
- Create the desktop/admin user, for example `admin`.
- Set WiFi only if you want initial SSH access before using the built-in setup AP.
- Set locale/timezone/country.

### 2. Initial Boot Setup

```bash
# Mount the boot partition
sudo mkdir -p /mnt/sdcard
sudo mount /dev/sdX1 /mnt/sdcard

# Enable SSH
sudo touch /mnt/sdcard/ssh

# Configure WiFi manually only if you did not set it in Raspberry Pi Imager.
sudo cat > /mnt/sdcard/wpa_supplicant.conf << 'EOF'
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=US

network={
    ssid="YourWiFiNetwork"
    psk="YourPassword"
    key_mgmt=WPA-PSK
}
EOF

# Unmount
sudo umount /mnt/sdcard
```

### 3. First Boot

```bash
# SSH into the Pi
ssh admin@raspberrypi.local

passwd
```

### 4. System Configuration

```bash
# Run raspi-config
sudo raspi-config

# Recommended settings:
# - Change password
# - Set hostname to "shotclock-display-01"
# - Enable SSH
# - Configure memory split (GPU: 256)
# - Update all packages
sudo apt update && sudo apt full-upgrade -y
```

## Software Installation

### 1. Install Additional Dependencies

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install Chromium for kiosk mode.
# Bookworm/Bullseye may provide chromium-browser; Trixie provides chromium.
CHROMIUM_BROWSER_CANDIDATE="$(apt-cache policy chromium-browser | awk '/Candidate:/ {print $2}')"
if [ -n "$CHROMIUM_BROWSER_CANDIDATE" ] && [ "$CHROMIUM_BROWSER_CANDIDATE" != "(none)" ]; then
  apt-get install -y chromium-browser chromium-sandbox
else
  apt-get install -y chromium chromium-sandbox
fi

# Install WiFi/AP and networking tools
apt-get install -y network-manager hostapd dnsmasq avahi-daemon libnss-mdns iproute2 iptables rfkill iw wireless-regdb
```

The repository installer already handles the Chromium package name difference. If `scripts/install-pi.sh` fails with `Package chromium-browser is not available` or `Unable to locate package libgconf-2-4`, pull the latest repo and rerun it:

```bash
cd ~/shotclock-platform
git pull
sudo ./scripts/install-pi.sh
```

That failure happens before `/opt/shotclock/shared` is created, so editing `/opt/shotclock/shared/.env` will also fail until the installer completes. The current installer also creates `/home/shotclock/.shotclock` before systemd starts so service namespace setup does not fail on a missing state directory.

### 2. Configure NetworkManager

```bash
# Enable NetworkManager
systemctl enable NetworkManager
systemctl start NetworkManager

# Allow passwordless NetworkManager access. The installer and agent expect to
# manage saved WiFi profiles through NetworkManager.
sudo tee /etc/polkit-1/localauthority/50-local.d/nm.pkla << 'EOF'
[nm-setup]
Identity=unix-user:shotclock
Action=org.freedesktop.NetworkManager.*
ResultAny=yes
ResultAll=yes
EOF
```

### 3. Create Shotclock User

```bash
useradd -r -m -s /bin/bash shotclock
usermod -aG video,audio,input shotclock
mkdir -p /home/shotclock/.shotclock
chown -R shotclock:shotclock /home/shotclock/.shotclock
```

### 4. Create Directory Structure

```bash
mkdir -p /opt/shotclock/releases
mkdir -p /opt/shotclock/shared/config
mkdir -p /opt/shotclock/shared/media
mkdir -p /opt/shotclock/releases/0.1.0
chown -R shotclock:shotclock /opt/shotclock
```

## Service Configuration

### 1. Install Service Files

```bash
sudo cp shotclock-platform/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 2. Configure Services

Edit `/etc/systemd/system/shotclock-agent.service`:
```ini
[Service]
User=root
Group=root
EnvironmentFile=/opt/shotclock/shared/.env
Environment=HOME=/home/shotclock
```

Edit `/opt/shotclock/shared/.env`:
```bash
SERVER_URL=http://your-server:3000
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
```

`KIOSK_USER` should be the Raspberry Pi desktop login user that owns the active HDMI session. On the current field Pi this is `admin`. The kiosk service starts as root, then launches Chromium as this user so it can attach to the visible desktop session.

For NovaStar MSD300-1 controllers, keep the Pi kiosk output at `1024x768@60`. Field testing showed the MSD300-1 displayed moving blue-dot artifacts on running basketball displays at higher Pi output resolutions, while static images and the idle basketball display were clean. `1024x768@60` stopped the artifacts. RGB-to-BGR color correction should remain enabled for this controller path when needed for correct panel colors.

`KIOSK_HIDE_CURSOR=true` starts `unclutter` before Chromium so the mouse pointer is hidden immediately, including before any manual mouse movement. To temporarily get the cursor back for desktop maintenance, set `KIOSK_HIDE_CURSOR=false` in `/opt/shotclock/shared/.env` and restart `shotclock-kiosk`.

`PI5_PSU_MAX_CURRENT=5000` is required for embedded Raspberry Pi 5 installs powered from the LED controller power supply or GPIO 5V rail instead of the USB-C PD input. The installer writes this value to the Pi 5 EEPROM as `PSU_MAX_CURRENT=5000` so soft reboots triggered by network recovery, updates, or factory reset do not hang in a low-power boot state.

The setup AP is only broadcast while the device is unpaired. Its SSID is the configured prefix plus the first six characters of the unique device ID suffix, for example `Shotclock-Setup-1e4b35`.

For production CourtCast:

```bash
SERVER_URL=https://courtcast.safety-linq.com
AGENT_LOCAL_API_PORT=3001
DEVICE_NAME=Shotclock Display 01
SETUP_AP_SSID=Shotclock-Setup
SETUP_AP_PASSWORD=shotclock123
SETUP_PORTAL_HOST=sportsboard.local
KIOSK_USER=admin
KIOSK_HIDE_CURSOR=true
PI5_PSU_MAX_CURRENT=5000
```

### 3. Enable Services

```bash
sudo systemctl enable shotclock-agent
sudo systemctl enable shotclock-kiosk
sudo systemctl start shotclock-agent
sudo systemctl start shotclock-kiosk
```

## Repository Build And Service Symlink

After cloning or pulling the repository on the Pi:

```bash
cd ~/shotclock-platform
pnpm install --frozen-lockfile
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/pi-agent build
pnpm --filter @shotclock/pi-kiosk build
sudo ln -sfn "$PWD" /opt/shotclock/current
sudo systemctl daemon-reload
sudo systemctl restart shotclock-agent shotclock-kiosk
```

## Display Calibration

### Accessing Calibration

1. From the dashboard, go to Devices -> [device] -> Device Details/Settings
2. Or use the local API: `curl http://localhost:3001/local/config`

### Calibration Process

1. Enter calibration mode on the kiosk
2. Use Display Calibration to draw, move, and resize the calibration box
3. Confirm the box updates on the Pi in real time
4. Save calibration to persist locally on the Pi and on the server

Current default LED calibration:

```text
X 960
Y 640
W 256
H 192
```

### Manual Calibration

```bash
# Get current calibration
curl http://localhost:3001/local/config

# Set calibration
curl -X POST http://localhost:3001/local/config \
  -H "Content-Type: application/json" \
  -d '{"calibrationData": {"x": 960, "y": 640, "width": 256, "height": 192, "scaleX": 1, "scaleY": 1, "rotation": 0}}'
```

## Media Management

Presentation media is configured on the server WebUI, not directly on the Pi:

```text
https://courtcast.safety-linq.com/devices/[deviceId]/settings
```

Upload media for:

- Ads
- Logo
- Sponsor
- Team Intro
- Music

The WebUI stores metadata in SQLite and stores files under `apps/server-web/public/media/devices/`. The Pi receives public media URLs through presentation commands and renders images/videos or plays audio in the kiosk overlay.

## Color Correction

RGB to BGR channel swap correction is enabled by default on the kiosk output. This compensates for LED processor paths where the receiver swaps red and blue channels. Disable or re-enable it from the device settings page after confirming colors on the physical LED panels:

```text
https://courtcast.safety-linq.com/devices/[deviceId]/settings
```

## NovaStar MSD300-1 Display Mode

For MSD300-1 deployments, set the Pi output to `1024x768@60`:

```bash
grep -q '^KIOSK_DISPLAY_OUTPUT=' /opt/shotclock/shared/.env \
  && sudo sed -i 's/^KIOSK_DISPLAY_OUTPUT=.*/KIOSK_DISPLAY_OUTPUT=auto/' /opt/shotclock/shared/.env \
  || echo 'KIOSK_DISPLAY_OUTPUT=auto' | sudo tee -a /opt/shotclock/shared/.env
grep -q '^KIOSK_DISPLAY_MODE=' /opt/shotclock/shared/.env \
  && sudo sed -i 's/^KIOSK_DISPLAY_MODE=.*/KIOSK_DISPLAY_MODE=1024x768/' /opt/shotclock/shared/.env \
  || echo 'KIOSK_DISPLAY_MODE=1024x768' | sudo tee -a /opt/shotclock/shared/.env
grep -q '^KIOSK_DISPLAY_RATE=' /opt/shotclock/shared/.env \
  && sudo sed -i 's/^KIOSK_DISPLAY_RATE=.*/KIOSK_DISPLAY_RATE=60/' /opt/shotclock/shared/.env \
  || echo 'KIOSK_DISPLAY_RATE=60' | sudo tee -a /opt/shotclock/shared/.env
sudo systemctl restart shotclock-kiosk
```

The launcher applies this with `xrandr` before Chromium starts. Leave `KIOSK_DISPLAY_OUTPUT=auto` unless the Pi has multiple connected outputs; then set it to the exact `xrandr` output name.

## Embedded Pi 5 Power

For Raspberry Pi 5 displays powered from the LED display power supply or direct 5V/GPIO rail, the Pi cannot negotiate USB-C Power Delivery. Set the EEPROM bootloader current override so the Pi treats the supply as a 5A source:

```bash
cd ~/shotclock-platform
git pull --ff-only
grep -q '^PI5_PSU_MAX_CURRENT=' /opt/shotclock/shared/.env \
  && sudo sed -i 's/^PI5_PSU_MAX_CURRENT=.*/PI5_PSU_MAX_CURRENT=5000/' /opt/shotclock/shared/.env \
  || echo 'PI5_PSU_MAX_CURRENT=5000' | sudo tee -a /opt/shotclock/shared/.env
sudo ./scripts/install-pi.sh
```

Verify the scheduled EEPROM config:

```bash
sudo rpi-eeprom-config | grep '^PSU_MAX_CURRENT='
od -An -tu4 /proc/device-tree/chosen/power/max_current 2>/dev/null || true
```

Then apply it with a hard power cycle:

```bash
sudo shutdown -h now
```

Wait for the Pi activity LED to stop, remove wall power from the embedded panel for at least 10 seconds, then plug it back in. Do not rely on only `sudo reboot` for this first application because the PMIC may need a full power removal to leave the prior low-power state.

After boot, confirm:

```bash
rpi-eeprom-config | grep '^PSU_MAX_CURRENT=5000'
od -An -tu4 /proc/device-tree/chosen/power/max_current 2>/dev/null || true
systemctl status shotclock-agent shotclock-kiosk --no-pager
```

If `rpi-eeprom-config` is unavailable, install or update the Raspberry Pi EEPROM tooling:

```bash
sudo apt-get update
sudo apt-get install -y rpi-eeprom
```

Only set `PSU_MAX_CURRENT=5000` when the embedded 5V supply and wiring can safely provide 5A at the Pi under load. If the supply cannot provide that current, fix the power path rather than masking undervoltage.

## Kiosk Cursor

Production kiosks should hide the cursor:

```bash
grep -q '^KIOSK_HIDE_CURSOR=' /opt/shotclock/shared/.env \
  && sudo sed -i 's/^KIOSK_HIDE_CURSOR=.*/KIOSK_HIDE_CURSOR=true/' /opt/shotclock/shared/.env \
  || echo 'KIOSK_HIDE_CURSOR=true' | sudo tee -a /opt/shotclock/shared/.env
sudo apt-get update
sudo apt-get install -y unclutter
sudo systemctl restart shotclock-kiosk
```

To get the cursor back for maintenance:

```bash
grep -q '^KIOSK_HIDE_CURSOR=' /opt/shotclock/shared/.env \
  && sudo sed -i 's/^KIOSK_HIDE_CURSOR=.*/KIOSK_HIDE_CURSOR=false/' /opt/shotclock/shared/.env \
  || echo 'KIOSK_HIDE_CURSOR=false' | sudo tee -a /opt/shotclock/shared/.env
sudo pkill -x unclutter || true
sudo systemctl restart shotclock-kiosk
```

Set it back to `true` and restart `shotclock-kiosk` before returning the Pi to production.

## Troubleshooting

### Pi doesn't boot

1. Check SD card is properly inserted
2. Verify power supply. Embedded Raspberry Pi 5 displays should provide a stable 5V/5A at the Pi and have `PSU_MAX_CURRENT=5000` applied in EEPROM.
3. Try re-flashing the OS

### No display output

1. Check HDMI cable connections
2. Try adding to `/boot/config.txt`:
   ```
   hdmi_force_hotplug=1
   hdmi_group=1
   hdmi_mode=16
   ```
3. Confirm the kiosk is using the updated service file:
   ```bash
   sudo systemctl cat shotclock-kiosk
   ```
   It should show `User=root`, `Group=root`, and `EnvironmentFile=-/opt/shotclock/shared/.env`.
4. If the log shows `status=200/CHDIR` or `Changing to the requested working directory failed`, reinstall the service file and set the kiosk user:
   ```bash
   cd ~/shotclock-platform
   sudo cp systemd/shotclock-kiosk.service /etc/systemd/system/shotclock-kiosk.service
   grep -q '^KIOSK_USER=' /opt/shotclock/shared/.env \
     && sudo sed -i 's/^KIOSK_USER=.*/KIOSK_USER=admin/' /opt/shotclock/shared/.env \
     || echo 'KIOSK_USER=admin' | sudo tee -a /opt/shotclock/shared/.env
   sudo systemctl daemon-reload
   sudo systemctl reset-failed shotclock-kiosk
   sudo systemctl restart shotclock-kiosk
   ```
5. To exit kiosk mode from SSH:
   ```bash
   sudo systemctl stop shotclock-kiosk
   ```

### Setup AP is not visible

The setup AP is expected only before the Pi is paired. If the device is already paired, the agent starts in online mode and does not advertise the setup AP.

For an unpaired device, check AP startup:

```bash
journalctl -u shotclock-agent -n 120 --no-pager -l
systemctl status hostapd dnsmasq --no-pager -l
ip addr show wlan0
```

The agent should log `Starting setup AP: Shotclock-Setup-...`, `hostapd` and `dnsmasq` should be active, and `wlan0` should have `192.168.4.1/24`. If `hostapd` fails, the agent service now fails instead of continuing as healthy.

The setup page always includes a manual SSID/password form. On a single-radio Pi, nearby WiFi scans can be empty while `wlan0` is broadcasting the setup AP. Submit the network name manually if no networks appear. After credentials are submitted, the kiosk changes to offline while the setup AP disconnects and the Pi joins the target WiFi. If the connection succeeds, NetworkManager stores an autoconnect WiFi profile, `/home/shotclock/.shotclock/config.json` changes from `setup` to `pairing`, and future restarts skip setup AP mode. If connection fails, the setup AP is started again.

If the AP is visible but `http://sportsboard.local` does not load, try the fallback URL `http://192.168.4.1:8080`, then verify the portal process is listening:

```bash
journalctl -u shotclock-agent -n 120 --no-pager -l
ss -ltnp | grep -E ':80|:8080'
curl -i http://sportsboard.local/setup
curl -i http://192.168.4.1:8080/setup
```

The agent should log `Captive portal running at http://sportsboard.local` and `Captive portal running at http://192.168.4.1:8080`. The friendly hostname is backed by dnsmasq and Avahi when available; the IP fallback remains for clients that do not resolve `.local` names.

### WiFi won't connect

1. Verify SSID and password
2. Check country code is set in wpa_supplicant.conf
3. Run `nmcli device wifi list` to scan networks

### Agent keeps restarting

Check logs:
```bash
journalctl -u shotclock-agent -n 100
```

Common issues:
- Wrong SERVER_URL
- Missing environment variables
- `/opt/shotclock/current` symlink does not point to a built checkout
- `apps/pi-agent/dist/index.js` does not exist because the agent was not built

### Browser keyring prompt blocks kiosk

The kiosk launcher passes Chromium:

```bash
--password-store=basic
--use-mock-keychain
```

If a keyring prompt still appears, confirm the installed launcher is current and restart the kiosk:

```bash
cd ~/shotclock-platform
git pull --ff-only
sudo cp systemd/shotclock-kiosk.service /etc/systemd/system/shotclock-kiosk.service
sudo systemctl daemon-reload
sudo systemctl restart shotclock-kiosk
```
