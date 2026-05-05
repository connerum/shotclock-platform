// POST /api/pair → create pairing record, return { success: true, pairingCode }
// Generate 6-digit code, store in Device.pairingCode

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const { deviceName, organizationId, venueId, controllerType, deviceId } = body;

    if (!deviceName) {
      return NextResponse.json(
        { error: 'Missing required field: deviceName' },
        { status: 400 }
      );
    }

    // Generate 6-digit pairing code
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    const pairingCodeExp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create or update device with pairing code
    const device = await prisma.device.upsert({
      where: { deviceId: deviceId || `temp-${Date.now()}` },
      update: {
        pairingCode,
        pairingCodeExp,
        status: 'unpaired',
        ownerUserId: auth.id,
      },
      create: {
        deviceId: deviceId || `temp-${Date.now()}`,
        name: deviceName,
        organizationId: organizationId || null,
        venueId: venueId || null,
        controllerType: controllerType || 'generic',
        pairingCode,
        pairingCodeExp,
        status: 'unpaired',
        ownerUserId: auth.id,
      },
    });

    return NextResponse.json({
      success: true,
      pairingCode,
      pairingCodeExp: pairingCodeExp.toISOString(),
      deviceId: device.deviceId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating pairing:', error);
    return NextResponse.json(
      { error: 'Failed to create pairing' },
      { status: 500 }
    );
  }
}
