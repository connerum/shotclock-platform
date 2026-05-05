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
        isPaired: device.status === 'paired' || (!device.pairingCode && device.mode !== 'setup'),
        organizationId: device.organizationId,
        venueId: device.venueId,
      },
    });
  } catch (error) {
    console.error('Error fetching public pairing status:', error);
    return NextResponse.json({ error: 'Failed to fetch pairing status' }, { status: 500 });
  }
}
