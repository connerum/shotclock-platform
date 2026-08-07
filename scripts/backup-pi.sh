#!/usr/bin/env bash
set -euo pipefail

backup_root="/opt/shotclock/backups"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$backup_root/shotclock-device-$stamp.tar.gz"
install -d -m 700 "$backup_root"

tar -czf "$archive" \
  /opt/shotclock/shared \
  /home/shotclock/.shotclock \
  /etc/NetworkManager/system-connections \
  /etc/systemd/system/shotclock-agent.service \
  /etc/systemd/system/shotclock-kiosk.service 2>/dev/null
chmod 600 "$archive"
sha256sum "$archive" > "$archive.sha256"
chmod 600 "$archive.sha256"
find "$backup_root" -maxdepth 1 -type f -name 'shotclock-device-*.tar.gz' -mtime +14 -delete
find "$backup_root" -maxdepth 1 -type f -name 'shotclock-device-*.tar.gz.sha256' -mtime +14 -delete
printf '%s\n' "$archive"
