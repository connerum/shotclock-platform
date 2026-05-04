// GET /api/devices → list all devices with org/venue
// POST /api/devices → register new device (generates pairingCode, sets status=unpaired)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const devices = await prisma.device.findMany({
      include: {
        organization: true,
        venue: true,
        state: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Parse JSON fields
    const parsedDevices = devices.map(device => ({
      ...device,
      displayProfile: device.displayProfile ? JSON.parse(device.displayProfile) : null,
      displayState: device.displayState ? JSON.parse(device.displayState) : null,
      calibrationData: device.calibrationData ? JSON.parse(device.calibrationData) : null,
      capabilities: JSON.parse(device.capabilities || '[]'),
    }));

    return NextResponse.json({ devices: parsedDevices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, name, organizationId, venueId, controllerType } = body;

    if (!deviceId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: deviceId, name' },
        { status: 400 }
      );
    }

    // Generate 6-digit pairing code
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    const pairingCodeExp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const device = await prisma.device.create({
      data: {
        deviceId,
        name,
        organizationId: organizationId || null,
        venueId: venueId || null,
        controllerType: controllerType || 'generic',
        pairingCode,
        pairingCodeExp,
        status: 'unpaired',
      },
      include: {
        organization: true,
        venue: true,
      },
    });

    return NextResponse.json({
      device,
      pairingCode,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating device:', error);
    return NextResponse.json(
      { error: 'Failed to create device' },
      { status: 500 }
    );
  }
}
