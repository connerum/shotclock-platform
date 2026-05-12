// POST /api/devices/[deviceId]/command → dispatch command to device via Socket.IO
// Commands: set_mode, set_timer, presentation, update_config, factory_reset, reboot, check_update, install_update

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
import type {
  DeviceCommandAck,
  DeviceMode,
  PresentationOverlay,
  PresentationOverlayAccent,
  PresentationOverlayType,
  TimerState,
} from '@shotclock/shared/types';
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

        const displayMode: DeviceMode = payload?.mode || { type: 'basketball' };
        const timerState = await resolveTimerCommandState(deviceId, rawTimerState);
        const modeAck = await emitDeviceCommand(deviceNamespace, room, 'mode:set', displayMode);
        if (!modeAck.success) {
          return commandAckError(modeAck);
        }

        const ack = await emitDeviceCommand(deviceNamespace, room, 'state:update', timerState);
        if (!ack.success) {
          return commandAckError(ack);
        }

        const displayState = {
          mode: displayMode.type,
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

      case 'presentation': {
        const overlay = normalizePresentationOverlay(payload?.overlay);
        if (!overlay) {
          return NextResponse.json(
            { error: 'Missing or invalid presentation overlay' },
            { status: 400 }
          );
        }

        const ack = await emitDeviceCommand(deviceNamespace, room, 'presentation:show', overlay);
        if (!ack.success) {
          return commandAckError(ack);
        }

        await persistPresentationOverlay(deviceId, overlay);

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

const PRESENTATION_TYPES = new Set<PresentationOverlayType>([
  'advertisement',
  'school-logo',
  'sponsor',
  'team-intro',
  'champion',
  'sound-horn',
  'music',
  'emergency-weather',
  'emergency-medical',
  'clear',
]);

const PRESENTATION_ACCENTS = new Set<PresentationOverlayAccent>([
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'red',
]);

function normalizePresentationOverlay(raw: unknown): PresentationOverlay | null {
  if (!raw || typeof raw !== 'object') return null;

  const overlay = raw as Partial<PresentationOverlay>;
  if (!overlay.type || !PRESENTATION_TYPES.has(overlay.type)) return null;

  const title = typeof overlay.title === 'string' && overlay.title.trim()
    ? overlay.title.trim().slice(0, 32)
    : overlay.type === 'clear'
      ? 'CLEAR'
      : null;
  if (!title) return null;

  const accent = overlay.accent && PRESENTATION_ACCENTS.has(overlay.accent)
    ? overlay.accent
    : 'blue';
  const durationMs = typeof overlay.durationMs === 'number'
    ? Math.max(0, Math.min(30000, Math.round(overlay.durationMs)))
    : undefined;
  const mediaPlaylist = Array.isArray(overlay.mediaPlaylist)
    ? overlay.mediaPlaylist
        .map((item) => ({
          mediaUrl: typeof item?.mediaUrl === 'string' ? item.mediaUrl.trim().slice(0, 512) : '',
          mediaMimeType: typeof item?.mediaMimeType === 'string' ? item.mediaMimeType.trim().slice(0, 80) : '',
        }))
        .filter((item) => item.mediaUrl && item.mediaMimeType)
        .slice(0, 50)
    : [];
  const rotationIntervalMs = typeof overlay.rotationIntervalMs === 'number'
    ? Math.max(1000, Math.min(60000, Math.round(overlay.rotationIntervalMs)))
    : undefined;

  return {
    type: overlay.type,
    title,
    ...(typeof overlay.message === 'string' && overlay.message.trim()
      ? { message: overlay.message.trim().slice(0, 48) }
      : {}),
    accent,
    active: overlay.type === 'clear' ? false : overlay.active !== false,
    startedAt: Date.now(),
    ...(durationMs ? { durationMs } : {}),
    ...(typeof overlay.mediaUrl === 'string' && overlay.mediaUrl.trim()
      ? { mediaUrl: overlay.mediaUrl.trim().slice(0, 512) }
      : {}),
    ...(typeof overlay.mediaMimeType === 'string' && overlay.mediaMimeType.trim()
      ? { mediaMimeType: overlay.mediaMimeType.trim().slice(0, 80) }
      : {}),
    ...(mediaPlaylist.length > 0 ? { mediaPlaylist } : {}),
    ...(rotationIntervalMs ? { rotationIntervalMs } : {}),
  };
}

async function persistPresentationOverlay(deviceId: string, overlay: PresentationOverlay): Promise<void> {
  try {
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { displayState: true, mode: true },
    });

    const existingDisplayState = device?.displayState
      ? JSON.parse(device.displayState)
      : {};
    const nextDisplayState = {
      ...existingDisplayState,
      mode: existingDisplayState.mode || device?.mode || 'shot-clock',
      presentationOverlay: overlay,
    };

    await prisma.device.update({
      where: { deviceId },
      data: {
        displayState: JSON.stringify(nextDisplayState),
      },
    });
  } catch (error) {
    console.warn(`Unable to persist presentation overlay for ${deviceId}; live command was still dispatched`, error);
  }
}

async function persistTimerCommand(
  deviceId: string,
  displayState: { mode: string; timerState: TimerState; mediaAssetId: null }
) {
  const serializedTimerState = JSON.stringify(displayState.timerState);
  const serializedDisplayState = JSON.stringify(displayState);
  const results = await Promise.allSettled([
    prisma.device.update({
      where: { deviceId },
      data: {
        mode: displayState.mode,
        displayState: serializedDisplayState,
      },
    }),
    prisma.displayState.upsert({
      where: { deviceId },
      update: {
        mode: displayState.mode,
        timerState: serializedTimerState,
        mediaAssetId: null,
      },
      create: {
        deviceId,
        mode: displayState.mode,
        timerState: serializedTimerState,
        mediaAssetId: null,
      },
    }),
  ]);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const target = index === 0 ? 'Device displayState' : 'DisplayState';
      console.warn(`Unable to persist ${target} for ${deviceId}; live command was already acknowledged`, result.reason);
    }
  });
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
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: {
        displayState: true,
        state: {
          select: {
            timerState: true,
          },
        },
      },
    });

    const cachedDisplayState = device?.displayState ? JSON.parse(device.displayState) : null;
    const cachedTimerState = cachedDisplayState?.timerState as TimerState | null | undefined;
    const relationTimerState = device?.state?.timerState
      ? JSON.parse(device.state.timerState) as TimerState
      : null;

    return getNewestTimerState(relationTimerState, cachedTimerState);
  } catch (error) {
    console.warn(`Unable to load persisted timer state for ${deviceId}`, error);
    return null;
  }
}

function getNewestTimerState(
  first: TimerState | null | undefined,
  second: TimerState | null | undefined
): TimerState | null {
  if (!first) return second || null;
  if (!second) return first;

  const firstUpdated = typeof first.lastUpdated === 'number' ? first.lastUpdated : 0;
  const secondUpdated = typeof second.lastUpdated === 'number' ? second.lastUpdated : 0;
  return secondUpdated > firstUpdated ? second : first;
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
