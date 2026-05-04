// GET /api/updates/releases - List all releases
// POST /api/updates/releases - Create new release

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const releases = [
    {
      id: '1',
      version: '0.1.0',
      releaseDate: '2024-01-01T00:00:00Z',
      downloadUrl: 'https://releases.shotclock.local/0.1.0',
      checksum: 'sha256:abc123def456',
      size: 52428800,
      notes: 'Initial release',
      isMandatory: false,
      minServerVersion: '0.1.0',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];
  
  return NextResponse.json({ releases });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { version, downloadUrl, checksum, size, notes, isMandatory } = body;
    
    if (!version || !downloadUrl || !checksum || !size) {
      return NextResponse.json(
        { error: 'Missing required fields: version, downloadUrl, checksum, size' },
        { status: 400 }
      );
    }
    
    const newRelease = {
      id: Math.random().toString(36).substring(7),
      version,
      releaseDate: new Date().toISOString(),
      downloadUrl,
      checksum,
      size,
      notes: notes || '',
      isMandatory: isMandatory || false,
      minServerVersion: body.minServerVersion || '0.1.0',
      createdAt: new Date().toISOString(),
    };
    
    return NextResponse.json({ release: newRelease }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
