import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const caddyfile = readFileSync(new URL('../ops/server/Caddyfile.courtcast', import.meta.url), 'utf8');

test('the edge proxy overwrites spoofable client IP headers', () => {
  assert.match(caddyfile, /header_up X-Real-IP \{remote_host\}/);
  assert.match(caddyfile, /header_up X-Forwarded-For \{remote_host\}/);
  assert.doesNotMatch(caddyfile, /proxy_add_x_forwarded_for/);
});
