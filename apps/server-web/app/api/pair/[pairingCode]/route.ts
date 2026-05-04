// GET /api/pair/[pairingCode] - Validate pairing code

import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: { pairingCode: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { pairingCode } = params;
  
  // In production, validate against Prisma
  // For now, accept code "123456" as valid for demo
  if (pairingCode === '123456') {
    return NextResponse.json({
      valid: true,
      pairing: {
        pairingCode,
        deviceName: 'Shotclock Display 1',
        organizationId: 'org-1',
        venueId: 'venue-1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  }
  
  return NextResponse.json({
    valid: false,
    error: 'Invalid or expired pairing code',
  });
}
