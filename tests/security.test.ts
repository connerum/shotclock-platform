import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { hashDeviceToken, hashPassword, verifyDeviceToken, verifyPassword } from '../apps/server-web/lib/auth';
import { getBearerToken, tokenMatchesHash } from '../apps/server-web/lib/device-auth';
import { normalizeChecksum } from '../apps/pi-agent/src/update-manager';

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
});

test('the local update API reports updater failures', async () => {
  const localApi = await readFile(new URL('../apps/pi-agent/src/local-api.ts', import.meta.url), 'utf8');
  assert.match(localApi, /const result = await updateManager\.installUpdate\(version\)/);
  assert.match(localApi, /if \(!result\.success\)/);
});
