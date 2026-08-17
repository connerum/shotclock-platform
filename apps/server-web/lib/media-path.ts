import { existsSync } from 'fs';
import { join, resolve } from 'path';

const PRODUCTION_MEDIA_ROOT = '/opt/courtcast/shared/media';

export function resolveMediaRoot(options: {
  configuredRoot?: string;
  cwd?: string;
  production?: boolean;
} = {}): string {
  if (options.configuredRoot?.trim()) return resolve(options.configuredRoot.trim());
  if (options.production) return PRODUCTION_MEDIA_ROOT;

  const cwd = options.cwd || process.cwd();
  const packageMediaRoot = join(cwd, 'public', 'media');
  const repoMediaRoot = join(cwd, 'apps', 'server-web', 'public', 'media');

  if (existsSync(packageMediaRoot)) return packageMediaRoot;
  return repoMediaRoot;
}
