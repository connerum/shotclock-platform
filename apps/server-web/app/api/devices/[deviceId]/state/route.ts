// GET /api/devices/[deviceId]/state → return latest DisplayState
// POST /api/devices/[deviceId]/state → create new DisplayState record, emit device:state:update to device socket

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
import { TimerState } from '@shotclock/shared/types';
import { canAccessDevice, requireApiUser } from '@/lib/auth';

interface RouteParams {
  params: { deviceId: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function createDefaultTimerState(now = Date.now()): TimerState {
  return {
    mode: 'stop',
    homeScore: 0,
    awayScore: 0,
    period: 1,
    shotClock: 24,
    gameClock: 720,
    isRunning: false,
    isPaused: false,
    lastUpdated: now,
  };
}

function rebaseTimerStateToLocalClock(state: TimerState, now = Date.now()): TimerState {
  return {
    ...state,
    lastUpdated: now,
  };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = params;

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const deviceWithState = await prisma.device.findUnique({
      where: { deviceId },
      select: {
        displayState: true,
        state: true,
      },
    });
    const state = deviceWithState?.state;
    const cachedDisplayState = deviceWithState?.displayState
      ? JSON.parse(deviceWithState.displayState)
      : null;

    if (!state && !cachedDisplayState) {
      return NextResponse.json(
        {
          state: {
            deviceId,
            mode: 'setup',
            timerState: null,
          },
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const timerState = getNewestTimerState(
      state?.timerState ? JSON.parse(state.timerState) : null,
      cachedDisplayState?.timerState
    );

    return NextResponse.json(
      {
        state: state
          ? {
              ...state,
              timerState,
            }
          : {
              deviceId,
              mode: cachedDisplayState.mode || 'setup',
              timerState,
              mediaAssetId: cachedDisplayState.mediaAssetId || null,
            },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Error fetching state:', error);
    return NextResponse.json({ error: 'Failed to fetch state' }, { status: 500 });
  }
}

function getNewestTimerState<T extends { lastUpdated?: number } | null | undefined>(first: T, second: T): T | null {
  if (!first) return second || null;
  if (!second) return first;

  const firstUpdated = typeof first.lastUpdated === 'number' ? first.lastUpdated : 0;
  const secondUpdated = typeof second.lastUpdated === 'number' ? second.lastUpdated : 0;
  return secondUpdated > firstUpdated ? second : first;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = params;
    const body = await request.json();
    const { mode, timerState, mediaAssetId } = body;
    const timerStatePayload: TimerState | null = timerState
      ? rebaseTimerStateToLocalClock(timerState)
      : null;

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Upsert the display state
    const state = await prisma.displayState.upsert({
      where: { deviceId },
      update: {
        mode,
        timerState: timerStatePayload ? JSON.stringify(timerStatePayload) : null,
        mediaAssetId: mediaAssetId || null,
      },
      create: {
        deviceId,
        mode,
        timerState: timerStatePayload ? JSON.stringify(timerStatePayload) : null,
        mediaAssetId: mediaAssetId || null,
      },
    });

    // Also update the device's cached state
    await prisma.device.update({
      where: { deviceId },
      data: {
        displayState: JSON.stringify({ mode, timerState: timerStatePayload, mediaAssetId }),
        mode,
      },
    });

    // Emit state update to device via Socket.IO
    const io = getServerIO();
    if (io) {
      io.of('/device').to(`device:${deviceId}`).emit('state:update', timerStatePayload || createDefaultTimerState());
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
