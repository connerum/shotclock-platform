import { NextRequest, NextResponse } from 'next/server';
import {
  THREE_PANEL_SPORTS_ADS_CAPABILITY,
  type SportDisplayLayout,
} from '@shotclock/shared/types';
import { prisma } from '@/lib/prisma';
import { canAccessDevice, requireApiUser } from '@/lib/auth';
import { getRequestIp, writeAuditLog } from '@/lib/audit';
import {
  deviceSupportsCapability,
  normalizeSportDisplayLayout,
  persistSportDisplayLayoutPreference,
} from '@/lib/device-command';
import { enforceRateLimit, requireJson } from '@/lib/request-security';

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const limited = enforceRateLimit(request, 'sport-display-layout-preference', 60, 60 * 1000);
    if (limited) return limited;
    const invalidContentType = requireJson(request);
    if (invalidContentType) return invalidContentType;
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = await params;
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, ownerUserId: true, capabilities: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: `Device not found: ${deviceId}` }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !Object.prototype.hasOwnProperty.call(body, 'sportDisplayLayout')) {
      return NextResponse.json({ error: 'sportDisplayLayout is required' }, { status: 400 });
    }

    let sportDisplayLayout: SportDisplayLayout | null = null;
    if (body.sportDisplayLayout !== null) {
      sportDisplayLayout = normalizeSportDisplayLayout(body.sportDisplayLayout);
      if (!sportDisplayLayout) {
        return NextResponse.json({ error: 'Invalid sport display layout' }, { status: 400 });
      }
      if (!deviceSupportsCapability(device.capabilities, THREE_PANEL_SPORTS_ADS_CAPABILITY)) {
        return NextResponse.json(
          { error: 'Display software update required for 3-section layouts' },
          { status: 409 }
        );
      }
    }

    await persistSportDisplayLayoutPreference(deviceId, sportDisplayLayout);
    await writeAuditLog({
      actor: auth,
      action: 'device.sport_display_layout_preference_updated',
      targetType: 'Device',
      targetId: deviceId,
      details: { enabled: Boolean(sportDisplayLayout) },
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ sportDisplayLayoutPreference: sportDisplayLayout });
  } catch (error) {
    console.error('Error updating sport display layout preference:', error);
    return NextResponse.json({ error: 'Failed to update sport display layout preference' }, { status: 500 });
  }
}
