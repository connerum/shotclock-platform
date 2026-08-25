#!/usr/bin/env bash
set -euo pipefail

archive="${1:?archive path is required}"
version="${2:?version is required}"
expected_checksum="${3:?checksum is required}"
release_root="/opt/shotclock/releases"
current_link="/opt/shotclock/current"
lock_file="/run/lock/shotclock-update.lock"

[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]
[[ "$archive" == /home/shotclock/.shotclock/updates/shotclock-*.tar.gz ]]
[[ "$expected_checksum" =~ ^[a-f0-9]{64}$ ]]

exec 9>"$lock_file"
flock -n 9 || { echo 'Another update is already running'; exit 1; }

actual_checksum="$(sha256sum "$archive" | awk '{print $1}')"
test "$actual_checksum" = "$expected_checksum"

staging="$(mktemp -d "$release_root/.update-${version}.XXXXXX")"
cleanup() { rm -rf -- "$staging"; }
trap cleanup EXIT

tar -xzf "$archive" -C "$staging" --no-same-owner --no-same-permissions
source_dir="$staging/$version"
if [ ! -d "$source_dir" ]; then
  source_dir="$(find "$staging" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
fi
test -n "$source_dir"
test -f "$source_dir/apps/pi-agent/dist/index.js"
test -f "$source_dir/apps/pi-kiosk/dist/index.html"
test -f "$source_dir/pnpm-lock.yaml"
test -f "$source_dir/scripts/launch-kiosk.sh"

cd "$source_dir"
corepack pnpm install --prod --frozen-lockfile \
  --filter @shotclock/pi-agent... \
  --filter @shotclock/pi-kiosk...

destination="$release_root/$version"
test ! -e "$destination"
mv "$source_dir" "$destination"
chmod 755 "$destination/scripts/"*.sh

# Fresh installs and older production boards used a 32-character generated AP
# password. Keep custom values intact, but make the recognizable legacy format
# practical to type during field recovery before the new services are started.
bash "$destination/scripts/manage-device-secrets.sh" \
  --env-file /opt/shotclock/shared/.env \
  --migrate-legacy-ap-password

previous="$(readlink -f "$current_link")"
ln -s "$destination" "${current_link}.next"
mv -Tf "${current_link}.next" "$current_link"

install -m 644 "$destination/systemd/shotclock-agent.service" /etc/systemd/system/shotclock-agent.service
install -m 644 "$destination/systemd/shotclock-kiosk.service" /etc/systemd/system/shotclock-kiosk.service
install -m 644 "$destination/systemd/shotclock-backup.service" /etc/systemd/system/shotclock-backup.service
install -m 644 "$destination/systemd/shotclock-backup.timer" /etc/systemd/system/shotclock-backup.timer
systemctl daemon-reload
systemctl enable --now shotclock-backup.timer
systemctl restart shotclock-agent.service shotclock-kiosk.service
sleep 20

if ! systemctl is-active --quiet shotclock-agent.service \
  || ! systemctl is-active --quiet shotclock-kiosk.service \
  || ! curl -fsS --max-time 5 http://127.0.0.1:3001/local/health >/dev/null; then
  echo "Update health check failed; rolling back to $previous" >&2
  ln -s "$previous" "${current_link}.rollback"
  mv -Tf "${current_link}.rollback" "$current_link"
  systemctl restart shotclock-agent.service shotclock-kiosk.service
  exit 1
fi

trap - EXIT
rm -rf -- "$staging"

prune_old_releases() {
  local active_release="$1"
  local rollback_release="$2"
  local candidate candidate_path
  local -a installed_releases=()

  while IFS= read -r candidate; do
    [[ "$candidate" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || continue
    installed_releases+=("$candidate")
  done < <(find "$release_root" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -V)

  for candidate in "${installed_releases[@]}"; do
    [ "${#installed_releases[@]}" -le 3 ] && break
    candidate_path="$release_root/$candidate"
    [ "$candidate_path" = "$active_release" ] && continue
    [ "$candidate_path" = "$rollback_release" ] && continue
    [[ "$candidate_path" == "$release_root"/* ]] || return 1
    rm -rf -- "$candidate_path"
    installed_releases=("${installed_releases[@]:1}")
  done
}

prune_old_releases "$destination" "$previous"
find /home/shotclock/.shotclock/updates -maxdepth 1 -type f \
  \( -name 'shotclock-*.tar.gz' -o -name 'shotclock-*.tar.gz.part' \) \
  -mtime +7 -delete
corepack pnpm store prune >/dev/null 2>&1 || true
echo "Update $version installed successfully"
