import { prisma } from './prisma';
import type {
  DeviceCommandAck,
  DeviceMode,
  PresentationOverlay,
  PresentationOverlayAccent,
  PresentationOverlayType,
  TimerState,
} from '@shotclock/shared/types';
import { normalizePitchKountState } from '@shotclock/shared/types';

export const COMMAND_ACK_TIMEOUT_MS = 2500;

export type GameCommandType = 'set_mode' | 'set_timer' | 'presentation';

export type DeviceCommandResult = {
  deviceId: string;
  success: boolean;
  error?: string;
};

const DEVICE_MODE_TYPES = new Set<DeviceMode['type']>([
  'setup',
  'pairing',
  'offline',
  'basketball',
  'wrestling',
  'volleyball',
  'practice-board',
  'pitchkount',
  'shot-clock',
  'media',
  'calibration',
  'blank',
]);

export function normalizeDeviceMode(value: unknown): DeviceMode | null {
  if (!value || typeof value !== 'object') return null;
  const mode = value as Partial<DeviceMode>;
  if (!mode.type || !DEVICE_MODE_TYPES.has(mode.type)) return null;

  if (mode.type === 'pitchkount') {
    return {
      type: 'pitchkount',
      pitchKount: normalizePitchKountState(mode.pitchKount),
    };
  }

  return mode as DeviceMode;
}

export function getDeviceRoom(deviceId: string): string {
  return `device:${deviceId}`;
}

export function getConnectedDeviceSocketCount(deviceNamespace: any, deviceId: string): number {
  return deviceNamespace.adapter.rooms.get(getDeviceRoom(deviceId))?.size ?? 0;
}

export async function markDeviceOffline(deviceId: string): Promise<void> {
  await prisma.device.update({
    where: { deviceId },
    data: {
      isOnline: false,
      status: 'offline',
    },
  }).catch(() => {});
}

export async function emitDeviceCommand(
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

export async function emitDeviceCommandToDevice(
  deviceNamespace: any,
  deviceId: string,
  event: string,
  payload?: unknown
): Promise<DeviceCommandResult> {
  const ack = await emitDeviceCommand(deviceNamespace, getDeviceRoom(deviceId), event, payload);
  return {
    deviceId,
    success: ack.success,
    ...(ack.error ? { error: ack.error } : {}),
  };
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

export function normalizePresentationOverlay(raw: unknown): PresentationOverlay | null {
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

export async function persistPresentationOverlay(deviceId: string, overlay: PresentationOverlay): Promise<void> {
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

export async function persistTimerCommand(
  deviceId: string,
  displayState: { mode: string; deviceMode: DeviceMode; timerState: TimerState; mediaAssetId: null }
): Promise<void> {
  const serializedTimerState = JSON.stringify(displayState.timerState);
  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: { displayState: true },
  });
  const previousDisplayState = parseDisplayState(device?.displayState);
  const mergedDisplayState = {
    ...previousDisplayState,
    mode: displayState.mode,
    deviceMode: displayState.deviceMode,
    timerState: displayState.timerState,
    mediaAssetId: displayState.mediaAssetId,
  };
  const serializedDisplayState = JSON.stringify(mergedDisplayState);
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

export async function persistDisplayMode(deviceId: string, mode: DeviceMode): Promise<void> {
  try {
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { displayState: true },
    });
    const existingDisplayState = device?.displayState ? JSON.parse(device.displayState) : {};

    await prisma.device.update({
      where: { deviceId },
      data: {
        mode: mode.type,
        displayState: JSON.stringify({
          ...existingDisplayState,
          mode: mode.type,
          deviceMode: mode,
        }),
      },
    });
  } catch (error) {
    console.warn(`Unable to persist display mode for ${deviceId}; live command was still dispatched`, error);
  }
}

export async function resetDeviceRecordAfterFactoryReset(deviceId: string): Promise<void> {
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

function parseDisplayState(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function resolveTimerCommandState(_deviceId: string, incomingState: TimerState): Promise<TimerState> {
  return rebaseTimerStateToLocalClock(incomingState);
}

function rebaseTimerStateToLocalClock(state: TimerState, now = Date.now()): TimerState {
  return {
    ...state,
    lastUpdated: now,
  };
}
