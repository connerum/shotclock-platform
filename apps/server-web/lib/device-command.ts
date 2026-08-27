import { prisma } from './prisma';
import type {
  DeviceCommandAck,
  DeviceMode,
  PresentationOverlay,
  PresentationOverlayAccent,
  PresentationOverlayType,
  PrimaryClockResetAction,
  SportDisplayAdMode,
  SportDisplayLayout,
  TimerState,
} from '@shotclock/shared/types';
import { normalizePitchKountState } from '@shotclock/shared/types';

export const COMMAND_ACK_TIMEOUT_MS = 2500;

const devicePersistenceQueues = new Map<string, Promise<void>>();
const deviceCommandQueues = new Map<string, Promise<void>>();

const SPORT_DISPLAY_AD_MODES = new Set<SportDisplayAdMode>([
  'offset-timed',
  'mirrored-timed',
  'offset-on-timer-reset',
]);

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

  const { sportDisplayLayout: rawSportDisplayLayout, ...modeWithoutSportDisplayLayout } = mode;
  const sportDisplayLayout = isPrimarySportMode(mode.type)
    ? normalizeSportDisplayLayout(rawSportDisplayLayout)
    : null;

  return {
    ...modeWithoutSportDisplayLayout,
    ...(sportDisplayLayout ? { sportDisplayLayout } : {}),
  } as DeviceMode;
}

export function normalizeSportDisplayLayout(value: unknown): SportDisplayLayout | null {
  if (!value || typeof value !== 'object') return null;

  const layout = value as Partial<SportDisplayLayout>;
  if (layout.type !== 'three-panel') return null;

  const adPlaylist = Array.isArray(layout.adPlaylist)
    ? layout.adPlaylist
        .map((item) => {
          const mediaUrl = typeof item?.mediaUrl === 'string'
            ? item.mediaUrl.trim().slice(0, 512)
            : '';
          const mediaMimeType = typeof item?.mediaMimeType === 'string'
            ? item.mediaMimeType.trim().slice(0, 80)
            : '';

          return { mediaUrl, mediaMimeType };
        })
        .filter((item) => isAllowedSportDisplayMedia(item.mediaUrl, item.mediaMimeType))
        .slice(0, 50)
    : [];
  const rotationIntervalMs = typeof layout.rotationIntervalMs === 'number'
    ? Math.max(1000, Math.min(60000, Math.round(layout.rotationIntervalMs)))
    : undefined;
  const adMode = layout.adMode && SPORT_DISPLAY_AD_MODES.has(layout.adMode)
    ? layout.adMode
    : undefined;

  return {
    type: 'three-panel',
    adPlaylist,
    ...(rotationIntervalMs ? { rotationIntervalMs } : {}),
    ...(adMode ? { adMode } : {}),
  };
}

export function sportDisplayLayoutUsesAdvancedBehavior(layout: SportDisplayLayout | undefined): boolean {
  return Boolean(layout?.adMode && layout.adMode !== 'offset-timed');
}

function isPrimarySportMode(mode: DeviceMode['type']): mode is 'basketball' | 'wrestling' | 'volleyball' {
  return mode === 'basketball' || mode === 'wrestling' || mode === 'volleyball';
}

function isAllowedSportDisplayMedia(mediaUrl: string, mediaMimeType: string): boolean {
  const isVisualMedia = mediaMimeType.startsWith('image/') || mediaMimeType.startsWith('video/');
  const isAllowedUrl = /^https?:\/\/[^\s]+$/i.test(mediaUrl);
  return Boolean(mediaUrl && mediaMimeType && isVisualMedia && isAllowedUrl);
}

export function getDeviceRoom(deviceId: string): string {
  return `device:${deviceId}`;
}

export function deviceSupportsCapability(value: unknown, capability: string): boolean {
  try {
    const capabilities = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(capabilities) && capabilities.includes(capability);
  } catch {
    return false;
  }
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
  await runSerializedDevicePersistence(deviceId, async () => {
    try {
      const device = await prisma.device.findUnique({
        where: { deviceId },
        select: { displayState: true, mode: true },
      });

      const existingDisplayState = parseDisplayState(device?.displayState);
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
  });
}

export async function persistTimerCommand(
  deviceId: string,
  displayState: { mode: string; deviceMode: DeviceMode; timerState: TimerState; mediaAssetId: null }
): Promise<void> {
  const serializedTimerState = JSON.stringify(displayState.timerState);
  await runSerializedDevicePersistence(deviceId, async () => {
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
      ...getSportDisplayLayoutPreferenceUpdate(displayState.deviceMode, previousDisplayState),
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
  });
}

export async function persistDisplayMode(deviceId: string, mode: DeviceMode): Promise<void> {
  await runSerializedDevicePersistence(deviceId, async () => {
    try {
      const device = await prisma.device.findUnique({
        where: { deviceId },
        select: { displayState: true },
      });
      const existingDisplayState = parseDisplayState(device?.displayState);

      await prisma.device.update({
        where: { deviceId },
        data: {
          mode: mode.type,
          displayState: JSON.stringify({
            ...existingDisplayState,
            mode: mode.type,
            deviceMode: mode,
            ...getSportDisplayLayoutPreferenceUpdate(mode, existingDisplayState),
          }),
        },
      });
    } catch (error) {
      console.warn(`Unable to persist display mode for ${deviceId}; live command was still dispatched`, error);
    }
  });
}

export async function persistSportDisplayLayoutPreference(
  deviceId: string,
  sportDisplayLayout: SportDisplayLayout | null
): Promise<void> {
  await runSerializedDevicePersistence(deviceId, async () => {
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { displayState: true },
    });
    const existingDisplayState = parseDisplayState(device?.displayState);
    const nextDisplayState = reconcileSportDisplayLayoutPreference(
      existingDisplayState,
      sportDisplayLayout
    );

    await prisma.device.update({
      where: { deviceId },
      data: {
        displayState: JSON.stringify(nextDisplayState),
      },
    });
  });
}

export function reconcileSportDisplayLayoutPreference(
  existingDisplayState: Record<string, unknown>,
  sportDisplayLayout: SportDisplayLayout | null
): Record<string, unknown> {
  const currentMode = normalizeDeviceMode(existingDisplayState.deviceMode);
  if (!currentMode || !isPrimarySportMode(currentMode.type) || !currentMode.sportDisplayLayout) {
    return {
      ...existingDisplayState,
      sportDisplayLayoutPreference: sportDisplayLayout,
    };
  }

  const { sportDisplayLayout: _previousLayout, ...modeWithoutLayout } = currentMode;
  const nextMode = {
    ...modeWithoutLayout,
    ...(sportDisplayLayout ? { sportDisplayLayout } : {}),
  } as DeviceMode;

  return {
    ...existingDisplayState,
    deviceMode: nextMode,
    sportDisplayLayoutPreference: sportDisplayLayout,
  };
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

export async function runSerializedDevicePersistence<T>(
  deviceId: string,
  operation: () => Promise<T>
): Promise<T> {
  const previous = devicePersistenceQueues.get(deviceId) ?? Promise.resolve();
  const current = previous.then(operation, operation);
  const settled = current.then(() => undefined, () => undefined);

  devicePersistenceQueues.set(deviceId, settled);

  try {
    return await current;
  } finally {
    if (devicePersistenceQueues.get(deviceId) === settled) {
      devicePersistenceQueues.delete(deviceId);
    }
  }
}

export async function runSerializedDeviceCommand<T>(
  deviceId: string,
  operation: () => Promise<T>
): Promise<T> {
  return runSerializedDeviceCommands([deviceId], operation);
}

export async function runSerializedDeviceCommands<T>(
  deviceIds: string[],
  operation: () => Promise<T>
): Promise<T> {
  const normalizedDeviceIds = Array.from(new Set(
    deviceIds.map((deviceId) => deviceId.trim()).filter(Boolean)
  )).sort();
  if (normalizedDeviceIds.length === 0) return operation();

  const previous = Promise.all(normalizedDeviceIds.map((deviceId) => (
    deviceCommandQueues.get(deviceId) ?? Promise.resolve()
  )));
  const current = previous.then(operation, operation);
  const settled = current.then(() => undefined, () => undefined);

  normalizedDeviceIds.forEach((deviceId) => {
    deviceCommandQueues.set(deviceId, settled);
  });

  try {
    return await current;
  } finally {
    normalizedDeviceIds.forEach((deviceId) => {
      if (deviceCommandQueues.get(deviceId) === settled) {
        deviceCommandQueues.delete(deviceId);
      }
    });
  }
}

export function stripPrimaryResetMetadata(timerState: TimerState): TimerState {
  const {
    primaryResetSequence: _primaryResetSequence,
    primaryResetEventId: _primaryResetEventId,
    ...timerStateWithoutResetMetadata
  } = timerState;
  return timerStateWithoutResetMetadata;
}

export async function resolveTimerCommandState(
  deviceId: string,
  incomingState: TimerState,
  rawTimerAction?: unknown
): Promise<TimerState> {
  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: {
      displayState: true,
      state: { select: { timerState: true } },
    },
  });
  const displayState = parseDisplayState(device?.displayState);
  const cachedTimerState = asTimerStateSnapshot(displayState.timerState);
  const relationalTimerState = parseTimerStateSnapshot(device?.state?.timerState);
  const resetMetadata = resolvePrimaryResetMetadata(
    incomingState,
    cachedTimerState,
    relationalTimerState,
    rawTimerAction
  );

  return rebaseTimerStateToLocalClock({
    ...incomingState,
    ...resetMetadata,
  });
}

export function resolvePrimaryResetMetadata(
  incomingState: Partial<TimerState>,
  cachedTimerState: Partial<TimerState> | null,
  relationalTimerState: Partial<TimerState> | null,
  rawTimerAction?: unknown
): Pick<TimerState, 'primaryResetSequence'> & { primaryResetEventId?: string } {
  const incomingSequence = normalizePrimaryResetSequence(incomingState.primaryResetSequence);
  const cachedSequence = normalizePrimaryResetSequence(cachedTimerState?.primaryResetSequence);
  const relationalSequence = normalizePrimaryResetSequence(relationalTimerState?.primaryResetSequence);
  const currentSequence = Math.max(incomingSequence, cachedSequence, relationalSequence);
  const cachedEventId = normalizePrimaryResetEventId(cachedTimerState?.primaryResetEventId);
  const relationalEventId = normalizePrimaryResetEventId(relationalTimerState?.primaryResetEventId);
  const storedEventId = cachedSequence > relationalSequence
    ? cachedEventId
    : relationalSequence > cachedSequence
      ? relationalEventId
      : cachedEventId || relationalEventId;
  const timerAction = normalizePrimaryClockResetAction(rawTimerAction);
  const isDuplicateReset = Boolean(timerAction && timerAction.eventId === storedEventId);
  const primaryResetSequence = timerAction && !isDuplicateReset
    ? Math.min(Number.MAX_SAFE_INTEGER, currentSequence + 1)
    : currentSequence;
  const primaryResetEventId = timerAction?.eventId
    || normalizePrimaryResetEventId(incomingState.primaryResetEventId)
    || storedEventId;

  return {
    primaryResetSequence,
    ...(primaryResetEventId ? { primaryResetEventId } : {}),
  };
}

export async function resolveTimerCommandMode(deviceId: string, incomingMode: unknown): Promise<DeviceMode | null> {
  if (incomingMode !== undefined) return normalizeDeviceMode(incomingMode);

  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: { displayState: true },
  });
  const displayState = parseDisplayState(device?.displayState);
  const storedMode = normalizeDeviceMode(displayState.deviceMode);
  const storedSportDisplayLayout = normalizeSportDisplayLayout(displayState.sportDisplayLayoutPreference);

  return storedMode && isPrimarySportMode(storedMode.type)
    ? storedMode
    : {
        type: 'basketball',
        ...(storedSportDisplayLayout ? { sportDisplayLayout: storedSportDisplayLayout } : {}),
      };
}

function getSportDisplayLayoutPreferenceUpdate(
  mode: DeviceMode,
  previousDisplayState: Record<string, unknown>
): {
  sportDisplayLayoutPreference?: SportDisplayLayout | null;
} {
  if (isPrimarySportMode(mode.type)) {
    return { sportDisplayLayoutPreference: mode.sportDisplayLayout ?? null };
  }

  if (Object.prototype.hasOwnProperty.call(previousDisplayState, 'sportDisplayLayoutPreference')) return {};

  const previousMode = normalizeDeviceMode(previousDisplayState.deviceMode);
  return previousMode && isPrimarySportMode(previousMode.type) && previousMode.sportDisplayLayout
    ? { sportDisplayLayoutPreference: previousMode.sportDisplayLayout }
    : {};
}

function rebaseTimerStateToLocalClock(state: TimerState, now = Date.now()): TimerState {
  return {
    ...state,
    lastUpdated: now,
  };
}

function normalizePrimaryClockResetAction(value: unknown): PrimaryClockResetAction | null {
  if (!value || typeof value !== 'object') return null;
  const action = value as Partial<PrimaryClockResetAction>;
  const eventId = normalizePrimaryResetEventId(action.eventId);
  return action.kind === 'primary-clock-reset' && eventId
    ? { kind: 'primary-clock-reset', eventId }
    : null;
}

function normalizePrimaryResetSequence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
}

function normalizePrimaryResetEventId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 128) : null;
}

function asTimerStateSnapshot(value: unknown): Partial<TimerState> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<TimerState>
    : null;
}

function parseTimerStateSnapshot(value: string | null | undefined): Partial<TimerState> | null {
  if (!value) return null;
  try {
    return asTimerStateSnapshot(JSON.parse(value));
  } catch {
    return null;
  }
}
