#!/bin/bash
# Launch Kiosk - Starts Chromium in kiosk mode for Shotclock Pi Kiosk

set -e

export DISPLAY="${DISPLAY:-:0}"
AGENT_LOCAL_API_PORT="${AGENT_LOCAL_API_PORT:-3001}"
KIOSK_URL="${KIOSK_URL:-http://127.0.0.1:${AGENT_LOCAL_API_PORT}/}"
KIOSK_START_TIMEOUT="${KIOSK_START_TIMEOUT:-120}"
KIOSK_DISPLAY_MODE="${KIOSK_DISPLAY_MODE:-1024x768}"
KIOSK_DISPLAY_RATE="${KIOSK_DISPLAY_RATE:-60}"
KIOSK_DISPLAY_OUTPUT="${KIOSK_DISPLAY_OUTPUT:-auto}"

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

apply_display_mode() {
  if [ -z "${KIOSK_DISPLAY_MODE:-}" ] || [ "$KIOSK_DISPLAY_MODE" = "auto" ]; then
    echo "Kiosk display mode left unchanged"
    return
  fi

  if ! command -v xrandr >/dev/null 2>&1; then
    echo "xrandr not available; cannot set kiosk display mode"
    return
  fi

  local output="$KIOSK_DISPLAY_OUTPUT"
  if [ -z "$output" ] || [ "$output" = "auto" ]; then
    output="$(runuser -u "$KIOSK_RUN_USER" -- env DISPLAY="$DISPLAY" XAUTHORITY="$XAUTHORITY" xrandr --query 2>/dev/null | awk '/ connected/ { print $1; exit }' || true)"
  fi

  if [ -z "$output" ]; then
    echo "No connected display output found; cannot set kiosk display mode"
    return
  fi

  echo "Setting kiosk display output ${output} to ${KIOSK_DISPLAY_MODE}@${KIOSK_DISPLAY_RATE}Hz"
  runuser -u "$KIOSK_RUN_USER" -- env DISPLAY="$DISPLAY" XAUTHORITY="$XAUTHORITY" \
    xrandr --output "$output" --mode "$KIOSK_DISPLAY_MODE" --rate "$KIOSK_DISPLAY_RATE" >/dev/null 2>&1 \
    || echo "Warning: failed to set ${output} to ${KIOSK_DISPLAY_MODE}@${KIOSK_DISPLAY_RATE}Hz"
}

apply_display_mode

wait_for_kiosk_url() {
  local deadline=$((SECONDS + KIOSK_START_TIMEOUT))

  echo "Waiting up to ${KIOSK_START_TIMEOUT}s for kiosk URL: ${KIOSK_URL}"
  while [ "$SECONDS" -lt "$deadline" ]; do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS --max-time 2 "$KIOSK_URL" >/dev/null 2>&1; then
        echo "Kiosk URL is ready"
        return 0
      fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q --timeout=2 --tries=1 -O /dev/null "$KIOSK_URL" >/dev/null 2>&1; then
        echo "Kiosk URL is ready"
        return 0
      fi
    else
      # If no HTTP probe exists, avoid failing the kiosk outright.
      sleep 8
      return 0
    fi

    sleep 1
  done

  echo "Kiosk URL did not become ready before timeout"
  return 1
}

wait_for_kiosk_url

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
  --autoplay-policy=no-user-gesture-required
  --no-first-run
  --noerrdialogs
  --password-store=basic
  --use-mock-keychain
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
