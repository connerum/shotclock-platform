import * as fs from 'fs';
import * as path from 'path';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function getRuntimeVersion(): string {
  // Atomic releases carry their own VERSION file. Prefer it over the shared
  // environment so a successful OTA reports its new version immediately.
  const releaseVersionPath = path.join(process.cwd(), 'VERSION');
  try {
    const releaseVersion = fs.readFileSync(releaseVersionPath, 'utf8').trim();
    if (SEMVER.test(releaseVersion)) return releaseVersion;
  } catch {
    // Development checkouts do not contain a VERSION file.
  }

  const configured = process.env.SHOTCLOCK_VERSION?.trim();
  if (configured && SEMVER.test(configured)) return configured;
  return '1.0.0';
}

export const RUNTIME_VERSION = getRuntimeVersion();
