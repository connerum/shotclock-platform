import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveMediaRoot } from '../apps/server-web/lib/media-path';

test('production media resolves to durable shared storage', () => {
  assert.equal(resolveMediaRoot({ production: true }), '/opt/courtcast/shared/media');
  assert.equal(
    resolveMediaRoot({ production: true, configuredRoot: '/srv/courtcast-media' }),
    '/srv/courtcast-media',
  );
});

test('development media resolves from package or repository layouts', () => {
  const packageRoot = mkdtempSync(join(tmpdir(), 'courtcast-package-'));
  mkdirSync(join(packageRoot, 'public', 'media'), { recursive: true });
  assert.equal(resolveMediaRoot({ cwd: packageRoot }), join(packageRoot, 'public', 'media'));

  const repoRoot = mkdtempSync(join(tmpdir(), 'courtcast-repo-'));
  assert.equal(resolveMediaRoot({ cwd: repoRoot }), join(repoRoot, 'apps', 'server-web', 'public', 'media'));
});
