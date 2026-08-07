import assert from 'node:assert/strict';
import test from 'node:test';
import { enforceRateLimit, requireJson } from '../apps/server-web/lib/request-security';

test('rate limiter blocks requests after the configured threshold', () => {
  const request = new Request('https://example.test/login', { headers: { 'x-forwarded-for': '192.0.2.20' } });
  assert.equal(enforceRateLimit(request, 'test-scope', 2, 60_000), null);
  assert.equal(enforceRateLimit(request, 'test-scope', 2, 60_000), null);
  assert.equal(enforceRateLimit(request, 'test-scope', 2, 60_000)?.status, 429);
});

test('JSON mutation endpoints reject ambiguous content types', () => {
  assert.equal(requireJson(new Request('https://example.test', { headers: { 'Content-Type': 'application/json; charset=utf-8' } })), null);
  assert.equal(requireJson(new Request('https://example.test', { headers: { 'Content-Type': 'text/plain' } }))?.status, 415);
});
