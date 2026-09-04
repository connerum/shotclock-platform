# CourtCast Production Handoff

This document is the operational source of truth for the production server and embedded displays. Keep the separately delivered `.handoff-vault` directory offline and provide it only to authorized operators.

## Production inventory

| Component | Address | Service |
| --- | --- | --- |
| Dashboard/API | `https://courtcast.safety-linq.com` | `courtcast.service` on `5.161.109.106` |
| Display 40091 | device `shotclock-1e4b353c` | `shotclock-agent`, `shotclock-kiosk` |
| Display 40091 support tunnel | server loopback `127.0.0.1:44094` | `shotclock-remote-support` |
| Display 40092 | device `shotclock-aa8f34d0` | `shotclock-agent`, `shotclock-kiosk` |
| Display 40092 support tunnel | server loopback `127.0.0.1:44092` | `shotclock-remote-support` |
| Display 40100 | device `shotclock-95e17086` | `shotclock-agent`, `shotclock-kiosk` |
| Display 40100 support tunnel | server loopback `127.0.0.1:44100` | `shotclock-remote-support` |
| Legacy board (`dart@raspberrypi`) | device `shotclock-b4cd01b3`, serial `1639d968d7b496bb` | `shotclock-agent`, `shotclock-kiosk` |
| Legacy board support tunnel | server loopback `127.0.0.1:44093` | `shotclock-remote-support` |

## Routine health checks

Public checks:

```bash
curl -fsS https://courtcast.safety-linq.com/healthz
curl -fsS https://courtcast.safety-linq.com/readyz
```

Server checks:

```bash
ssh -F .handoff-vault/ssh-config courtcast-prod
sudo systemctl status courtcast courtcast-backup.timer courtcast-healthcheck.timer
sudo journalctl -u courtcast --since today
sudo systemctl start courtcast-backup
```

Display checks, using the outbound support tunnel (works whenever the display has Internet access):

```bash
ssh -F .handoff-vault/ssh-config display-40100-via-server
sudo systemctl status shotclock-agent shotclock-kiosk shotclock-remote-support shotclock-backup.timer
curl -fsS http://127.0.0.1:3001/local/health
sudo journalctl -u shotclock-agent -u shotclock-kiosk --since today
```

## Recovery when normal WiFi is unavailable

Each display preserves saved NetworkManager profiles. After one minute without a usable WiFi address it starts its maintenance network: `Shotclock-Setup-1e4b35` for 40091, `Shotclock-Setup-aa8f34` for 40092, `Shotclock-Setup-95e170` for 40100, or `Shotclock-Setup-b4cd01` for the legacy board. Each unique 12-character password is in the corresponding maintenance-AP password file in the handoff vault. A nearby operator can join that network without opening the LED panel, browse to `http://192.168.4.1:8080`, and select replacement WiFi. While connected to the maintenance AP, SSH is also available at `192.168.4.1` with the vaulted Pi key. SSH password login is disabled on hardened production machines; the recovered legacy board retains password access temporarily until its local handoff is complete.

While the maintenance AP is idle, firmware 1.2.19 and later briefly retries the saved WiFi profiles every two minutes. A successful retry restores CourtCast automatically; a failed retry restores the maintenance AP. The retry is deferred whenever a technician is connected to the AP so an active troubleshooting session is not interrupted. The display continues showing last-known content during an outage, with an `OFFLINE`, `NETWORK SETUP`, or `RECONNECTING` banner above non-emergency media.

No remote software can connect to a device that has no radio, wired, or cellular path at all. The maintenance AP removes the need to touch or open the embedded Pi, while the reverse tunnel removes router/port-forwarding dependencies whenever any Internet path is present.

## Backups and rollback

- Server: daily SQLite-consistent database, environment, Caddy, service, and media archives under `/var/backups/courtcast`, retained 30 days. Readiness fails if the last successful backup is older than 36 hours.
- Display: daily state, WiFi profile, configuration, and service archives under `/opt/shotclock/backups`, retained 14 days.
- Initial verified recovery archives are also in `.handoff-vault/backups` off the production machines.
- Server releases are immutable under `/opt/courtcast/releases`; `/opt/courtcast/current` is the active atomic symlink.
- Display releases are immutable under `/opt/shotclock/releases`; its updater automatically restores the previous symlink if the agent, kiosk, or local health check fails.

To roll the server back, point `/opt/courtcast/current` to the preceding release, restore the pre-deployment database only if its migration is incompatible, and restart `courtcast`. Never restore only the database while newer application code is actively writing to it.

## Account and device administration

Public registration is disabled. The company administrator address and one-time password are in the handoff vault. The first login requires a password change. Administrators can create, reset, disable, and enable accounts at `/users`; users can change their own password at `/account`. Password changes and account actions revoke existing sessions.

Login attempts are limited per public client IP. A blocked client can wait for the `Retry-After` interval (normally no more than 15 minutes). If the sole administrator has also lost the current password, generate a new random password, run the existing user-management command on the server, and restart the application to clear only the in-memory attempt counters:

```bash
ssh -F .handoff-vault/ssh-config courtcast-prod
set -a; source /opt/courtcast/shared/.env; set +a
export ADMIN_EMAIL='courtcast-admin@safety-linq.com' ADMIN_PASSWORD='<new random password>'
sudo --preserve-env=DATABASE_URL,ADMIN_EMAIL,ADMIN_PASSWORD -u courtcast \
  /opt/courtcast/current/node_modules/.bin/tsx /opt/courtcast/current/scripts/manage-user.ts
sudo systemctl restart courtcast
```

Replace the vaulted `company-admin-password.txt` immediately. The reset forces a password change on first login and revokes older sessions.

Displays authenticate with a unique random token. Tokens are stored hashed in the server database and as root-readable configuration on each display. To rotate one:

```bash
DEVICE_ID=shotclock-aa8f34d0 DEVICE_AUTH_TOKEN='<new random token>' pnpm device:provision-token
```

Place the same value in the display's `/opt/shotclock/shared/.env`, then restart `shotclock-agent`. Never reuse a device token on another panel.

## Deploying the server

1. Build and test under supported Node 20 or 22 (production uses 22): `pnpm install --frozen-lockfile && pnpm -r build && pnpm test && pnpm audit --prod`.
2. Create a versioned directory under `/opt/courtcast/releases` and build there.
3. Run `prisma migrate deploy` against a copy of production first; require `PRAGMA integrity_check = ok`.
4. Run an immediate production backup, stop the service briefly, migrate the live database, atomically change `/opt/courtcast/current`, and restart.
5. Verify `/healthz`, `/readyz`, login, Socket.IO device authentication, and the connected display before deleting nothing. Retain the prior release and backup.

## Deploying displays

```bash
bash scripts/build-pi-release.sh 1.0.1
```

Publish the resulting archive and its exact SHA-256/byte size as a firmware release. The agent validates HTTPS, semantic version, size, digest, archive paths, service state, and local health before accepting it. Failed installations roll back automatically.

## Alerts and escalation

The on-host health timer restarts a failed application after three checks. Check `journalctl`, `/readyz`, backup timestamps, disk usage, certificate status, and the support tunnel first. This installation has local retention but no company-controlled off-site object-storage destination; an operator should periodically copy server backups off-host or configure one under company ownership.

Repository ownership, DNS registrar access, Hetzner ownership, and the `safety-linq.com` email/certificate contacts must also be transferred to company-controlled accounts. These external ownership changes cannot be encoded in this repository.
