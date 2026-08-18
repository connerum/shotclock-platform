import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessDevice, requireApiUser } from '@/lib/auth';
import {
  buildPitchKountPlayerPayload,
  PITCHKOUNT_PLAYERS_LIMIT,
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
      select: { ownerUserId: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const normalizedState = parsePlayerPayloadState(body);
    if (!normalizedState) {
      return NextResponse.json({ error: 'Missing or invalid pitcher state' }, { status: 400 });
    }

    const updatedProfile = await prisma.savedPitchKountProfile.findUnique({
      where: { id: playerIdValue },
      select: { ownerUserId: true },
    });

    if (!updatedProfile || updatedProfile.ownerUserId !== auth.id) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const payload = buildPitchKountPlayerPayload(normalizedState, Date.now(), playerIdValue);
    const profile = await prisma.savedPitchKountProfile.update({
      where: { id: playerIdValue },
      data: {
        name: `${payload.state.pitcherName || 'Pitcher'} #${payload.state.pitcherNumber}`.trim().slice(0, 64),
        state: JSON.stringify(payload.state),
      },
    });

    await prunePitchKountProfiles(auth.id);

    return NextResponse.json({
      success: true,
      player: {
        id: profile.id,
        state: payload.state,
        createdAt: profile.createdAt.getTime(),
        updatedAt: profile.updatedAt.getTime(),
      },
    });
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
      select: { ownerUserId: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const removed = await prisma.savedPitchKountProfile.deleteMany({
      where: {
        id: playerIdValue,
        ownerUserId: auth.id,
      },
    });

    if (removed.count === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

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

async function prunePitchKountProfiles(ownerUserId: string) {
  const excess = await prisma.savedPitchKountProfile.findMany({
    where: { ownerUserId },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    skip: PITCHKOUNT_PLAYERS_LIMIT,
  });

  if (!excess.length) return;

  await prisma.savedPitchKountProfile.deleteMany({
    where: {
      ownerUserId,
      id: { in: excess.map((entry: { id: string }) => entry.id) },
    },
  });
}
