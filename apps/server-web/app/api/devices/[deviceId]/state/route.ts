// GET /api/devices/[deviceId]/state → return latest DisplayState
// POST /api/devices/[deviceId]/state → create new DisplayState record, emit device:state:update to device socket

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
import { TimerState } from '@shotclock/shared/types';
import { DEFAULT_GAME_CLOCK_SECONDS, DEFAULT_SHOT_CLOCK_SECONDS } from '@shotclock/shared/timer';
import { canAccessDevice, requireApiUser } from '@/lib/auth';
import {
  normalizeDeviceMode,
  resolvePrimaryResetMetadata,
  runSerializedDeviceCommand,
  runSerializedDevicePersistence,
  sportDisplayLayoutRotatesOnTimerReset,
} from '@/lib/device-command';
import { parsePitchKountDisplayState, serializePitchKountDisplayState } from '@/lib/pitchkount-players';

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function createDefaultTimerState(now = Date.now()): TimerState {
  return {
    mode: 'stop',
    homeScore: 0,
    awayScore: 0,
    period: 1,
    shotClock: DEFAULT_SHOT_CLOCK_SECONDS,
    gameClock: DEFAULT_GAME_CLOCK_SECONDS,
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

    const { deviceId } = await params;

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
    const cachedDisplayState = parsePitchKountDisplayState(deviceWithState?.displayState);

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
              mode: cachedDisplayState?.mode || 'setup',
              timerState,
              mediaAssetId: cachedDisplayState?.mediaAssetId || null,
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

    const { deviceId } = await params;
    const body = await request.json();
    const { mode, timerState, mediaAssetId, timerAction } = body;
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

    const persisted = await runSerializedDeviceCommand(deviceId, () => (
      runSerializedDevicePersistence(deviceId, () => prisma.$transaction(async (transaction) => {
        const deviceRecord = await transaction.device.findUnique({
          where: { deviceId },
          select: {
            displayState: true,
            state: { select: { timerState: true } },
          },
        });
        const existingDisplayState = parsePitchKountDisplayState(deviceRecord?.displayState);
        const existingMode = normalizeDeviceMode(existingDisplayState?.deviceMode);
        const cachedTimerState = asTimerStateSnapshot(existingDisplayState?.timerState);
        const relationalTimerState = asTimerStateSnapshot(
          parsePitchKountDisplayState(deviceRecord?.state?.timerState)
        );
        const appliedTimerState = timerStatePayload
          ? {
              ...timerStatePayload,
              ...resolvePrimaryResetMetadata(
                timerStatePayload,
                cachedTimerState,
                relationalTimerState,
              sportDisplayLayoutRotatesOnTimerReset(existingMode?.sportDisplayLayout)
                ? timerAction
                : undefined
              ),
            }
          : null;
        const nextDisplayState = serializePitchKountDisplayState({
          ...(existingDisplayState ?? {}),
          mode,
          timerState: appliedTimerState,
          mediaAssetId: mediaAssetId || null,
        });

        const nextState = await transaction.displayState.upsert({
          where: { deviceId },
          update: {
            mode,
            timerState: appliedTimerState ? JSON.stringify(appliedTimerState) : null,
            mediaAssetId: mediaAssetId || null,
          },
          create: {
            deviceId,
            mode,
            timerState: appliedTimerState ? JSON.stringify(appliedTimerState) : null,
            mediaAssetId: mediaAssetId || null,
          },
        });

        await transaction.device.update({
          where: { deviceId },
          data: {
            displayState: nextDisplayState,
            mode,
          },
        });

        return { state: nextState, timerState: appliedTimerState };
      }))
    ));
    const { state, timerState: appliedTimerState } = persisted;

    // Emit state update to device via Socket.IO
    const io = getServerIO();
    if (io) {
      io.of('/device').to(`device:${deviceId}`).emit('state:update', appliedTimerState || createDefaultTimerState());
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

function asTimerStateSnapshot(value: unknown): Partial<TimerState> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<TimerState>
    : null;
}
