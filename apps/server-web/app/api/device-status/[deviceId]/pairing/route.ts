import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { deviceId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const device = await prisma.device.findUnique({
      where: { deviceId: params.deviceId },
      select: {
        deviceId: true,
        status: true,
        mode: true,
        pairingCode: true,
        organizationId: true,
        venueId: true,
      },
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
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
    });
  } catch (error) {
    console.error('Error fetching public pairing status:', error);
    return NextResponse.json({ error: 'Failed to fetch pairing status' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const pairingCode = typeof body.pairingCode === 'string' ? body.pairingCode.trim() : '';

    if (!/^\d{6}$/.test(pairingCode)) {
      return NextResponse.json({ error: 'Invalid pairing code' }, { status: 400 });
    }

    const existingDevice = await prisma.device.findUnique({
      where: { deviceId: params.deviceId },
      select: {
        deviceId: true,
        ownerUserId: true,
        status: true,
      },
    });

    if (existingDevice?.status === 'paired' && existingDevice.ownerUserId) {
      return NextResponse.json({ error: 'Device is already paired' }, { status: 409 });
    }

    const expiresAt = Number(body.pairingCodeExpiresAt);
    const pairingCodeExp = Number.isFinite(expiresAt)
      ? new Date(expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const displayProfile = body.displayProfile
      ? JSON.stringify(body.displayProfile)
      : undefined;

    await prisma.device.upsert({
      where: { deviceId: params.deviceId },
      update: {
        name: body.deviceName || `Shotclock ${params.deviceId}`,
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
      },
      create: {
        deviceId: params.deviceId,
        name: body.deviceName || `Shotclock ${params.deviceId}`,
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
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error registering public pairing code:', error);
    return NextResponse.json({ error: 'Failed to register pairing code' }, { status: 500 });
  }
}
