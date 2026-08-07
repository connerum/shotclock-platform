#!/usr/bin/env bash
set -euo pipefail

timeout_seconds="${NETWORK_BOOT_WAIT_SECONDS:-60}"
deadline=$((SECONDS + timeout_seconds))

while [ "$SECONDS" -lt "$deadline" ]; do
  if ip -4 route show default 2>/dev/null | grep -q '^default '; then
    exit 0
  fi
  sleep 2
done

# No default route is a valid state: the agent will start its maintenance AP.
exit 0
