#!/bin/bash
# Launch Kiosk - Starts Chromium in kiosk mode for Shotclock Pi Kiosk

export DISPLAY=:0

echo "Launching Shotclock Kiosk..."

# Launch Chromium in full kiosk mode pointing to the local Pi Agent API
chromium-browser \
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
  http://localhost:3001

echo "Kiosk closed."
