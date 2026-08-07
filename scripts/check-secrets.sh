#!/usr/bin/env bash
set -euo pipefail

patterns=(
  'PatchWork22'
  'SUPER_PASSWORD_HASH'
  'shotclock123'
  'conner@two-a-days.com'
)

failed=0
for pattern in "${patterns[@]}"; do
  if git grep -n -F "$pattern" -- ':!scripts/check-secrets.sh' ':!prisma/migrations/20260505010000_auth_device_ownership/migration.sql' ':!prisma/migrations/20260807010000_production_hardening/migration.sql'; then
    echo "Forbidden credential marker found: $pattern" >&2
    failed=1
  fi
done
exit "$failed"
