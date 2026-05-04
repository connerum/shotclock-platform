// GET /api/devices/[deviceId]/state - Get display state
// POST /api/devices/[deviceId]/state - Update display state

import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: { deviceId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { deviceId } = params;
  
  const state = {
    deviceId,
    mode: { type: 'shot-clock' },
    timerState: {
      mode: 'stop',
      homeScore: 0,
      awayScore: 0,
      period: 1,
      shotClock: 24,
      gameClock: 720,
      isRunning: false,
      isPaused: false,
      lastUpdated: Date.now(),
    },
    updatedAt: new Date().toISOString(),
  };
  
  return NextResponse.json({ state });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = params;
    const body = await request.json();
    
    const updatedState = {
      deviceId,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    return NextResponse.json({ state: updatedState });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
