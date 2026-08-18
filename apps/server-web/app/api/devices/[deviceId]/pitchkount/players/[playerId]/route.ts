import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessDevice, requireApiUser } from '@/lib/auth';
import {
  clampPitchKountPlayers,
  mergePitchKountDisplayState,
  normalizePitchKountSavedPlayers,
  parsePitchKountDisplayState,
  serializePitchKountDisplayState,
  PITCHKOUNT_PLAYERS_STORAGE_KEY,
} from '@/lib/pitchkount-players';
import { normalizePitchKountState, type PitchKountState } from '@shotclock/shared/types';

interface RouteParams {
  params: Promise<{ deviceId: string; playerId: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId, playerId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const playerIdValue = normalizePlayerId(playerId);
    if (!playerIdValue) {
      return NextResponse.json({ error: 'Invalid player identifier' }, { status: 400 });
    }

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true, displayState: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const normalizedState = parsePlayerPayloadState(body);
    if (!normalizedState) {
      return NextResponse.json({ error: 'Missing or invalid pitcher state' }, { status: 400 });
    }

    const players = normalizePitchKountSavedPlayers(device.displayState ? parsePitchKountDisplayState(device.displayState)?.[PITCHKOUNT_PLAYERS_STORAGE_KEY] : null, Date.now());
    const now = Date.now();
    const playerIndex = players.findIndex((player) => player.id === playerIdValue);

    if (playerIndex === -1) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const updatedPlayer = {
      ...players[playerIndex],
      state: normalizedState,
      updatedAt: now,
    };
    players[playerIndex] = updatedPlayer;

    const nextDisplayState = mergePitchKountDisplayState(
      parsePitchKountDisplayState(device.displayState),
      { [PITCHKOUNT_PLAYERS_STORAGE_KEY]: clampPitchKountPlayers(players) }
    );

    await prisma.device.update({
      where: { deviceId },
      data: {
        displayState: serializePitchKountDisplayState(nextDisplayState),
      },
    });

    return NextResponse.json({ success: true, player: updatedPlayer });
  } catch (error) {
    console.error('Error updating PitchKount player:', error);
    return NextResponse.json({ error: 'Failed to update PitchKount player' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId, playerId } = await params;
    const playerIdValue = normalizePlayerId(playerId);

    if (!playerIdValue) {
      return NextResponse.json({ error: 'Invalid player identifier' }, { status: 400 });
    }

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true, displayState: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const players = normalizePitchKountSavedPlayers(
      parsePitchKountDisplayState(device.displayState)?.[PITCHKOUNT_PLAYERS_STORAGE_KEY],
      Date.now()
    );
    const nextPlayers = players.filter((player) => player.id !== playerIdValue);

    if (nextPlayers.length === players.length) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const nextDisplayState = mergePitchKountDisplayState(
      parsePitchKountDisplayState(device.displayState),
      { [PITCHKOUNT_PLAYERS_STORAGE_KEY]: nextPlayers }
    );

    await prisma.device.update({
      where: { deviceId },
      data: {
        displayState: serializePitchKountDisplayState(nextDisplayState),
      },
    });

    return NextResponse.json({ success: true, removedPlayerId: playerIdValue });
  } catch (error) {
    console.error('Error deleting PitchKount player:', error);
    return NextResponse.json({ error: 'Failed to delete PitchKount player' }, { status: 500 });
  }
}

function parsePlayerPayloadState(rawBody: { [key: string]: unknown }): PitchKountState | null {
  const state = normalizePitchKountState(rawBody.state ?? rawBody.pitchKount);
  return state ? state : null;
}

function normalizePlayerId(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 128 ? normalized : null;
}
