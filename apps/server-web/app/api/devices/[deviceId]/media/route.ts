import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { canAccessDevice, requireApiUser } from '@/lib/auth';

const MEDIA_SLOTS = ['ads', 'logo', 'sponsor', 'team-intro', 'music', 'scoreboard-home-logo', 'scoreboard-away-logo', 'practice-school-logo'] as const;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac'];
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

type MediaSlot = typeof MEDIA_SLOTS[number];

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = await params;
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, ownerUserId: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: `Device not found: ${deviceId}` }, { status: 404 });
    }

    const mediaAssets = await prisma.deviceMediaAsset.findMany({
      where: { deviceId },
      orderBy: [{ slot: 'asc' }, { isActive: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ mediaAssets });
  } catch (error) {
    console.error('Error fetching device media:', error);
    return NextResponse.json({ error: getMediaStorageErrorMessage(error, 'fetch') }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  let filepath: string | null = null;

  try {
    const { deviceId } = await params;
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, ownerUserId: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: `Device not found: ${deviceId}` }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawSlot = formData.get('slot');
    const slot = typeof rawSlot === 'string' ? rawSlot : '';

    if (!isMediaSlot(slot)) {
      return NextResponse.json({ error: 'Invalid media slot' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File must be 100MB or smaller' }, { status: 400 });
    }

    if (!isAllowedMimeType(slot, file.type)) {
      return NextResponse.json({ error: `Unsupported file type for ${slot}` }, { status: 400 });
    }

    const originalFilename = sanitizeFilename(file.name || 'media');
    const extension = getSafeExtension(file.type);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const mediaDir = join(getServerWebRoot(), 'public', 'media', 'devices', deviceId);
    filepath = join(mediaDir, filename);

    await mkdir(mediaDir, { recursive: true });
    await writeFile(filepath, Buffer.from(await file.arrayBuffer()));

    if (slot !== 'ads') {
      await prisma.deviceMediaAsset.updateMany({
        where: { deviceId, slot },
        data: { isActive: false },
      });
    }

    const sortOrder = await getNextSortOrder(deviceId, slot);

    const mediaAsset = await prisma.deviceMediaAsset.create({
      data: {
        deviceId,
        slot,
        filename,
        originalFilename,
        url: `/media/devices/${deviceId}/${filename}`,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        isActive: true,
        sortOrder,
      },
    });

    return NextResponse.json({ mediaAsset }, { status: 201 });
  } catch (error) {
    console.error('Error uploading device media:', error);
    if (filepath) {
      await unlink(filepath).catch(() => {});
    }

    return NextResponse.json({ error: getMediaStorageErrorMessage(error, 'upload') }, { status: 500 });
  }
}

function isMediaSlot(slot: string): slot is MediaSlot {
  return MEDIA_SLOTS.includes(slot as MediaSlot);
}

function isAllowedMimeType(slot: MediaSlot, mimeType: string) {
  if (slot === 'scoreboard-home-logo' || slot === 'scoreboard-away-logo' || slot === 'practice-school-logo') {
    return IMAGE_MIME_TYPES.includes(mimeType);
  }
  if (slot === 'music') return AUDIO_MIME_TYPES.includes(mimeType);
  if (slot === 'team-intro') return [...VIDEO_MIME_TYPES, ...AUDIO_MIME_TYPES].includes(mimeType);
  return [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].includes(mimeType);
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function getSafeExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType.startsWith('video/')) return '.mp4';
  if (mimeType.startsWith('audio/')) return '.mp3';
  throw new Error(`No safe extension is configured for MIME type ${mimeType}`);
}

function getServerWebRoot() {
  const cwd = process.cwd();
  const nestedServerWebRoot = join(cwd, 'apps', 'server-web');

  if (cwd.endsWith(join('apps', 'server-web')) || existsSync(join(cwd, 'public'))) {
    return cwd;
  }

  if (existsSync(nestedServerWebRoot)) {
    return nestedServerWebRoot;
  }

  return cwd;
}

async function getNextSortOrder(deviceId: string, slot: MediaSlot) {
  const aggregate = await prisma.deviceMediaAsset.aggregate({
    where: { deviceId, slot },
    _max: { sortOrder: true },
  });

  return (aggregate._max.sortOrder ?? -1) + 1;
}

function getMediaStorageErrorMessage(error: unknown, action: 'fetch' | 'upload') {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  if (message.includes('does not exist in the current database') || message.includes('no such table') || message.includes('P2021')) {
    return 'Media database table is missing. Run Prisma generate and migrate deploy on the server, then rebuild and restart CourtCast.';
  }

  if (message.includes('does not fit in an INT column') || message.includes('P2023')) {
    return 'Media sort order data is invalid. Pull the latest code, run Prisma migrate deploy, rebuild, and restart CourtCast.';
  }

  if (message.includes('EACCES') || message.includes('EPERM')) {
    return 'Server cannot write to the media upload directory. Check ownership and permissions for apps/server-web/public/media.';
  }

  if (message.includes('ENOENT')) {
    return 'Media upload directory is missing. Create apps/server-web/public/media/devices and restart CourtCast.';
  }

  return action === 'fetch' ? 'Failed to fetch media' : 'Failed to upload media';
}
