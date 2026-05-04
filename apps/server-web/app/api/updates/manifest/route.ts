// GET /api/updates/manifest - Get update manifest

import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    latestVersion: '0.1.0',
    minServerVersion: '0.1.0',
    releases: [
      {
        version: '0.1.0',
        releaseDate: '2024-01-01T00:00:00Z',
        downloadUrl: 'https://releases.shotclock.local/0.1.0',
        checksum: 'sha256:abc123def456',
        size: 52428800,
        notes: 'Initial release with core shot clock functionality',
        isMandatory: false,
        minServerVersion: '0.1.0',
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  
  return NextResponse.json({ manifest });
}
