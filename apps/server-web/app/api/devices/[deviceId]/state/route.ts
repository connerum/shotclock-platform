// GET /api/devices/[deviceId]/state → return latest DisplayState
// POST /api/devices/[deviceId]/state → create new DisplayState record, emit device:state:update to device socket

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
import { TimerState } from '@shotclock/shared/types';

interface RouteParams {
  params: { deviceId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = params;

    const state = await prisma.displayState.findUnique({
      where: { deviceId },
    });

    if (!state) {
      return NextResponse.json({ 
        state: {
          deviceId,
          mode: 'setup',
          timerState: null,
        }
      });
    }

    return NextResponse.json({
      state: {
        ...state,
        timerState: state.timerState ? JSON.parse(state.timerState) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching state:', error);
    return NextResponse.json({ error: 'Failed to fetch state' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = params;
    const body = await request.json();
    const { mode, timerState, mediaAssetId } = body;

    // Upsert the display state
    const state = await prisma.displayState.upsert({
      where: { deviceId },
      update: {
        mode,
        timerState: timerState ? JSON.stringify(timerState) : null,
        mediaAssetId: mediaAssetId || null,
      },
      create: {
        deviceId,
        mode,
        timerState: timerState ? JSON.stringify(timerState) : null,
        mediaAssetId: mediaAssetId || null,
      },
    });

    // Also update the device's cached state
    await prisma.device.update({
      where: { deviceId },
      data: {
        displayState: JSON.stringify({ mode, timerState, mediaAssetId }),
        mode,
      },
    });

    // Emit state update to device via Socket.IO
    const io = getServerIO();
    if (io) {
      const timerStatePayload: TimerState = timerState || {
        mode: 'stop',
        homeScore: 0,
        awayScore: 0,
        shotClock: 24,
        gameClock: 720,
        isRunning: false,
        isPaused: false,
        lastUpdated: Date.now(),
      };
      io.to(`device:${deviceId}`).emit('state:update', timerStatePayload);
    }

    return NextResponse.json({ 
      success: true,
      state: {
        ...state,
        timerState: state.timerState ? JSON.parse(state.timerState) : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error updating state:', error);
    return NextResponse.json({ error: 'Failed to update state' }, { status: 500 });
  }
}
