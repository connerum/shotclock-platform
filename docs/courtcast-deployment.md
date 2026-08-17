# CourtCast Server Deployment

The active production runbook is [PRODUCTION_HANDOFF.md](./PRODUCTION_HANDOFF.md). This page records the server layout expected by the checked-in service and maintenance scripts.

## Layout

```text
/opt/courtcast/
  current -> /opt/courtcast/releases/<version>
  releases/<version>/
  shared/.env
  shared/media/
  data/prod.db
/var/backups/courtcast/
/var/lib/courtcast/backup/latest-success
```

The application runs as the non-login `courtcast` user. Caddy terminates TLS and proxies from its Docker network to host port 3000; UFW permits that port only from the Docker subnet.

## Required environment

```bash
NODE_ENV=production
SERVER_PORT=3000
COREPACK_HOME=/opt/courtcast/shared/corepack
COURTCAST_MEDIA_DIR=/opt/courtcast/shared/media
SERVER_URL=https://courtcast.safety-linq.com
NEXT_PUBLIC_SERVER_URL=https://courtcast.safety-linq.com
DATABASE_URL=file:/opt/courtcast/data/prod.db
AUTH_SECRET=<at-least-32-random-characters>
ALLOWED_ORIGINS=https://courtcast.safety-linq.com
ALLOW_PUBLIC_REGISTRATION=false
BACKUP_STATUS_FILE=/var/lib/courtcast/backup/latest-success
SHOTCLOCK_VERSION=<release-version>
```

Use `ops/server/courtcast.service`, the backup and health timers in `systemd/`, and the matching scripts in `scripts/`. Do not put the environment file inside a release or Git checkout.

## Validation gate

Before changing `current`, require all of the following:

```bash
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm -r build
pnpm test
pnpm audit --prod
bash scripts/check-secrets.sh
```

Run every migration against a byte-for-byte copy of production and require `PRAGMA integrity_check` to return `ok`. Take another consistent production backup immediately before the short stop/migrate/symlink/start cutover.

Afterwards, require both health endpoints, a company-admin login, disabled registration, an authenticated display Socket.IO connection, a valid backup archive, and a retained previous release.
