// POST /api/pair - Initiate device pairing

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { deviceName, organizationId, venueId, controllerType } = body;
    
    if (!deviceName) {
      return NextResponse.json(
        { error: 'Missing required field: deviceName' },
        { status: 400 }
      );
    }
    
    // Generate pairing code
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In production, this would create in Prisma
    const pairingRequest = {
      id: Math.random().toString(36).substring(7),
      deviceName,
      pairingCode,
      pairingCodeExp: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      organizationId,
      venueId,
      controllerType: controllerType || 'generic',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    return NextResponse.json({ pairing: pairingRequest }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
