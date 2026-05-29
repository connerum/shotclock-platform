# Low-Power Pi Tarball Update Runbook

Use this runbook for Raspberry Pi displays that are too power-constrained to run local TypeScript or Vite builds. The Pi should only stop services, download or receive a tarball, extract built files, and restart services.

Do not run `pnpm build`, `pnpm --filter ... build`, `npm install`, or other compile-heavy commands on these units while they are on minimal power.

## When To Use This

- The Pi shuts down or reboots during `pnpm --filter @shotclock/* build`.
- `vcgencmd get_throttled` reports undervoltage or throttling.
- The Pi is remote and only reachable through Pi Connect, SSH, or remote desktop.
- You need to deploy kiosk or agent changes without stressing the Pi.

## Build On A Mac

From the repository on the Mac:

```bash
cd ~/shotclock-platform

pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/display-core build
pnpm --filter @shotclock/pi-agent build
pnpm --filter @shotclock/pi-kiosk build
```

Create a full Pi build tarball:

```bash
COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/shotclock-pi-build.tgz \
  packages/shared/dist \
  packages/display-core/dist \
  apps/pi-agent/dist \
  apps/pi-kiosk/dist
```

For a kiosk-only UI hotfix, use:

```bash
COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/shotclock-kiosk-build.tgz \
  apps/pi-kiosk/dist
```

`COPYFILE_DISABLE=1` and `--no-xattrs` avoid macOS extended attribute warnings such as `LIBARCHIVE.xattr.com.apple.provenance` when extracting on Raspberry Pi OS.

## Transfer The Tarball

If direct SSH from the Mac can reach the Pi:

```bash
scp /tmp/shotclock-pi-build.tgz admin@DISPLAY_HOST_OR_IP:/tmp/shotclock-pi-build.tgz
```

If the Pi is only reachable through Pi Connect or a remote shell, upload the tarball to a private HTTPS location such as R2, S3, or a private release asset. Then download it from the Pi with `curl`.

## Prepare The Pi

On the Pi:

```bash
cd ~/shotclock-platform

sudo systemctl stop shotclock-kiosk || true
sudo systemctl stop shotclock-agent || true
```

If the Pi recently crashed during a build, do a light Git health check before extracting:

```bash
find .git/objects -type f -empty -print
find .git/objects -type f -empty -delete
git fetch --prune origin
git restore --source=HEAD -- .
git status --short
```

`git status --short` should print nothing before deployment. If it shows local edits, inspect them before continuing.

## Download Or Use The Tarball

If the tarball was uploaded to HTTPS:

```bash
curl -L --fail -o /tmp/shotclock-pi-build.tgz "PASTE_DOWNLOAD_URL_HERE"
```

If the tarball was copied with `scp`, it should already be at `/tmp/shotclock-pi-build.tgz`.

## Extract And Restart

For a full Pi build tarball:

```bash
tar -xzf /tmp/shotclock-pi-build.tgz -C ~/shotclock-platform
```

For a kiosk-only tarball, use the kiosk tarball name:

```bash
tar -xzf /tmp/shotclock-kiosk-build.tgz -C ~/shotclock-platform
```

Verify the expected files exist:

```bash
test -f apps/pi-agent/dist/index.js && echo "agent dist ok"
test -f apps/pi-kiosk/dist/index.html && echo "kiosk dist ok"
test -f packages/shared/dist/timer/index.js && echo "shared dist ok"
```

For kiosk-only hotfix tarballs, only the `kiosk dist ok` line is expected.

Point systemd at this checkout and restart services:

```bash
sudo ln -sfn "$PWD" /opt/shotclock/current

sudo systemctl start shotclock-agent
sleep 10
sudo systemctl start shotclock-kiosk

systemctl status shotclock-agent shotclock-kiosk --no-pager
vcgencmd get_throttled
```

`vcgencmd get_throttled` returning `throttled=0x0` means no undervoltage or throttling has been recorded since boot. Any other value means the Pi has seen power issues; keep using tarball deploys and avoid local builds on that power setup.

## Recovery Notes

If `git fetch` reports empty object files:

```bash
find .git/objects -type f -empty -print
find .git/objects -type f -empty -delete
git fetch --prune origin
```

If a source file is accidentally zero bytes after a crash:

```bash
git restore --source=HEAD -- PATH_TO_FILE
```

If the folder is not a Git repo yet:

```bash
git init
git remote add origin https://github.com/connerum/shotclock-platform.git
git fetch --depth=1 origin main
git checkout -f -B main origin/main
git branch --set-upstream-to=origin/main main
```

Only use the forced checkout when there are no local source edits to preserve.
