import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, tokenMatchesHash } from '@/lib/device-auth';
import { hashDeviceToken } from '@/lib/auth';
import { enforceRateLimit, requireJson } from '@/lib/request-security';

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { deviceId } = await params;
    if (!/^shotclock-[a-zA-Z0-9_-]{4,64}$/.test(deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 });
    }
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: {
        deviceId: true,
        status: true,
        mode: true,
        pairingCode: true,
        organizationId: true,
        venueId: true,
        authTokenHash: true,
      },
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }
    if (!tokenMatchesHash(getBearerToken(request), device.authTokenHash)) {
      return NextResponse.json({ error: 'Device authentication required' }, { status: 401 });
    }

    return NextResponse.json({
      device: {
        deviceId: device.deviceId,
        status: device.status,
        mode: device.mode,
        isPaired: device.status === 'paired',
        organizationId: device.organizationId,
        venueId: device.venueId,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching public pairing status:', error);
    return NextResponse.json({ error: 'Failed to fetch pairing status' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { deviceId } = await params;
    const limited = enforceRateLimit(request, 'device-pairing-registration', 30, 15 * 60 * 1000);
    if (limited) return limited;
    const invalidContentType = requireJson(request);
    if (invalidContentType) return invalidContentType;
    if (!/^shotclock-[a-zA-Z0-9_-]{4,64}$/.test(deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 });
    }
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Device authentication required' }, { status: 401 });
    const body = await request.json();
    const pairingCode = typeof body.pairingCode === 'string' ? body.pairingCode.trim() : '';

    if (!/^\d{6}$/.test(pairingCode)) {
      return NextResponse.json({ error: 'Invalid pairing code' }, { status: 400 });
    }

    const existingDevice = await prisma.device.findUnique({
      where: { deviceId },
      select: {
        deviceId: true,
        ownerUserId: true,
        status: true,
        authTokenHash: true,
      },
    });

    if (existingDevice?.status === 'paired' && existingDevice.ownerUserId) {
      return NextResponse.json({ error: 'Device is already paired' }, { status: 409 });
    }
    if (existingDevice?.authTokenHash && !tokenMatchesHash(token, existingDevice.authTokenHash)) {
      return NextResponse.json({ error: 'Device authentication failed' }, { status: 401 });
    }

    const expiresAt = Number(body.pairingCodeExpiresAt);
    const pairingCodeExp = Number.isFinite(expiresAt)
      ? new Date(expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const displayProfile = body.displayProfile
      ? JSON.stringify(body.displayProfile)
      : undefined;

    await prisma.device.upsert({
      where: { deviceId },
      update: {
        name: body.deviceName || `Shotclock ${deviceId}`,
        firmwareVersion: body.firmwareVersion || null,
        controllerType: body.controllerType || 'generic',
        capabilities: JSON.stringify(body.capabilities || []),
        ...(displayProfile ? { displayProfile } : {}),
        pairingCode,
        pairingCodeExp,
        ownerUserId: null,
        status: 'unpaired',
        mode: 'pairing',
        isOnline: true,
        lastSeen: new Date(),
        authTokenHash: existingDevice?.authTokenHash || hashDeviceToken(token),
      },
      create: {
        deviceId,
        name: body.deviceName || `Shotclock ${deviceId}`,
        firmwareVersion: body.firmwareVersion || null,
        controllerType: body.controllerType || 'generic',
        capabilities: JSON.stringify(body.capabilities || []),
        ...(displayProfile ? { displayProfile } : {}),
        pairingCode,
        pairingCodeExp,
        status: 'unpaired',
        mode: 'pairing',
        isOnline: true,
        lastSeen: new Date(),
        authTokenHash: hashDeviceToken(token),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error registering public pairing code:', error);
    return NextResponse.json({ error: 'Failed to register pairing code' }, { status: 500 });
  }
}
