// GET /api/pair/[pairingCode] → check if pairing code is valid (not expired, not used)
// Returns { valid: boolean, deviceId?: string }
// Validate: device exists, pairingStatus != 'paired', code matches

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { pairingCode: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { pairingCode } = params;

    // Find device with this pairing code
    const device = await prisma.device.findFirst({
      where: {
        pairingCode,
        status: { not: 'paired' },
      },
    });

    if (!device) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired pairing code',
      });
    }

    // Check if code has expired
    if (device.pairingCodeExp && device.pairingCodeExp < new Date()) {
      return NextResponse.json({
        valid: false,
        error: 'Pairing code has expired',
      });
    }

    return NextResponse.json({
      valid: true,
      deviceId: device.deviceId,
      deviceName: device.name,
      expiresAt: device.pairingCodeExp?.toISOString(),
    });
  } catch (error) {
    console.error('Error validating pairing code:', error);
    return NextResponse.json(
      { error: 'Failed to validate pairing code' },
      { status: 500 }
    );
  }
}
