// POST /api/devices/[deviceId]/command → dispatch command to device via Socket.IO
// Commands: set_mode, set_timer, update_config, factory_reset, reboot, check_update, install_update

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
import { DeviceCommandAck, DeviceMode, TimerState } from '@shotclock/shared/types';
import { canAccessDevice, requireApiUser } from '@/lib/auth';

interface RouteParams {
  params: { deviceId: string };
}

const COMMAND_ACK_TIMEOUT_MS = 2500;

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = params;
    const body = await request.json();
    const { type, payload } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      );
    }

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, ownerUserId: true },
    });

    if (!device) {
      return NextResponse.json(
        { error: `Device not found: ${deviceId}` },
        { status: 404 }
      );
    }

    if (!canAccessDevice(auth, device)) {
      return NextResponse.json(
        { error: `Device not found: ${deviceId}` },
        { status: 404 }
      );
    }

    const io = getServerIO();
    if (!io) {
      return NextResponse.json(
        { error: 'Socket.IO server not available' },
        { status: 503 }
      );
    }

    const room = `device:${deviceId}`;
    const deviceNamespace = io.of('/device');
    const connectedSockets = deviceNamespace.adapter.rooms.get(room)?.size ?? 0;

    if (connectedSockets === 0) {
      await prisma.device.update({
        where: { deviceId },
        data: {
          isOnline: false,
          status: 'offline',
        },
      }).catch(() => {});

      return NextResponse.json(
        { error: `Device is not connected: ${deviceId}` },
        { status: 409 }
      );
    }

    // Route commands to device via Socket.IO
    switch (type) {
      case 'set_mode': {
        const mode: DeviceMode = payload?.mode || { type: 'setup' };
        const ack = await emitDeviceCommand(deviceNamespace, room, 'mode:set', mode);
        if (!ack.success) {
          return commandAckError(ack);
        }
        
        // Update device mode in DB
        await prisma.device.update({
          where: { deviceId },
          data: { mode: mode.type },
        }).catch(() => {}); // Ignore if device doesn't exist
        
        return NextResponse.json({
          success: true,
          command: type,
          acknowledged: true,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'set_timer': {
        const rawTimerState: TimerState = payload?.timerState;
        if (!rawTimerState) {
          return NextResponse.json(
            { error: 'Missing timerState for set_timer command' },
            { status: 400 }
          );
        }

        const timerState = await resolveTimerCommandState(deviceId, rawTimerState);
        const ack = await emitDeviceCommand(deviceNamespace, room, 'state:update', timerState);
        if (!ack.success) {
          return commandAckError(ack);
        }

        const displayState = {
          mode: 'shot-clock',
          timerState,
          mediaAssetId: null,
        };

        await persistTimerCommand(deviceId, displayState);

        return NextResponse.json({
          success: true,
          command: type,
          acknowledged: true,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'update_config': {
        const ack = await emitDeviceCommand(deviceNamespace, room, 'config:update', payload || {});
        if (!ack.success) {
          return commandAckError(ack);
        }
        return NextResponse.json({
          success: true,
          command: type,
          acknowledged: true,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'reboot': {
        const ack = await emitDeviceCommand(deviceNamespace, room, 'reboot');
        if (!ack.success) {
          return commandAckError(ack);
        }
        return NextResponse.json({
          success: true,
          command: type,
          acknowledged: true,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'check_update': {
        const ack = await emitDeviceCommand(deviceNamespace, room, 'update:check');
        if (!ack.success) {
          return commandAckError(ack);
        }
        return NextResponse.json({
          success: true,
          command: type,
          acknowledged: true,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'install_update': {
        const version = payload?.version;
        if (!version) {
          return NextResponse.json(
            { error: 'Missing version for install_update command' },
            { status: 400 }
          );
        }
        const ack = await emitDeviceCommand(deviceNamespace, room, 'update:install', version);
        if (!ack.success) {
          return commandAckError(ack);
        }
        return NextResponse.json({
          success: true,
          command: type,
          version,
          acknowledged: true,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'factory_reset': {
        const ack = await emitDeviceCommand(deviceNamespace, room, 'factory:reset');
        if (!ack.success) {
          return commandAckError(ack);
        }

        await resetDeviceRecordAfterFactoryReset(deviceId);

        return NextResponse.json({
          success: true,
          command: type,
          acknowledged: true,
          dispatchedAt: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown command type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error dispatching command:', error);
    return NextResponse.json(
      { error: 'Failed to dispatch command' },
      { status: 500 }
    );
  }
}

async function emitDeviceCommand(
  deviceNamespace: any,
  room: string,
  event: string,
  payload?: unknown
): Promise<DeviceCommandAck> {
  return new Promise((resolve) => {
    const args = payload === undefined ? [] : [payload];

    deviceNamespace
      .timeout(COMMAND_ACK_TIMEOUT_MS)
      .to(room)
      .emit(event, ...args, (error: Error | null, responses?: DeviceCommandAck[]) => {
        if (error) {
          resolve({
            success: false,
            error: `Device did not acknowledge ${event} within ${COMMAND_ACK_TIMEOUT_MS}ms`,
          });
          return;
        }

        const response = responses?.[0];
        if (!response) {
          resolve({ success: false, error: `Device returned no acknowledgement for ${event}` });
          return;
        }

        resolve(response);
      });
  });
}

function commandAckError(ack: DeviceCommandAck) {
  return NextResponse.json(
    { success: false, error: ack.error || 'Device did not acknowledge command' },
    { status: 504 }
  );
}

async function persistTimerCommand(
  deviceId: string,
  displayState: { mode: string; timerState: TimerState; mediaAssetId: null }
) {
  try {
    await prisma.displayState.upsert({
      where: { deviceId },
      update: {
        mode: displayState.mode,
        timerState: JSON.stringify(displayState.timerState),
        mediaAssetId: null,
      },
      create: {
        deviceId,
        mode: displayState.mode,
        timerState: JSON.stringify(displayState.timerState),
        mediaAssetId: null,
      },
    });
  } catch (error) {
    console.warn(`Unable to persist DisplayState for ${deviceId}; live command was still dispatched`, error);
  }

  try {
    await prisma.device.update({
      where: { deviceId },
      data: {
        mode: displayState.mode,
        displayState: JSON.stringify(displayState),
      },
    });
  } catch (error) {
    console.warn(`Unable to persist Device display state for ${deviceId}; live command was still dispatched`, error);
  }
}

async function resetDeviceRecordAfterFactoryReset(deviceId: string): Promise<void> {
  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: { id: true, deviceId: true },
  });

  if (!device) return;

  await prisma.$transaction([
    prisma.displayState.deleteMany({
      where: { deviceId },
    }),
    prisma.deviceUpdate.deleteMany({
      where: {
        OR: [
          { deviceId: device.id },
          { deviceId },
        ],
      },
    }),
    prisma.device.delete({
      where: { deviceId },
    }),
  ]).catch((error) => {
    console.warn(`Unable to remove server device record for ${deviceId}`, error);
  });
}

async function resolveTimerCommandState(deviceId: string, incomingState: TimerState): Promise<TimerState> {
  if (incomingState.mode !== 'pause' && !incomingState.isPaused) {
    return rebaseTimerStateToLocalClock(incomingState);
  }

  const previousState = await loadPersistedTimerState(deviceId);
  if (!previousState?.isRunning) {
    return rebaseTimerStateToLocalClock(incomingState);
  }

  const pausedState = pauseTimerState(previousState);
  return rebaseTimerStateToLocalClock({
    ...pausedState,
    homeScore: incomingState.homeScore,
    awayScore: incomingState.awayScore,
    period: incomingState.period ?? pausedState.period,
  });
}

async function loadPersistedTimerState(deviceId: string): Promise<TimerState | null> {
  try {
    const state = await prisma.displayState.findUnique({
      where: { deviceId },
      select: { timerState: true },
    });

    return state?.timerState ? JSON.parse(state.timerState) as TimerState : null;
  } catch (error) {
    console.warn(`Unable to load persisted timer state for ${deviceId}`, error);
    return null;
  }
}

function rebaseTimerStateToLocalClock(state: TimerState, now = Date.now()): TimerState {
  return {
    ...state,
    lastUpdated: now,
  };
}

function pauseTimerState(state: TimerState, now = Date.now()): TimerState {
  const projected = projectTimerState(state, now);

  return {
    ...projected,
    mode: 'pause',
    isRunning: false,
    isPaused: true,
    lastUpdated: now,
  };
}

function projectTimerState(state: TimerState, now = Date.now()): TimerState {
  if (!state.isRunning) return state;

  const elapsedSeconds = Math.max(0, Math.floor((now - state.lastUpdated) / 1000));

  return {
    ...state,
    shotClock: Math.max(0, state.shotClock - elapsedSeconds),
    gameClock: Math.max(0, state.gameClock - elapsedSeconds),
  };
}
