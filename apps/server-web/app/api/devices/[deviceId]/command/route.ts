// POST /api/devices/[deviceId]/command → dispatch command to device via Socket.IO
// Commands: set_mode, set_timer, presentation, update_config, factory_reset, reboot, check_update, install_update

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
import {
  THREE_PANEL_AD_BEHAVIORS_CAPABILITY,
  type DeviceCommandAck,
  type DeviceMode,
  type TimerState,
} from '@shotclock/shared/types';
import { canAccessDevice, requireApiUser } from '@/lib/auth';
import {
  emitDeviceCommand,
  deviceSupportsCapability,
  deviceSupportsSportDisplayLayout,
  getConnectedDeviceSocketCount,
  getDeviceRoom,
  markDeviceOffline,
  normalizeDeviceMode,
  normalizePresentationOverlay,
  persistDisplayMode,
  persistPresentationOverlay,
  persistTimerCommand,
  resetDeviceRecordAfterFactoryReset,
  runSerializedDeviceCommand,
  resolveTimerCommandMode,
  resolveTimerCommandState,
  sportDisplayLayoutUsesAdvancedBehavior,
} from '@/lib/device-command';
import { getRequestIp, writeAuditLog } from '@/lib/audit';
import { enforceRateLimit, requireJson } from '@/lib/request-security';

const ALLOWED_COMMANDS = new Set([
  'set_mode', 'set_timer', 'presentation', 'update_config', 'reboot',
  'check_update', 'install_update', 'factory_reset', 'ping',
]);

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const limited = enforceRateLimit(request, 'device-command', 180, 60 * 1000);
    if (limited) return limited;
    const invalidContentType = requireJson(request);
    if (invalidContentType) return invalidContentType;
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = await params;
    const body = await request.json();
    const { type, payload } = body;

    if (!type || !ALLOWED_COMMANDS.has(type)) {
      return NextResponse.json(
        { error: 'Missing or unsupported command type' },
        { status: 400 }
      );
    }

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { deviceId: true, ownerUserId: true, capabilities: true },
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

    await writeAuditLog({
      actor: auth,
      action: `device.command_${type}`,
      targetType: 'Device',
      targetId: deviceId,
      details: { command: type },
      ipAddress: getRequestIp(request),
    });

    const io = getServerIO();
    if (!io) {
      return NextResponse.json(
        { error: 'Socket.IO server not available' },
        { status: 503 }
      );
    }

    const room = getDeviceRoom(deviceId);
    const deviceNamespace = io.of('/device');
    const connectedSockets = getConnectedDeviceSocketCount(deviceNamespace, deviceId);

    if (connectedSockets === 0) {
      await markDeviceOffline(deviceId);

      return NextResponse.json(
        { error: `Device is not connected: ${deviceId}` },
        { status: 409 }
      );
    }

    // Route commands to device via Socket.IO
    switch (type) {
      case 'set_mode': {
        const mode = normalizeDeviceMode(payload?.mode);
        if (!mode) {
          return NextResponse.json(
            { error: 'Missing or invalid display mode' },
            { status: 400 }
          );
        }
        if (
          mode.sportDisplayLayout &&
          !deviceSupportsSportDisplayLayout(device.capabilities, mode.sportDisplayLayout)
        ) {
          return unsupportedSportDisplayLayoutResponse(mode.sportDisplayLayout.type);
        }
        if (
          sportDisplayLayoutUsesAdvancedBehavior(mode.sportDisplayLayout) &&
          !deviceSupportsCapability(device.capabilities, THREE_PANEL_AD_BEHAVIORS_CAPABILITY)
        ) {
          return NextResponse.json(
            { error: 'Display software update required for synchronized and timer-reset ad behaviors' },
            { status: 409 }
          );
        }
        const ack = await emitDeviceCommand(deviceNamespace, room, 'mode:set', mode);
        if (!ack.success) {
          return commandAckError(ack);
        }
        
        await persistDisplayMode(deviceId, mode);

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
        return runSerializedDeviceCommand(deviceId, async () => {
          const rawTimerState: TimerState = payload?.timerState;
          if (!rawTimerState) {
            return NextResponse.json(
              { error: 'Missing timerState for set_timer command' },
              { status: 400 }
            );
          }

          const displayMode: DeviceMode | null = await resolveTimerCommandMode(deviceId, payload?.mode);
          if (!displayMode) {
            return NextResponse.json(
              { error: 'Invalid display mode for set_timer command' },
              { status: 400 }
            );
          }
          if (
            displayMode.sportDisplayLayout &&
            !deviceSupportsSportDisplayLayout(device.capabilities, displayMode.sportDisplayLayout)
          ) {
            return unsupportedSportDisplayLayoutResponse(displayMode.sportDisplayLayout.type);
          }
          if (
            sportDisplayLayoutUsesAdvancedBehavior(displayMode.sportDisplayLayout) &&
            !deviceSupportsCapability(device.capabilities, THREE_PANEL_AD_BEHAVIORS_CAPABILITY)
          ) {
            return NextResponse.json(
              { error: 'Display software update required for synchronized and timer-reset ad behaviors' },
              { status: 409 }
            );
          }
          const timerState = await resolveTimerCommandState(
            deviceId,
            rawTimerState,
            displayMode.sportDisplayLayout?.adMode === 'offset-on-timer-reset'
              ? payload?.timerAction
              : undefined
          );
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
            deviceMode: displayMode,
            timerState,
            mediaAssetId: null,
          };

          await persistTimerCommand(deviceId, displayState);

          return NextResponse.json({
            success: true,
            command: type,
            acknowledged: true,
            mode: displayMode,
            timerState,
            dispatchedAt: new Date().toISOString(),
          });
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
        if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version || ''))) {
          return NextResponse.json(
            { error: 'A valid semantic version is required for install_update' },
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

function commandAckError(ack: DeviceCommandAck) {
  return NextResponse.json(
    { success: false, error: ack.error || 'Device did not acknowledge command' },
    { status: 504 }
  );
}

function unsupportedSportDisplayLayoutResponse(type: 'two-panel' | 'three-panel') {
  const sectionCount = type === 'two-panel' ? 2 : 3;
  return NextResponse.json(
    { error: `Display software update required for ${sectionCount}-section layouts` },
    { status: 409 }
  );
}
