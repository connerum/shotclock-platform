#!/usr/bin/env bash
set -euo pipefail

version="${1:?usage: scripts/build-pi-release.sh X.Y.Z}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$repo_root/releases"
stage_root="$(mktemp -d)"
stage="$stage_root/$version"
trap 'rm -rf "$stage_root"' EXIT

cd "$repo_root"
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/display-core build
pnpm --filter @shotclock/sports-core build
pnpm --filter @shotclock/pi-agent build
pnpm --filter @shotclock/pi-kiosk build

mkdir -p "$stage/apps" "$stage/packages" "$stage/scripts" "$stage/systemd"
for package in pi-agent pi-kiosk; do
  mkdir -p "$stage/apps/$package"
  cp -R "apps/$package/dist" "$stage/apps/$package/dist"
  cp "apps/$package/package.json" "$stage/apps/$package/package.json"
done
for package in shared display-core sports-core; do
  mkdir -p "$stage/packages/$package"
  cp -R "packages/$package/dist" "$stage/packages/$package/dist"
  cp "packages/$package/package.json" "$stage/packages/$package/package.json"
done
cp package.json pnpm-lock.yaml pnpm-workspace.yaml "$stage/"
cp scripts/launch-kiosk.sh scripts/wait-for-network.sh scripts/apply-pi-update.sh scripts/backup-pi.sh scripts/install-pi.sh "$stage/scripts/"
cp systemd/shotclock-agent.service systemd/shotclock-kiosk.service systemd/shotclock-backup.service systemd/shotclock-backup.timer systemd/shotclock-remote-support.service "$stage/systemd/"
printf '%s\n' "$version" > "$stage/VERSION"

mkdir -p "$output_dir"
archive="$output_dir/shotclock-$version.tar.gz"
COPYFILE_DISABLE=1 tar --no-xattrs -C "$stage_root" -czf "$archive" "$version"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$archive" > "$archive.sha256"
else
  shasum -a 256 "$archive" > "$archive.sha256"
fi
printf '%s\n' "$archive"
