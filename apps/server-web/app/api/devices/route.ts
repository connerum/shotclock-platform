// GET /api/devices - List all devices
// POST /api/devices - Register a new device

import { NextRequest, NextResponse } from 'next/server';

// In production, this would use Prisma
const devices = [
  {
    id: '1',
    name: 'Shotclock Display 1',
    status: 'online',
    mode: 'shot-clock',
    lastSeen: new Date().toISOString(),
  },
];

export async function GET() {
  return NextResponse.json({ devices });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.deviceId || !body.name) {
      return NextResponse.json(
        { error: 'Missing required fields: deviceId, name' },
        { status: 400 }
      );
    }
    
    // In production, this would create in Prisma
    const newDevice = {
      id: Math.random().toString(36).substring(7),
      ...body,
      status: 'offline',
      lastSeen: new Date().toISOString(),
    };
    
    return NextResponse.json({ device: newDevice }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
