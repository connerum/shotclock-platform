#!/usr/bin/env bash
set -euo pipefail

for _attempt in 1 2 3; do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/healthz >/dev/null; then
    exit 0
  fi
  sleep 3
done

logger -t courtcast-health 'Health endpoint failed three times; restarting courtcast.service'
systemctl restart courtcast.service
