// GET /api/devices/[deviceId] → device with config/state
// PATCH /api/devices/[deviceId] → update name, venueId, organizationId, controllerType, softwareVersion

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessDevice, requireApiUser } from '@/lib/auth';

interface RouteParams {
  params: { deviceId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = params;

    const device = await prisma.device.findUnique({
      where: { deviceId },
      include: {
        organization: true,
        venue: true,
        state: true,
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    if (!canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const parsedDevice = {
      ...device,
      displayProfile: withDefaultColorCorrection(device.displayProfile ? JSON.parse(device.displayProfile) : null),
      displayState: device.displayState ? JSON.parse(device.displayState) : null,
      calibrationData: device.calibrationData ? JSON.parse(device.calibrationData) : null,
      capabilities: JSON.parse(device.capabilities || '[]'),
      timerState: device.state?.timerState ? JSON.parse(device.state.timerState) : null,
    };

    return NextResponse.json({ device: parsedDevice });
  } catch (error) {
    console.error('Error fetching device:', error);
    return NextResponse.json({ error: 'Failed to fetch device' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = params;
    const body = await request.json();

    const updateData: any = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.venueId !== undefined) updateData.venueId = body.venueId;
    if (body.organizationId !== undefined) updateData.organizationId = body.organizationId;
    if (body.controllerType !== undefined) updateData.controllerType = body.controllerType;
    if (body.firmwareVersion !== undefined) updateData.firmwareVersion = body.firmwareVersion;
    if (body.mode !== undefined) updateData.mode = body.mode;
    if (body.status !== undefined) updateData.status = body.status;

    const existingDevice = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true },
    });

    if (!existingDevice || !canAccessDevice(auth, existingDevice)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const device = await prisma.device.update({
      where: { deviceId },
      data: updateData,
      include: {
        organization: true,
        venue: true,
      },
    });

    return NextResponse.json({ device });
  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
  }
}

function withDefaultColorCorrection<T extends Record<string, any> | null>(displayProfile: T): T {
  if (!displayProfile) return displayProfile;

  return {
    ...displayProfile,
    colorCorrection: {
      rgbToBgr: displayProfile.colorCorrection?.rgbToBgr ?? true,
    },
  } as T;
}
