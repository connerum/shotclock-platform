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
if apt-cache show chromium-browser >/dev/null 2>&1; then
  apt-get install -y chromium-browser chromium-sandbox
else
  apt-get install -y chromium chromium-sandbox
fi

# Install NetworkManager for WiFi management
apt-get install -y network-manager

# Install hostapd and dnsmasq for captive portal
apt-get install -y hostapd dnsmasq
```

The repository installer already handles the Chromium package name difference. If `scripts/install-pi.sh` fails with `Package chromium-browser is not available` or `Unable to locate package libgconf-2-4`, pull the latest repo and rerun it:

```bash
cd ~/shotclock-platform
git pull
sudo ./scripts/install-pi.sh
```

That failure happens before `/opt/shotclock/shared` is created, so editing `/opt/shotclock/shared/.env` will also fail until the installer completes.

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
```

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
