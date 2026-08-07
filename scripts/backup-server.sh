#!/usr/bin/env bash
set -euo pipefail

database="${COURTCAST_DATABASE_PATH:-/opt/courtcast/data/prod.db}"
media_dir="${COURTCAST_MEDIA_DIR:-/opt/courtcast/shared/media}"
backup_root="${COURTCAST_BACKUP_DIR:-/var/backups/courtcast}"
status_dir="${COURTCAST_BACKUP_STATUS_DIR:-/var/lib/courtcast/backup}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$backup_root/courtcast-$stamp.tar.gz"

install -d -m 700 "$backup_root"
# The application only reads this non-secret timestamp for readiness. Directory
# traversal must remain available to the unprivileged courtcast service user.
install -d -m 755 "$status_dir"
staging="$(mktemp -d "$backup_root/.backup-$stamp.XXXXXX")"
cleanup() { rm -rf -- "$staging"; }
trap cleanup EXIT

sqlite3 "$database" ".backup '$staging/prod.db'"
test "$(sqlite3 "$staging/prod.db" 'PRAGMA integrity_check;')" = "ok"
install -m 600 /opt/courtcast/shared/.env "$staging/application.env"
install -m 600 /etc/systemd/system/courtcast.service "$staging/courtcast.service"
install -m 600 /home/safetylinq-camera-bridge/Caddyfile "$staging/Caddyfile"
if [ -f /opt/courtcast/current/RELEASE ]; then
  install -m 600 /opt/courtcast/current/RELEASE "$staging/release.txt"
else
  readlink -f /opt/courtcast/current > "$staging/release.txt"
fi

if [ -d "$media_dir" ]; then
  tar -C "$media_dir" -czf "$staging/media.tar.gz" .
fi

tar -C "$staging" -czf "$archive" .
chmod 600 "$archive"
sha256sum "$archive" > "$archive.sha256"
chmod 600 "$archive.sha256"
touch "$status_dir/latest-success"
chmod 644 "$status_dir/latest-success"

# Retain 30 days of application backups. Restrict deletion to the exact naming
# pattern within the configured backup directory.
find "$backup_root" -maxdepth 1 -type f -name 'courtcast-*.tar.gz' -mtime +30 -delete
find "$backup_root" -maxdepth 1 -type f -name 'courtcast-*.tar.gz.sha256' -mtime +30 -delete

trap - EXIT
rm -rf -- "$staging"
printf '%s\n' "$archive"
