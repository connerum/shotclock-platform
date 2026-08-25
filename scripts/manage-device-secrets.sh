#!/usr/bin/env bash
set -euo pipefail

env_file="/opt/shotclock/shared/.env"
migrate_legacy_ap_password=false

usage() {
  echo "usage: $0 [--env-file PATH] [--migrate-legacy-ap-password]" >&2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      env_file="$2"
      shift 2
      ;;
    --migrate-legacy-ap-password)
      migrate_legacy_ap_password=true
      shift
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

mkdir -p "$(dirname "$env_file")"
touch "$env_file"

read_env_value() {
  local key="$1"
  grep "^${key}=" "$env_file" 2>/dev/null | tail -n 1 | cut -d= -f2- || true
}

random_hex() {
  local bytes="$1"
  od -An -N "$bytes" -tx1 /dev/urandom | tr -d ' \n'
}

replace_env_value() {
  local key="$1"
  local value="$2"
  local temp_file
  temp_file="$(mktemp "${env_file}.tmp.XXXXXX")"
  awk -v key="$key" 'index($0, key "=") != 1 { print }' "$env_file" > "$temp_file"
  printf '%s=%s\n' "$key" "$value" >> "$temp_file"
  chmod 600 "$temp_file"
  mv "$temp_file" "$env_file"
}

is_unconfigured_secret() {
  local value="$1"
  [ -z "$value" ] || [[ "$value" == replace-* ]] || [[ "$value" == development-* ]]
}

setup_ap_password="$(read_env_value SETUP_AP_PASSWORD)"
if is_unconfigured_secret "$setup_ap_password"; then
  replace_env_value SETUP_AP_PASSWORD "$(random_hex 6)"
  echo "Generated a unique 12-character SETUP_AP_PASSWORD"
elif $migrate_legacy_ap_password && [[ "$setup_ap_password" =~ ^[0-9a-f]{32}$ ]]; then
  replace_env_value SETUP_AP_PASSWORD "$(random_hex 6)"
  echo "Rotated legacy generated SETUP_AP_PASSWORD to the 12-character format"
else
  echo "SETUP_AP_PASSWORD already has a device-specific value"
fi

device_auth_token="$(read_env_value DEVICE_AUTH_TOKEN)"
if is_unconfigured_secret "$device_auth_token"; then
  replace_env_value DEVICE_AUTH_TOKEN "$(random_hex 32)"
  echo "Generated a unique DEVICE_AUTH_TOKEN"
else
  echo "DEVICE_AUTH_TOKEN already has a device-specific value"
fi

chmod 600 "$env_file"
