// GET /api/pair/[pairingCode] → check if pairing code is valid (not expired, not used)
// Returns { valid: boolean, deviceId?: string }
// Validate: device exists, pairingStatus != 'paired', code matches

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
import { canAccessDevice, isSuperUser, requireApiUser } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/request-security';
import { getRequestIp, writeAuditLog } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ pairingCode: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const limited = enforceRateLimit(_request, 'pairing-code-check', 60, 15 * 60 * 1000);
    if (limited) return limited;
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { pairingCode } = await params;
    if (!/^\d{6}$/.test(pairingCode)) return NextResponse.json({ valid: false, error: 'Invalid pairing code' });

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

    if (device.ownerUserId && !canAccessDevice(auth, device)) {
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

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const limited = enforceRateLimit(_request, 'pairing-code-confirm', 20, 15 * 60 * 1000);
    if (limited) return limited;
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { pairingCode } = await params;
    if (!/^\d{6}$/.test(pairingCode)) return NextResponse.json({ success: false, error: 'Invalid pairing code' }, { status: 400 });

    const device = await prisma.device.findFirst({
      where: {
        pairingCode,
        status: { not: 'paired' },
      },
    });

    if (!device) {
      return NextResponse.json({
        success: false,
        error: 'Invalid pairing code',
      }, { status: 404 });
    }

    if (device.ownerUserId && !canAccessDevice(auth, device)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid pairing code',
      }, { status: 404 });
    }

    if (device.pairingCodeExp && device.pairingCodeExp < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Pairing code has expired',
      }, { status: 410 });
    }

    const updateResult = await prisma.device.updateMany({
      where: {
        id: device.id,
        pairingCode,
        status: { not: 'paired' },
        ...(isSuperUser(auth) ? {} : { OR: [{ ownerUserId: null }, { ownerUserId: auth.id }] }),
      },
      data: {
        status: 'paired',
        mode: 'shot-clock',
        pairingCode: null,
        pairingCodeExp: null,
        ownerUserId: device.ownerUserId || auth.id,
      },
    });
    if (updateResult.count !== 1) {
      return NextResponse.json({ success: false, error: 'Pairing code was already used' }, { status: 409 });
    }
    const pairedDevice = await prisma.device.findUniqueOrThrow({ where: { deviceId: device.deviceId } });

    await writeAuditLog({
      actor: auth,
      action: 'device.paired',
      targetType: 'Device',
      targetId: pairedDevice.deviceId,
      ipAddress: getRequestIp(_request),
    });

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || 'http://localhost:3000';
    const payload = {
      success: true,
      deviceId: pairedDevice.deviceId,
      organizationId: pairedDevice.organizationId || undefined,
      venueId: pairedDevice.venueId || undefined,
      serverUrl,
    };

    const io = getServerIO();
    if (io) {
      io.of('/device').to(`device:${pairedDevice.deviceId}`).emit('pairing:complete', payload);
      io.of('/device').to(`device:${pairedDevice.deviceId}`).emit('mode:set', { type: 'shot-clock' });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error confirming pairing code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to confirm pairing' },
      { status: 500 }
    );
  }
}
