// GET /api/updates/releases → list all releases
// POST /api/updates/releases → create release { version, channel, packageUrl, checksum, notes, isActive }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperUser, requireApiUser } from '@/lib/auth';
import { getRequestIp, writeAuditLog } from '@/lib/audit';
import { enforceRateLimit, requireJson } from '@/lib/request-security';

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    if (!isSuperUser(auth)) {
      return NextResponse.json({ error: 'Super user access required' }, { status: 403 });
    }
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
    if (!isSuperUser(auth)) {
      return NextResponse.json({ error: 'Super user access required' }, { status: 403 });
    }
    const limited = enforceRateLimit(request, 'create-release', 20, 60 * 60 * 1000);
    if (limited) return limited;
    const invalidContentType = requireJson(request);
    if (invalidContentType) return invalidContentType;

    const body = await request.json();
    const { version, downloadUrl, checksum, size, notes, isMandatory, minServerVersion } = body;

    if (!version || !downloadUrl || !checksum || !size) {
      return NextResponse.json(
        { error: 'Missing required fields: version, downloadUrl, checksum, size' },
        { status: 400 }
      );
    }
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version))) {
      return NextResponse.json({ error: 'Version must use semantic versioning (for example, 1.2.3)' }, { status: 400 });
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(String(downloadUrl), process.env.SERVER_URL);
    } catch {
      return NextResponse.json({ error: 'Download URL is invalid' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Download URL must use HTTPS' }, { status: 400 });
    }
    const normalizedChecksum = String(checksum).toLowerCase().replace(/^sha256:/, '').trim();
    if (!/^[a-f0-9]{64}$/.test(normalizedChecksum)) {
      return NextResponse.json({ error: 'Checksum must be a SHA-256 digest' }, { status: 400 });
    }
    const parsedSize = Number(size);
    if (!Number.isSafeInteger(parsedSize) || parsedSize <= 0 || parsedSize > 2_000_000_000) {
      return NextResponse.json({ error: 'Size must be a positive integer no larger than 2 GB' }, { status: 400 });
    }

    const release = await prisma.firmwareRelease.create({
      data: {
        version,
        downloadUrl: parsedUrl.toString(),
        checksum: `sha256:${normalizedChecksum}`,
        size: parsedSize,
        notes: notes || '',
        isMandatory: isMandatory || false,
        minServerVersion: minServerVersion || null,
      },
    });

    await writeAuditLog({
      actor: auth,
      action: 'release.created',
      targetType: 'FirmwareRelease',
      targetId: release.id,
      details: { version: release.version, size: release.size, isMandatory: release.isMandatory },
      ipAddress: getRequestIp(request),
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
