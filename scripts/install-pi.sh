#!/bin/bash
# Shotclock Pi Installation Script
# This script installs all required dependencies for the Shotclock Pi Agent and Kiosk

set -e

echo "============================================"
echo "Shotclock Platform - Pi Installation"
echo "============================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

echo ""
echo "[1/10] Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo ""
echo "[2/10] Installing Chromium browser..."
apt-get install -y chromium-browser

echo ""
echo "[3/10] Installing NetworkManager, hostapd, dnsmasq..."
apt-get install -y network-manager hostapd dnsmasq

echo ""
echo "[4/10] Creating /opt/shotclock directory structure..."
mkdir -p /opt/shotclock/releases
mkdir -p /opt/shotclock/shared/config
mkdir -p /opt/shotclock/shared/media

echo ""
echo "[5/10] Creating shotclock user..."
if ! id -u shotclock > /dev/null 2>&1; then
  useradd -r -m -s /bin/bash shotclock
fi
chown -R shotclock:shotclock /opt/shotclock

echo ""
echo "[6/10] Copying systemd service files..."
if [ -d "/home/shotclock/shotclock-platform/systemd" ]; then
  cp /home/shotclock/shotclock-platform/systemd/*.service /etc/systemd/system/
  systemctl daemon-reload
else
  echo "Warning: systemd directory not found, please manually install service files"
fi

echo ""
echo "[7/10] Enabling services..."
systemctl enable shotclock-agent 2>/dev/null || true
systemctl enable shotclock-kiosk 2>/dev/null || true

echo ""
echo "[8/10] Installing current release symlink..."
CURRENT_VERSION="0.1.0"
if [ -d "/opt/shotclock/releases/${CURRENT_VERSION}" ]; then
  ln -sfn /opt/shotclock/releases/${CURRENT_VERSION} /opt/shotclock/current
  chown -h shotclock:shotclock /opt/shotclock/current
else
  echo "Warning: Release ${CURRENT_VERSION} not found, skipping current symlink"
fi

echo ""
echo "[9/10] Creating .env from template..."
if [ -f "/home/shotclock/shotclock-platform/.env.example" ]; then
  cp /home/shotclock/shotclock-platform/.env.example /opt/shotclock/shared/.env
  chown shotclock:shotclock /opt/shotclock/shared/.env
else
  echo "Warning: .env.example not found"
fi

echo ""
echo "[10/10] Setting up for development..."
# Create symlinks for development
if [ -d "/home/shotclock/shotclock-platform" ]; then
  ln -sfn /home/shotclock/shotclock-platform/node_modules /opt/shotclock/current/node_modules 2>/dev/null || true
fi

echo ""
echo "============================================"
echo "Installation complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/shotclock/shared/.env with your configuration"
echo "  2. Run 'systemctl start shotclock-agent' to start the agent"
echo "  3. Run 'systemctl start shotclock-kiosk' to start the kiosk"
echo "  4. Configure WiFi via the captive portal at 192.168.4.1:3001"
echo ""
