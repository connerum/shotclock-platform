// POST /api/devices/[deviceId]/command - Dispatch command to device

import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: { deviceId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = params;
    const body = await request.json();
    
    const { command, payload } = body;
    
    if (!command) {
      return NextResponse.json(
        { error: 'Missing required field: command' },
        { status: 400 }
      );
    }
    
    // In production, this would emit via Socket.IO to the device
    // For now, return success
    return NextResponse.json({
      success: true,
      deviceId,
      command,
      payload,
      dispatchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
