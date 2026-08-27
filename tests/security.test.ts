import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { hashDeviceToken, hashPassword, verifyDeviceToken, verifyPassword } from '../apps/server-web/lib/auth';
import { getBearerToken, tokenMatchesHash } from '../apps/server-web/lib/device-auth';
import { normalizeChecksum } from '../apps/pi-agent/src/update-manager';

const execFileAsync = promisify(execFile);

test('password hashes are salted and verifiable', async () => {
  const first = await hashPassword('a-long-production-password');
  const second = await hashPassword('a-long-production-password');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('a-long-production-password', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
});

test('device bearer tokens are exact and hashed at rest', () => {
  const token = 'a'.repeat(64);
  const hash = hashDeviceToken(token);
  assert.equal(verifyDeviceToken(token, hash), true);
  assert.equal(tokenMatchesHash(token, hash), true);
  assert.equal(tokenMatchesHash(`${token}x`, hash), false);
  assert.equal(getBearerToken(new Request('https://example.test', { headers: { Authorization: `Bearer ${token}` } })), token);
});

test('release checksums accept only canonical SHA-256', () => {
  const digest = 'b'.repeat(64);
  assert.equal(normalizeChecksum(`sha256:${digest}`), digest);
  assert.throws(() => normalizeChecksum('../not-a-checksum'));
});

test('Pi management does not use shell interpolation and stays loopback-only', async () => {
  const wifi = await readFile(new URL('../apps/pi-agent/src/wifi-manager.ts', import.meta.url), 'utf8');
  const localApi = await readFile(new URL('../apps/pi-agent/src/config-store.ts', import.meta.url), 'utf8');
  const kiosk = await readFile(new URL('../scripts/launch-kiosk.sh', import.meta.url), 'utf8');
  assert.doesNotMatch(wifi, /\bexec\s*\(/);
  assert.match(localApi, /localApiHost: process\.env\.AGENT_LOCAL_API_HOST \|\| '127\.0\.0\.1'/);
  assert.doesNotMatch(kiosk, /--no-sandbox/);
  assert.match(kiosk, /until runuser[^]*xset q/);
  assert.match(kiosk, /unclutter -idle 0\.1 -root/);
});

test('the local update API reports updater failures', async () => {
  const localApi = await readFile(new URL('../apps/pi-agent/src/local-api.ts', import.meta.url), 'utf8');
  assert.match(localApi, /const result = await updateManager\.installUpdate\(version\)/);
  assert.match(localApi, /if \(!result\.success\)/);
});

test('Pi maintenance passwords are short, secure, and migrated without changing custom values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shotclock-secrets-'));
  const envFile = join(directory, '.env');
  const script = new URL('../scripts/manage-device-secrets.sh', import.meta.url);

  await writeFile(envFile, 'SETUP_AP_PASSWORD=replace-with-unique-maintenance-password\nDEVICE_AUTH_TOKEN=replace-with-device-token\n');
  await execFileAsync('bash', [script.pathname, '--env-file', envFile]);

  const generated = await readFile(envFile, 'utf8');
  const generatedApPassword = generated.match(/^SETUP_AP_PASSWORD=(.+)$/m)?.[1];
  const generatedDeviceToken = generated.match(/^DEVICE_AUTH_TOKEN=(.+)$/m)?.[1];
  assert.match(generatedApPassword || '', /^[0-9a-f]{12}$/);
  assert.match(generatedDeviceToken || '', /^[0-9a-f]{64}$/);

  await execFileAsync('bash', [script.pathname, '--env-file', envFile, '--migrate-legacy-ap-password']);
  assert.equal(await readFile(envFile, 'utf8'), generated);

  await writeFile(envFile, `SETUP_AP_PASSWORD=${'a'.repeat(32)}\nDEVICE_AUTH_TOKEN=${generatedDeviceToken}\n`);
  await execFileAsync('bash', [script.pathname, '--env-file', envFile, '--migrate-legacy-ap-password']);
  const migrated = await readFile(envFile, 'utf8');
  assert.match(migrated.match(/^SETUP_AP_PASSWORD=(.+)$/m)?.[1] || '', /^[0-9a-f]{12}$/);
  assert.match(migrated, new RegExp(`^DEVICE_AUTH_TOKEN=${generatedDeviceToken}$`, 'm'));

  await writeFile(envFile, `SETUP_AP_PASSWORD=custom-field-password\nDEVICE_AUTH_TOKEN=${generatedDeviceToken}\n`);
  await execFileAsync('bash', [script.pathname, '--env-file', envFile, '--migrate-legacy-ap-password']);
  assert.match(await readFile(envFile, 'utf8'), /^SETUP_AP_PASSWORD=custom-field-password$/m);
});

test('the Pi agent migrates legacy maintenance credentials before startup', async () => {
  const service = await readFile(new URL('../systemd/shotclock-agent.service', import.meta.url), 'utf8');
  assert.match(
    service,
    /ExecStartPre=\/bin\/bash \/opt\/shotclock\/current\/scripts\/manage-device-secrets\.sh --env-file \/opt\/shotclock\/shared\/\.env --migrate-legacy-ap-password/
  );
});
