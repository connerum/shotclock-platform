// POST /api/devices/[deviceId]/command → dispatch command to device via Socket.IO
// Commands: set_mode, set_timer, update_config, reboot, check_update, install_update

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerIO } from '@/lib/socket';
import { DeviceMode, TimerState } from '@shotclock/shared/types';

interface RouteParams {
  params: { deviceId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = params;
    const body = await request.json();
    const { type, payload } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      );
    }

    const io = getServerIO();
    if (!io) {
      return NextResponse.json(
        { error: 'Socket.IO server not available' },
        { status: 500 }
      );
    }

    // Route commands to device via Socket.IO
    switch (type) {
      case 'set_mode': {
        const mode: DeviceMode = payload?.mode || { type: 'setup' };
        io.to(`device:${deviceId}`).emit('mode:set', mode);
        
        // Update device mode in DB
        await prisma.device.update({
          where: { deviceId },
          data: { mode: mode.type },
        }).catch(() => {}); // Ignore if device doesn't exist
        
        return NextResponse.json({
          success: true,
          command: type,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'set_timer': {
        const timerState: TimerState = payload?.timerState;
        if (timerState) {
          io.to(`device:${deviceId}`).emit('state:update', timerState);
        }
        return NextResponse.json({
          success: true,
          command: type,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'update_config': {
        io.to(`device:${deviceId}`).emit('config:update', payload || {});
        return NextResponse.json({
          success: true,
          command: type,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'reboot': {
        io.to(`device:${deviceId}`).emit('reboot');
        return NextResponse.json({
          success: true,
          command: type,
          dispatchedAt: new Date().toISOString(),
        });
      }

      case 'check_update': {
        io.to(`device:${deviceId}`).emit('update:check');
        return NextResponse.json({
          success: true,
          command: type,
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
        io.to(`device:${deviceId}`).emit('update:install', version);
        return NextResponse.json({
          success: true,
          command: type,
          version,
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
