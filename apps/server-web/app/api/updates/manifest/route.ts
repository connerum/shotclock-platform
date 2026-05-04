// GET /api/updates/manifest → return update manifest for all active channels
// Returns { updateAvailable: boolean, version, channel, packageUrl, checksum, notes }
// Based on latest active FirmwareRelease

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get all firmware releases ordered by release date
    const releases = await prisma.firmwareRelease.findMany({
      orderBy: { releaseDate: 'desc' },
    });

    if (releases.length === 0) {
      return NextResponse.json({
        updateAvailable: false,
        latestVersion: null,
        releases: [],
        minServerVersion: '0.1.0',
      });
    }

    const latestRelease = releases[0];

    return NextResponse.json({
      updateAvailable: true,
      latestVersion: latestRelease.version,
      releases: releases.map(r => ({
        version: r.version,
        releaseDate: r.releaseDate.toISOString(),
        downloadUrl: r.downloadUrl,
        checksum: r.checksum,
        size: r.size,
        notes: r.notes,
        isMandatory: r.isMandatory,
        minServerVersion: r.minServerVersion,
      })),
      minServerVersion: latestRelease.minServerVersion || '0.1.0',
    });
  } catch (error) {
    console.error('Error fetching manifest:', error);
    return NextResponse.json({ error: 'Failed to fetch manifest' }, { status: 500 });
  }
}
