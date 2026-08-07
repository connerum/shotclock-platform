// GET /api/media → list media assets
// POST /api/media → upload placeholder (store in /public/media/)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperUser, requireApiUser } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    if (!isSuperUser(auth)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });

    const mediaAssets = await prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ mediaAssets });
  } catch (error) {
    console.error('Error fetching media:', error);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  return NextResponse.json({ error: 'Use the device-scoped media upload endpoint' }, { status: 410 });
}
