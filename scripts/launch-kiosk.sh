#!/bin/bash
# Launch Kiosk - Starts Chromium in kiosk mode for Shotclock Pi Kiosk

set -e

export DISPLAY="${DISPLAY:-:0}"
AGENT_LOCAL_API_PORT="${AGENT_LOCAL_API_PORT:-3001}"
KIOSK_URL="${KIOSK_URL:-http://127.0.0.1:${AGENT_LOCAL_API_PORT}/}"

echo "Launching Shotclock Kiosk..."

if command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM_BIN="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
  CHROMIUM_BIN="chromium"
else
  echo "Chromium is not installed. Install chromium or chromium-browser."
  exit 1
fi

detect_kiosk_user() {
  if [ -n "${KIOSK_USER:-}" ]; then
    echo "$KIOSK_USER"
    return
  fi

  if command -v loginctl >/dev/null 2>&1; then
    loginctl list-sessions --no-legend 2>/dev/null | awk '$4 != "" && $3 != "root" { print $3; exit }'
    return
  fi

  getent passwd | awk -F: '$3 >= 1000 && $1 != "nobody" { print $1; exit }'
}

KIOSK_RUN_USER="$(detect_kiosk_user)"
if [ -z "$KIOSK_RUN_USER" ]; then
  echo "No graphical login user found. Set KIOSK_USER in /opt/shotclock/shared/.env."
  exit 1
fi

KIOSK_HOME="$(getent passwd "$KIOSK_RUN_USER" | cut -d: -f6)"
if [ -z "$KIOSK_HOME" ] || [ ! -d "$KIOSK_HOME" ]; then
  echo "Home directory not found for kiosk user: $KIOSK_RUN_USER"
  exit 1
fi

export XAUTHORITY="${XAUTHORITY:-${KIOSK_HOME}/.Xauthority}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u "$KIOSK_RUN_USER")}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"

USER_DATA_DIR="/tmp/shotclock-kiosk-profile-${KIOSK_RUN_USER}"
mkdir -p "$USER_DATA_DIR"
chown "$KIOSK_RUN_USER:$KIOSK_RUN_USER" "$USER_DATA_DIR"

if command -v xset >/dev/null 2>&1; then
  runuser -u "$KIOSK_RUN_USER" -- env DISPLAY="$DISPLAY" XAUTHORITY="$XAUTHORITY" xset s off -dpms s noblank >/dev/null 2>&1 || true
fi

CHROMIUM_ARGS=(
  --kiosk
  --no-sandbox
  --disable-dev-shm-usage
  --disable-gpu
  --disable-software-rasterizer
  --disable-background-timer-throttling
  --disable-backgrounding-occluded-windows
  --disable-renderer-backgrounding
  --disable-extensions
  --disable-translate
  --disable-background-networking
  --disable-sync
  --disable-default-apps
  --no-first-run
  --noerrdialogs
  --ignore-gpu-blocklist
  --user-data-dir="$USER_DATA_DIR"
  "$KIOSK_URL"
)

echo "Starting Chromium as ${KIOSK_RUN_USER} on DISPLAY=${DISPLAY}: ${KIOSK_URL}"

# Launch Chromium in full kiosk mode. The Pi agent serves the built kiosk UI
# and local API from the same port.
if [ "$(id -u)" -eq 0 ] && [ "$KIOSK_RUN_USER" != "root" ]; then
  exec runuser -u "$KIOSK_RUN_USER" -- env \
    DISPLAY="$DISPLAY" \
    XAUTHORITY="$XAUTHORITY" \
    XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
    DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" \
    "$CHROMIUM_BIN" "${CHROMIUM_ARGS[@]}"
fi

exec "$CHROMIUM_BIN" "${CHROMIUM_ARGS[@]}"

echo "Kiosk closed."
