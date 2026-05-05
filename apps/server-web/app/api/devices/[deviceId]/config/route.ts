// GET /api/devices/[deviceId]/config → return device.configJson as DisplayProfile
// PATCH /api/devices/[deviceId]/config → update configJson, emit device:config:update to device socket

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
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
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    if (!canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const config = {
      displayProfile: device.displayProfile ? JSON.parse(device.displayProfile) : null,
      calibrationData: device.calibrationData ? JSON.parse(device.calibrationData) : null,
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = params;
    const body = await request.json();

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const updateData: any = {};
    
    if (body.displayProfile !== undefined) {
      updateData.displayProfile = JSON.stringify(body.displayProfile);
    }
    if (body.calibrationData !== undefined) {
      updateData.calibrationData = JSON.stringify(body.calibrationData);
    }

    await prisma.device.update({
      where: { deviceId },
      data: updateData,
    });

    // Emit config update to device via Socket.IO
    const io = getServerIO();
    if (io) {
      io.of('/device').to(`device:${deviceId}`).emit('config:update', {
        displayProfile: body.displayProfile,
        calibrationData: body.calibrationData,
        brightness: body.brightness,
        orientation: body.orientation,
      });
    }

    return NextResponse.json({ 
      success: true,
      displayProfile: body.displayProfile,
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
