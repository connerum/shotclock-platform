// GET /api/devices/[deviceId] - Get device details
// PATCH /api/devices/[deviceId] - Update device

import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: { deviceId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { deviceId } = params;
  
  // In production, fetch from Prisma
  const device = {
    id: deviceId,
    name: 'Shotclock Display 1',
    deviceId,
    status: 'online',
    mode: 'shot-clock',
    firmwareVersion: '0.1.0',
    controllerType: 'generic',
    displayProfile: {
      id: 'default-generic',
      name: 'Default Generic Display',
      controllerType: 'generic',
      viewport: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0, scaleX: 1, scaleY: 1 },
      safeZone: { top: 40, right: 40, bottom: 40, left: 40 },
      fontSize: { shotClock: 200, gameClock: 120, score: 150, period: 80, label: 40 },
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        accent: '#00ff00',
        homeTeam: '#ff0000',
        awayTeam: '#0000ff',
        warning: '#ffff00',
        danger: '#ff0000',
      },
    },
    lastSeen: new Date().toISOString(),
  };
  
  return NextResponse.json({ device });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = params;
    const body = await request.json();
    
    // In production, update in Prisma
    const updatedDevice = {
      id: deviceId,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    return NextResponse.json({ device: updatedDevice });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
