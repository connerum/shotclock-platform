// GET /api/updates/releases → list all releases
// POST /api/updates/releases → create release { version, channel, packageUrl, checksum, notes, isActive }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiUser } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const releases = await prisma.firmwareRelease.findMany({
      orderBy: { releaseDate: 'desc' },
    });

    return NextResponse.json({ releases });
  } catch (error) {
    console.error('Error fetching releases:', error);
    return NextResponse.json({ error: 'Failed to fetch releases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const { version, downloadUrl, checksum, size, notes, isMandatory, minServerVersion } = body;

    if (!version || !downloadUrl || !checksum || !size) {
      return NextResponse.json(
        { error: 'Missing required fields: version, downloadUrl, checksum, size' },
        { status: 400 }
      );
    }

    const release = await prisma.firmwareRelease.create({
      data: {
        version,
        downloadUrl,
        checksum,
        size: parseInt(size, 10),
        notes: notes || '',
        isMandatory: isMandatory || false,
        minServerVersion: minServerVersion || null,
      },
    });

    return NextResponse.json({ release }, { status: 201 });
  } catch (error) {
    console.error('Error creating release:', error);
    return NextResponse.json(
      { error: 'Failed to create release' },
      { status: 500 }
    );
  }
}
