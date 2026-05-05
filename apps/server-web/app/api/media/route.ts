// GET /api/media → list media assets
// POST /api/media → upload placeholder (store in /public/media/)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { requireApiUser } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const mediaAssets = await prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ mediaAssets });
  } catch (error) {
    console.error('Error fetching media:', error);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const organizationId = formData.get('organizationId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Ensure public/media directory exists
    const mediaDir = join(process.cwd(), 'public', 'media');
    await mkdir(mediaDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filepath = join(mediaDir, filename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Create media asset record
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        filename: file.name,
        url: `/media/${filename}`,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        organizationId: organizationId || 'default',
      },
    });

    return NextResponse.json({ mediaAsset }, { status: 201 });
  } catch (error) {
    console.error('Error uploading media:', error);
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    );
  }
}
