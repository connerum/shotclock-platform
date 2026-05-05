# Raspberry Pi OS Setup Guide

Detailed setup instructions for deploying Shotclock on Raspberry Pi.

## Hardware Requirements

- Raspberry Pi 4B or 5
- 16GB+ microSD card
- Compatible display (HDMI)
- Optional: Game controller for scoreboard control

## Raspberry Pi OS Setup

### 1. Flash the OS

```bash
# Download Raspberry Pi OS Lite
wget https://downloads.raspberrypi.org/raspios_lite_armhf/images/raspios_lite_armhf-2024-03-15/2024-03-15-raspios-bullseye-armhf-lite.img.xz

# Flash to SD card (replace /dev/sdX with your card reader)
xzcat 2024-03-15-raspios-bullseye-armhf-lite.img.xz | sudo dd of=/dev/sdX bs=4M status=progress
```

### 2. Initial Boot Setup

```bash
# Mount the boot partition
sudo mkdir -p /mnt/sdcard
sudo mount /dev/sdX1 /mnt/sdcard

# Enable SSH
sudo touch /mnt/sdcard/ssh

# Configure WiFi (optional)
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
ssh pi@raspberrypi.local

# Default password: raspberry
# CHANGE THIS IMMEDIATELY!
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

# Install Chromium for kiosk mode
# Bookworm/Bullseye may provide chromium-browser; Trixie provides chromium.
CHROMIUM_BROWSER_CANDIDATE="$(apt-cache policy chromium-browser | awk '/Candidate:/ {print $2}')"
if [ -n "$CHROMIUM_BROWSER_CANDIDATE" ] && [ "$CHROMIUM_BROWSER_CANDIDATE" != "(none)" ]; then
  apt-get install -y chromium-browser chromium-sandbox
else
  apt-get install -y chromium chromium-sandbox
fi

# Install WiFi/AP and networking tools
apt-get install -y network-manager hostapd dnsmasq iproute2 iptables rfkill iw wireless-regdb
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

# Allow passwordless NetworkManager access
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
Environment=SERVER_URL=http://your-server:3000
Environment=DEVICE_NAME=Shotclock Display 01
```

Edit `/opt/shotclock/shared/.env`:
```bash
SERVER_URL=http://your-server:3000
AGENT_LOCAL_API_PORT=3001
DEVICE_NAME=Shotclock Display 01
SETUP_AP_SSID=Shotclock-Setup
SETUP_AP_PASSWORD=shotclock123
KIOSK_USER=admin
```

`KIOSK_USER` should be the Raspberry Pi desktop login user that owns the active HDMI session. On the current field Pi this is `admin`. The kiosk service starts as root, then launches Chromium as this user so it can attach to the visible desktop session.

The setup AP is only broadcast while the device is unpaired. Its SSID is the configured prefix plus the first six characters of the unique device ID suffix, for example `Shotclock-Setup-1e4b35`.

### 3. Enable Services

```bash
sudo systemctl enable shotclock-agent
sudo systemctl enable shotclock-kiosk
sudo systemctl start shotclock-agent
```

## Display Calibration

### Accessing Calibration

1. From the dashboard, go to Devices → [device] → Calibration
2. Or use the local API: `curl http://localhost:3001/local/config`

### Calibration Process

1. Enter calibration mode on the kiosk
2. Use test patterns to verify display alignment
3. Adjust offset and scale values
4. Save calibration to apply

### Manual Calibration

```bash
# Get current calibration
curl http://localhost:3001/local/config

# Set calibration
curl -X POST http://localhost:3001/local/config \
  -H "Content-Type: application/json" \
  -d '{"calibrationData": {"x": 10, "y": 5, "scaleX": 1.02, "scaleY": 0.98, "rotation": 0}}'
```

## Troubleshooting

### Pi doesn't boot

1. Check SD card is properly inserted
2. Verify power supply (5V 3A minimum)
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

If the AP is visible but `http://192.168.4.1:8080` does not load, verify the portal process is listening:

```bash
journalctl -u shotclock-agent -n 120 --no-pager -l
ss -ltnp | grep ':8080'
curl -i http://192.168.4.1:8080/setup
```

The agent should log `Captive portal running at http://192.168.4.1:8080`. If port `8080` cannot bind, the agent service now fails instead of continuing as healthy.

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
- Database connection failure
- Missing environment variables
