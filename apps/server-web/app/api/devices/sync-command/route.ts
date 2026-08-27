// POST /api/devices/sync-command → dispatch game commands to selected devices in sync
// Commands: set_mode, set_timer, presentation

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
import { canAccessDevice, requireApiUser } from '@/lib/auth';
import {
  THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  type DeviceMode,
  type TimerState,
} from '@shotclock/shared/types';
import type { DeviceCommandResult, GameCommandType } from '@/lib/device-command';
import {
  deviceSupportsCapability,
  deviceSupportsSportDisplayLayout,
  emitDeviceCommandToDevice,
  getConnectedDeviceSocketCount,
  markDeviceOffline,
  normalizeDeviceMode,
  normalizePresentationOverlay,
  persistDisplayMode,
  persistPresentationOverlay,
  persistTimerCommand,
  runSerializedDeviceCommands,
  resolveTimerCommandMode,
  resolveTimerCommandState,
  sportDisplayLayoutUsesAdvancedBehavior,
  stripPrimaryResetMetadata,
} from '@/lib/device-command';

const GAME_COMMAND_TYPES = new Set<GameCommandType>(['set_mode', 'set_timer', 'presentation']);
const SYNC_MODE_TYPES = new Set(['basketball', 'wrestling', 'volleyball', 'practice-board', 'pitchkount', 'shot-clock']);
type SyncDevice = {
  deviceId: string;
  ownerUserId: string | null;
  capabilities: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      primaryDeviceId,
      targetDeviceIds: rawTargetDeviceIds,
      type,
      payload,
    } = body as {
      primaryDeviceId?: unknown;
      targetDeviceIds?: unknown;
      type?: unknown;
      payload?: unknown;
    };

    if (typeof primaryDeviceId !== 'string' || !primaryDeviceId.trim()) {
      return NextResponse.json({ error: 'Missing required field: primaryDeviceId' }, { status: 400 });
    }

    if (!isGameCommandType(type)) {
      return NextResponse.json({ error: `Invalid sync command type: ${String(type || '')}` }, { status: 400 });
    }

    const targetDeviceIds = normalizeTargetDeviceIds(rawTargetDeviceIds);
    if (targetDeviceIds.length === 0) {
      return NextResponse.json({ error: 'At least one targetDeviceId is required' }, { status: 400 });
    }

    if (!targetDeviceIds.includes(primaryDeviceId)) {
      return NextResponse.json(
        { error: 'primaryDeviceId must be included in targetDeviceIds' },
        { status: 400 }
      );
    }

    const devices = await prisma.device.findMany({
      where: { deviceId: { in: targetDeviceIds } },
      select: { deviceId: true, ownerUserId: true, capabilities: true },
    });
    const foundDeviceIds = new Set(devices.map((device: SyncDevice) => device.deviceId));
    const missingDeviceIds = targetDeviceIds.filter((deviceId) => !foundDeviceIds.has(deviceId));

    if (missingDeviceIds.length > 0 || devices.some((device: SyncDevice) => !canAccessDevice(auth, device))) {
      return NextResponse.json(
        {
          success: false,
          error: 'One or more selected devices were not found',
          missingDeviceIds,
        },
        { status: 404 }
      );
    }

    const io = getServerIO();
    if (!io) {
      return NextResponse.json(
        { success: false, error: 'Socket.IO server not available' },
        { status: 503 }
      );
    }

    const deviceNamespace = io.of('/device');
    const disconnectedDeviceIds = targetDeviceIds.filter((deviceId) => {
      return getConnectedDeviceSocketCount(deviceNamespace, deviceId) === 0;
    });

    if (disconnectedDeviceIds.length > 0) {
      await Promise.all(disconnectedDeviceIds.map((deviceId) => markDeviceOffline(deviceId)));
      return NextResponse.json(
        {
          success: false,
          error: 'One or more selected devices are not connected',
          disconnectedDeviceIds,
          results: targetDeviceIds.map((deviceId) => ({
            deviceId,
            success: false,
            error: disconnectedDeviceIds.includes(deviceId)
              ? 'Device is not connected'
              : 'Command was not dispatched because another selected device is offline',
          })),
        },
        { status: 409 }
      );
    }

    switch (type) {
      case 'set_mode': {
        const mode = getSyncDeviceMode((payload as any)?.mode);
        if (!mode) {
          return NextResponse.json(
            { success: false, error: 'Missing or invalid game mode for synchronized set_mode command' },
            { status: 400 }
          );
        }
        const unsupportedDeviceIds = getUnsupportedSportDisplayLayoutDeviceIds(devices, mode);
        if (unsupportedDeviceIds.length > 0) {
          return unsupportedSportDisplayLayoutResponse(
            unsupportedDeviceIds,
            mode.sportDisplayLayout!.type
          );
        }
        const unsupportedBehaviorDeviceIds = getUnsupportedAdBehaviorDeviceIds(devices, mode);
        if (unsupportedBehaviorDeviceIds.length > 0) {
          return unsupportedAdBehaviorResponse(unsupportedBehaviorDeviceIds);
        }

        const results = await emitToTargets(deviceNamespace, targetDeviceIds, 'mode:set', mode);
        await persistDisplayModesForSuccessfulResults(results, mode);

        if (hasFailedResult(results)) {
          return commandResultsError(type, primaryDeviceId, targetDeviceIds, results);
        }

        return commandResultsSuccess(type, primaryDeviceId, targetDeviceIds, results);
      }

      case 'set_timer': {
        return runSerializedDeviceCommands(targetDeviceIds, async () => {
          const rawTimerState = (payload as any)?.timerState as TimerState | undefined;
          if (!rawTimerState) {
            return NextResponse.json(
              { success: false, error: 'Missing timerState for synchronized set_timer command' },
              { status: 400 }
            );
          }

          const displayMode = await resolveTimerCommandMode(primaryDeviceId, (payload as any)?.mode);
          if (!displayMode || !SYNC_MODE_TYPES.has(displayMode.type)) {
            return NextResponse.json(
              { success: false, error: 'Invalid game mode for synchronized set_timer command' },
              { status: 400 }
            );
          }
          const unsupportedDeviceIds = getUnsupportedSportDisplayLayoutDeviceIds(devices, displayMode);
          if (unsupportedDeviceIds.length > 0) {
            return unsupportedSportDisplayLayoutResponse(
              unsupportedDeviceIds,
              displayMode.sportDisplayLayout!.type
            );
          }
          const unsupportedBehaviorDeviceIds = getUnsupportedAdBehaviorDeviceIds(devices, displayMode);
          if (unsupportedBehaviorDeviceIds.length > 0) {
            return unsupportedAdBehaviorResponse(unsupportedBehaviorDeviceIds);
          }
          const timerAction = displayMode.sportDisplayLayout?.adMode === 'offset-on-timer-reset'
            ? (payload as any)?.timerAction
            : undefined;
          const timerStateWithoutResetMetadata = stripPrimaryResetMetadata(rawTimerState);
          const resolvedTargetTimerStates = await Promise.all(targetDeviceIds.map(async (deviceId) => (
            [
              deviceId,
              await resolveTimerCommandState(deviceId, timerStateWithoutResetMetadata, timerAction),
            ] as const
          )));
          const synchronizedAt = Date.now();
          const targetTimerStates = new Map(resolvedTargetTimerStates.map(([deviceId, timerState]) => (
            [deviceId, { ...timerState, lastUpdated: synchronizedAt }] as const
          )));
          const primaryTimerState = targetTimerStates.get(primaryDeviceId)!;
          const modeResults = await emitToTargets(deviceNamespace, targetDeviceIds, 'mode:set', displayMode);
          await persistDisplayModesForSuccessfulResults(modeResults, displayMode);

          if (hasFailedResult(modeResults)) {
            return commandResultsError(
              type,
              primaryDeviceId,
              targetDeviceIds,
              modeResults.map((result) => result.success
                ? {
                    deviceId: result.deviceId,
                    success: false,
                    error: 'Timer state was not dispatched because another selected device did not acknowledge mode:set',
                  }
                : result)
            );
          }

          const stateResults = await Promise.all(targetDeviceIds.map((deviceId) => (
            emitDeviceCommandToDevice(
              deviceNamespace,
              deviceId,
              'state:update',
              targetTimerStates.get(deviceId)!
            )
          )));
          await Promise.all(stateResults
            .filter((result) => result.success)
            .map((result) => persistTimerCommand(result.deviceId, {
              mode: displayMode.type,
              deviceMode: displayMode,
              timerState: targetTimerStates.get(result.deviceId)!,
              mediaAssetId: null,
            })));

          if (hasFailedResult(stateResults)) {
            return commandResultsError(type, primaryDeviceId, targetDeviceIds, stateResults);
          }

          return commandResultsSuccess(type, primaryDeviceId, targetDeviceIds, stateResults, {
            mode: displayMode,
            timerState: primaryTimerState,
          });
        });
      }

      case 'presentation': {
        const overlay = normalizePresentationOverlay((payload as any)?.overlay);
        if (!overlay) {
          return NextResponse.json(
            { success: false, error: 'Missing or invalid presentation overlay' },
            { status: 400 }
          );
        }

        const results = await emitToTargets(deviceNamespace, targetDeviceIds, 'presentation:show', overlay);
        await Promise.all(results
          .filter((result) => result.success)
          .map((result) => persistPresentationOverlay(result.deviceId, overlay)));

        if (hasFailedResult(results)) {
          return commandResultsError(type, primaryDeviceId, targetDeviceIds, results);
        }

        return commandResultsSuccess(type, primaryDeviceId, targetDeviceIds, results);
      }
    }

    return NextResponse.json(
      { success: false, error: `Invalid sync command type: ${String(type)}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error dispatching synchronized command:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to dispatch synchronized command' },
      { status: 500 }
    );
  }
}

function normalizeTargetDeviceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((deviceId) => {
    if (typeof deviceId !== 'string') return;
    const trimmed = deviceId.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    normalized.push(trimmed);
  });

  return normalized;
}

function isGameCommandType(value: unknown): value is GameCommandType {
  return typeof value === 'string' && GAME_COMMAND_TYPES.has(value as GameCommandType);
}

function getSyncDeviceMode(value: unknown): DeviceMode | null {
  const mode = normalizeDeviceMode(value);
  if (!mode || !SYNC_MODE_TYPES.has(mode.type)) return null;
  return mode;
}

function getUnsupportedSportDisplayLayoutDeviceIds(devices: SyncDevice[], mode: DeviceMode): string[] {
  if (!mode.sportDisplayLayout) return [];
  return devices
    .filter((device) => !deviceSupportsSportDisplayLayout(device.capabilities, mode.sportDisplayLayout))
    .map((device) => device.deviceId);
}

function getUnsupportedAdBehaviorDeviceIds(devices: SyncDevice[], mode: DeviceMode): string[] {
  if (!sportDisplayLayoutUsesAdvancedBehavior(mode.sportDisplayLayout)) return [];
  return devices
    .filter((device) => !deviceSupportsCapability(device.capabilities, THREE_PANEL_AD_BEHAVIORS_CAPABILITY))
    .map((device) => device.deviceId);
}

function unsupportedSportDisplayLayoutResponse(
  unsupportedDeviceIds: string[],
  type: 'two-panel' | 'three-panel'
) {
  const sectionCount = type === 'two-panel' ? 2 : 3;
  return NextResponse.json(
    {
      success: false,
      error: `One or more displays require a software update for ${sectionCount}-section layouts`,
      unsupportedDeviceIds,
    },
    { status: 409 }
  );
}

function unsupportedAdBehaviorResponse(unsupportedDeviceIds: string[]) {
  return NextResponse.json(
    {
      success: false,
      error: 'One or more displays require a software update for synchronized and timer-reset ad behaviors',
      unsupportedDeviceIds,
    },
    { status: 409 }
  );
}

function emitToTargets(
  deviceNamespace: any,
  targetDeviceIds: string[],
  event: string,
  payload?: unknown
): Promise<DeviceCommandResult[]> {
  return Promise.all(
    targetDeviceIds.map((deviceId) => emitDeviceCommandToDevice(deviceNamespace, deviceId, event, payload))
  );
}

async function persistDisplayModesForSuccessfulResults(
  results: DeviceCommandResult[],
  mode: DeviceMode
): Promise<void> {
  await Promise.all(results
    .filter((result) => result.success)
    .map((result) => persistDisplayMode(result.deviceId, mode)));
}

function hasFailedResult(results: DeviceCommandResult[]): boolean {
  return results.some((result) => !result.success);
}

function commandResultsSuccess(
  command: GameCommandType,
  primaryDeviceId: string,
  targetDeviceIds: string[],
  results: DeviceCommandResult[],
  details: Record<string, unknown> = {}
) {
  return NextResponse.json({
    success: true,
    command,
    primaryDeviceId,
    targetDeviceIds,
    results,
    ...details,
    dispatchedAt: new Date().toISOString(),
  });
}

function commandResultsError(
  command: GameCommandType,
  primaryDeviceId: string,
  targetDeviceIds: string[],
  results: DeviceCommandResult[]
) {
  return NextResponse.json(
    {
      success: false,
      command,
      primaryDeviceId,
      targetDeviceIds,
      results,
      error: 'One or more selected devices did not acknowledge the synchronized command',
      dispatchedAt: new Date().toISOString(),
    },
    { status: 504 }
  );
}
