#!/bin/bash
# Launch Kiosk - Starts Chromium in kiosk mode for Shotclock Pi Kiosk

export DISPLAY=:0
AGENT_LOCAL_API_PORT="${AGENT_LOCAL_API_PORT:-3001}"

echo "Launching Shotclock Kiosk..."

if command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM_BIN="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
  CHROMIUM_BIN="chromium"
else
  echo "Chromium is not installed. Install chromium or chromium-browser."
  exit 1
fi

# Launch Chromium in full kiosk mode. The Pi agent serves the built kiosk UI
# and local API from the same port.
"${CHROMIUM_BIN}" \
  --kiosk \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-extensions \
  --disable-translate \
  --disable-background-networking \
  --disable-sync \
  --disable-default-apps \
  --no-first-run \
  --noerrdialogs \
  --ignore-gpu-blocklist \
  "http://127.0.0.1:${AGENT_LOCAL_API_PORT}/"

echo "Kiosk closed."
