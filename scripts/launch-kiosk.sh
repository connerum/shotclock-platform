#!/bin/bash
# Launch Kiosk - Starts Chromium in kiosk mode

export DISPLAY=:0

# Optional: Set resolution
# export DISPLAY=:0.0

# Optional: Uncomment for HDMI audio
# export AUDIO_DEVICE=both

echo "Launching Shotclock Kiosk..."

chromium-browser \
  --kiosk \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-extensions \
  --disable-translate \
  --disable-background-networking \
  --disable-sync \
  --disable-default-apps \
  --no-first-run \
  --noerrdialogs \
  --ignore-gpu-blocklist \
  --enable-features=UseOzonePlatform \
  --ozone-platform=headless \
  http://localhost:3001

echo "Kiosk closed."
