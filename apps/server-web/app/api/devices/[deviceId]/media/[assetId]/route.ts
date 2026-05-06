import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { canAccessDevice, requireApiUser } from '@/lib/auth';

interface RouteParams {
  params: { deviceId: string; assetId: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const mediaAsset = await getAccessibleMediaAsset(params.deviceId, params.assetId, auth);
    if (!mediaAsset) {
      return NextResponse.json({ error: 'Media asset not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const isActive = body?.isActive !== false;

    if (mediaAsset.slot !== 'ads' && isActive) {
      await prisma.deviceMediaAsset.updateMany({
        where: {
          deviceId: params.deviceId,
          slot: mediaAsset.slot,
          id: { not: mediaAsset.id },
        },
        data: { isActive: false },
      });
    }

    const updatedAsset = await prisma.deviceMediaAsset.update({
      where: { id: mediaAsset.id },
      data: { isActive },
    });

    return NextResponse.json({ mediaAsset: updatedAsset });
  } catch (error) {
    console.error('Error updating device media:', error);
    return NextResponse.json({ error: 'Failed to update media' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const mediaAsset = await getAccessibleMediaAsset(params.deviceId, params.assetId, auth);
    if (!mediaAsset) {
      return NextResponse.json({ error: 'Media asset not found' }, { status: 404 });
    }

    await prisma.deviceMediaAsset.delete({ where: { id: mediaAsset.id } });
    await unlink(join(getServerWebRoot(), 'public', 'media', 'devices', params.deviceId, mediaAsset.filename)).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting device media:', error);
    return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
  }
}

async function getAccessibleMediaAsset(deviceId: string, assetId: string, auth: Awaited<ReturnType<typeof requireApiUser>>) {
  if (auth instanceof Response) return null;

  const mediaAsset = await prisma.deviceMediaAsset.findFirst({
    where: { id: assetId, deviceId },
    include: {
      device: {
        select: { ownerUserId: true },
      },
    },
  });

  if (!mediaAsset || !canAccessDevice(auth, mediaAsset.device)) {
    return null;
  }

  return mediaAsset;
}

function getServerWebRoot() {
  return process.cwd().endsWith(join('apps', 'server-web'))
    ? process.cwd()
    : join(process.cwd(), 'apps', 'server-web');
}
