#!/bin/bash
# Shotclock Pi Installation Script
# This script installs all required dependencies for the Shotclock Pi Agent and Kiosk
# Idempotent: running it multiple times is safe

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
TOTAL_STEPS=13

echo "[1/${TOTAL_STEPS}] Updating apt cache..."
apt-get update -qq

echo ""
echo "[2/${TOTAL_STEPS}] Installing Node.js 22 from NodeSource..."
if ! command -v node &> /dev/null || [ "$(node -v)" != "v22"* ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "Node.js $(node -v) already installed, skipping"
fi

echo ""
echo "[3/${TOTAL_STEPS}] Installing pnpm globally..."
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
else
  echo "pnpm $(pnpm -v) already installed, skipping"
fi

echo ""
echo "[4/${TOTAL_STEPS}] Installing Chromium and required deps..."
package_is_installable() {
  local pkg="$1"
  apt-cache policy "$pkg" 2>/dev/null | awk '/Candidate:/ { found=1; if ($2 != "(none)") exit 0; exit 1 } END { if (!found) exit 1 }'
}

CHROMIUM_PACKAGE=""
for candidate in chromium-browser chromium; do
  if package_is_installable "$candidate"; then
    CHROMIUM_PACKAGE="$candidate"
    break
  fi
done

if [ -z "$CHROMIUM_PACKAGE" ]; then
  echo "No installable Chromium package found. Expected chromium-browser or chromium."
  exit 1
fi

CHROMIUM_DEPS=(
  "$CHROMIUM_PACKAGE"
  chromium-sandbox
  libxss1
  libnss3
  xdg-utils
  libasound2
  libatk-bridge2.0-0
  libgtk-3-0
  libxcomposite1
  libxrandr2
  libgbm1
  libpango-1.0-0
  libcairo2
  libpangocairo-1.0-0
  x11-xserver-utils
  unclutter
)

# Debian/Raspberry Pi OS releases rename or remove a few compatibility packages.
# Install what is available instead of failing the whole setup on stale names.
AVAILABLE_CHROMIUM_DEPS=()
for pkg in "${CHROMIUM_DEPS[@]}"; do
  if package_is_installable "$pkg"; then
    AVAILABLE_CHROMIUM_DEPS+=("$pkg")
  else
    echo "Skipping unavailable package: $pkg"
  fi
done

apt-get install -y "${AVAILABLE_CHROMIUM_DEPS[@]}"

echo ""
echo "[5/${TOTAL_STEPS}] Installing NetworkManager, hostapd, dnsmasq, and local hostname support..."
apt-get install -y network-manager hostapd dnsmasq avahi-daemon libnss-mdns iproute2 iptables rfkill iw wireless-regdb

echo ""
echo "[6/${TOTAL_STEPS}] Creating /opt/shotclock directory structure..."
mkdir -p /opt/shotclock/releases
mkdir -p /opt/shotclock/shared/config
mkdir -p /opt/shotclock/shared/media

echo ""
echo "[7/${TOTAL_STEPS}] Copying config templates..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "${SCRIPT_DIR}/config" ]; then
  cp -n "${SCRIPT_DIR}/config/"*.template /opt/shotclock/shared/config/ 2>/dev/null || true
  for f in /opt/shotclock/shared/config/*.template; do
    [ -f "$f" ] || continue
    base="$(basename "$f" .template)"
    if [ ! -f "/opt/shotclock/shared/config/${base}" ]; then
      cp "$f" "/opt/shotclock/shared/config/${base}"
    fi
  done
  echo "Config templates copied to /opt/shotclock/shared/config/"
  if [ ! -f "/opt/shotclock/shared/.env" ] && [ -f "/opt/shotclock/shared/config/agent.env" ]; then
    cp "/opt/shotclock/shared/config/agent.env" "/opt/shotclock/shared/.env"
    echo "Created /opt/shotclock/shared/.env from agent.env template"
  fi
else
  echo "Warning: config templates directory not found at ${SCRIPT_DIR}/config"
fi

ensure_env_default() {
  local key="$1"
  local value="$2"
  local env_file="/opt/shotclock/shared/.env"

  touch "$env_file"
  if grep -q "^${key}=" "$env_file"; then
    echo "${key} already configured in ${env_file}"
  else
    echo "${key}=${value}" >> "$env_file"
    echo "Set ${key}=${value} in ${env_file}"
  fi
}

# NovaStar MSD300-1 deployment default. Field testing showed moving/running
# basketball displays produced blue-dot artifacts at higher Pi resolutions.
# 1024x768@60 keeps the MSD300-1 input stable while RGB/BGR correction remains
# enabled for correct panel colors.
ensure_env_default "KIOSK_DISPLAY_OUTPUT" "auto"
ensure_env_default "KIOSK_DISPLAY_MODE" "1024x768"
ensure_env_default "KIOSK_DISPLAY_RATE" "60"
ensure_env_default "KIOSK_HIDE_CURSOR" "true"
ensure_env_default "PI5_PSU_MAX_CURRENT" "5000"

echo ""
echo "[8/${TOTAL_STEPS}] Configuring Raspberry Pi 5 embedded power override..."
configure_pi5_embedded_power() {
  local model=""
  local target_current="${PI5_PSU_MAX_CURRENT:-5000}"
  local current_config=""
  local tmp_config=""

  model="$(tr -d '\0' < /proc/device-tree/model 2>/dev/null || true)"
  if [[ "$model" != *"Raspberry Pi 5"* ]]; then
    echo "Not a Raspberry Pi 5 (${model:-unknown hardware}); skipping EEPROM power override"
    return 0
  fi

  if [[ -z "$target_current" || "$target_current" == "0" || "$target_current" == "false" ]]; then
    echo "PI5_PSU_MAX_CURRENT disabled; skipping EEPROM power override"
    return 0
  fi

  if ! [[ "$target_current" =~ ^[0-9]+$ ]]; then
    echo "Invalid PI5_PSU_MAX_CURRENT=${target_current}; expected milliamps such as 5000"
    return 1
  fi

  if [ "$target_current" -lt 3000 ] || [ "$target_current" -gt 5000 ]; then
    echo "Invalid PI5_PSU_MAX_CURRENT=${target_current}; Raspberry Pi 5 accepts 3000-5000"
    return 1
  fi

  if ! command -v rpi-eeprom-config >/dev/null 2>&1; then
    echo "Warning: rpi-eeprom-config not found; cannot set PSU_MAX_CURRENT=${target_current}"
    echo "Install/update rpi-eeprom, then run: sudo rpi-eeprom-config --edit"
    return 0
  fi

  current_config="$(rpi-eeprom-config 2>/dev/null || true)"
  if [ -z "$current_config" ]; then
    echo "Unable to read current EEPROM config; not applying PSU_MAX_CURRENT"
    return 1
  fi

  if echo "$current_config" | grep -q "^PSU_MAX_CURRENT=${target_current}$"; then
    echo "PSU_MAX_CURRENT=${target_current} already configured"
    return 0
  fi

  tmp_config="$(mktemp)"
  printf '%s\n' "$current_config" > "$tmp_config"
  if grep -q '^PSU_MAX_CURRENT=' "$tmp_config"; then
    sed -i "s/^PSU_MAX_CURRENT=.*/PSU_MAX_CURRENT=${target_current}/" "$tmp_config"
  else
    printf '\nPSU_MAX_CURRENT=%s\n' "$target_current" >> "$tmp_config"
  fi

  if ! rpi-eeprom-config --apply "$tmp_config"; then
    rm -f "$tmp_config"
    echo "Failed to apply Raspberry Pi EEPROM config"
    return 1
  fi
  rm -f "$tmp_config"

  echo "Scheduled Raspberry Pi 5 EEPROM PSU_MAX_CURRENT=${target_current}"
  echo "After install, shut down and hard power-cycle the panel for the PMIC to use this setting."
}

if [ -f /opt/shotclock/shared/.env ] && grep -q '^PI5_PSU_MAX_CURRENT=' /opt/shotclock/shared/.env; then
  PI5_PSU_MAX_CURRENT="$(grep '^PI5_PSU_MAX_CURRENT=' /opt/shotclock/shared/.env | tail -n 1 | cut -d= -f2-)"
fi
configure_pi5_embedded_power

echo ""
echo "[9/${TOTAL_STEPS}] Creating shotclock user..."
if ! id -u shotclock > /dev/null 2>&1; then
  useradd -r -m -s /bin/bash shotclock
  echo "Created shotclock user"
else
  echo "User shotclock already exists, skipping"
fi

echo ""
echo "[10/${TOTAL_STEPS}] Setting ownership..."
mkdir -p /home/shotclock/.shotclock
chown -R shotclock:shotclock /opt/shotclock
chown -R shotclock:shotclock /home/shotclock/.shotclock

echo ""
echo "[11/${TOTAL_STEPS}] Installing systemd service files..."
if [ -d "${SCRIPT_DIR}/../systemd" ]; then
  cp "${SCRIPT_DIR}/../systemd/"*.service /etc/systemd/system/
  systemctl daemon-reload
  echo "Systemd service files installed"
else
  echo "Warning: systemd directory not found at ${SCRIPT_DIR}/../systemd"
fi

echo ""
echo "[12/${TOTAL_STEPS}] Enabling services..."
systemctl enable shotclock-agent 2>/dev/null || true
systemctl enable shotclock-kiosk 2>/dev/null || true
echo "Services enabled"

echo ""
echo "[13/${TOTAL_STEPS}] Setting up release symlink..."
CURRENT_VERSION="0.1.0"
if [ -d "/opt/shotclock/releases/${CURRENT_VERSION}" ]; then
  ln -sfn /opt/shotclock/releases/${CURRENT_VERSION} /opt/shotclock/current
  chown -h shotclock:shotclock /opt/shotclock/current
  echo "Symlink created: /opt/shotclock/current -> releases/${CURRENT_VERSION}"
else
  echo "Warning: Release ${CURRENT_VERSION} not found at /opt/shotclock/releases/${CURRENT_VERSION}"
  echo "  The app directory should be placed there after building."
  echo "  For development, you can skip this step."
fi

echo ""
echo "============================================"
echo "Installation complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Copy or clone the shotclock-platform repo to /opt/shotclock/releases/${CURRENT_VERSION}/"
echo "     (or wherever you placed the built application)"
echo "  2. Edit config files in /opt/shotclock/shared/config/:"
echo "       agent.env           - Set SERVER_URL, DEVICE_NAME, etc."
echo "       hostapd.conf        - Set WiFi SSID and PASSWORD"
echo "       dnsmasq.conf        - Usually fine as-is"
echo "       wpa_supplicant.conf - For client WiFi (not AP mode)"
echo "  3. Run 'systemctl start shotclock-agent' to start the agent"
echo "  4. Run 'systemctl start shotclock-kiosk' to start the kiosk"
echo "  5. Connect to the AP named like Shotclock-Setup-xxxxxx and open sportsboard.local"
echo "     Fallback: http://192.168.4.1:8080"
echo "  6. On embedded Raspberry Pi 5 installs, shut down once and hard power-cycle the panel"
echo "     after PSU_MAX_CURRENT is scheduled."
echo ""
echo "To build the app on the Pi:"
echo "  cd /opt/shotclock/releases/${CURRENT_VERSION}"
echo "  pnpm install"
echo "  pnpm build"
echo ""
