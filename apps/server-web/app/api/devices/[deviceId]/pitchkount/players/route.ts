import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { canAccessDevice, requireApiUser } from '@/lib/auth';
import {
  buildPitchKountPlayerPayload,
  normalizePitchKountSavedPlayers,
  parsePitchKountDisplayState,
  PITCHKOUNT_PLAYERS_STORAGE_KEY,
  PITCHKOUNT_PLAYERS_LIMIT,
} from '@/lib/pitchkount-players';
import { normalizePitchKountState, type PitchKountSavedPlayer, type PitchKountState } from '@shotclock/shared/types';

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = await params;

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true, displayState: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const now = Date.now();
    const [dbPlayers, count] = await Promise.all([
      prisma.savedPitchKountProfile.findMany({
        where: { ownerUserId: auth.id },
        orderBy: { updatedAt: 'desc' },
        take: PITCHKOUNT_PLAYERS_LIMIT,
      }),
      prisma.savedPitchKountProfile.count({ where: { ownerUserId: auth.id } }),
    ]);

    let players: PitchKountSavedPlayer[] = dbPlayers
      .map((player: { id: string; state: string; createdAt: Date; updatedAt: Date }) => normalizePitchKountSavedProfile(player))
      .filter(
        (player: PitchKountSavedPlayer | null): player is PitchKountSavedPlayer => player !== null
      );

    // Backward compatibility for legacy device-stored players.
    if (count === 0) {
      const displayState = parsePitchKountDisplayState(device.displayState);
      const legacyPlayers = normalizePitchKountSavedPlayers(displayState?.[PITCHKOUNT_PLAYERS_STORAGE_KEY], now);
      players = legacyPlayers.slice(0, PITCHKOUNT_PLAYERS_LIMIT);
    }

    return NextResponse.json({ players });
  } catch (error) {
    console.error('Error fetching PitchKount players:', error);
    return NextResponse.json({ error: 'Failed to fetch PitchKount players' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const existing = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true },
    });

    if (!existing || !canAccessDevice(auth, existing)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const normalizedState = parsePlayerPayloadState(body);
    if (!normalizedState) {
      return NextResponse.json({ error: 'Missing or invalid pitcher state' }, { status: 400 });
    }

    const nextPlayer = buildPitchKountPlayerPayload(normalizedState, undefined, randomUUID());
    const displayName = `${nextPlayer.state.pitcherName || 'Pitcher'} #${nextPlayer.state.pitcherNumber}`.trim();

    const created = await prisma.savedPitchKountProfile.create({
      data: {
        ownerUserId: auth.id,
        name: displayName.slice(0, 64),
        state: JSON.stringify(nextPlayer.state),
      },
    });
    await prunePitchKountProfiles(auth.id);

    return NextResponse.json({
      success: true,
      player: {
        id: created.id,
        state: nextPlayer.state,
        createdAt: created.createdAt.getTime(),
        updatedAt: created.updatedAt.getTime(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating PitchKount player:', error);
    return NextResponse.json({ error: 'Failed to save PitchKount player' }, { status: 500 });
  }
}

function parsePlayerPayloadState(rawBody: { [key: string]: unknown }): PitchKountState | null {
  const state = normalizePitchKountState(rawBody.state ?? rawBody.pitchKount);
  return state ? state : null;
}

function normalizePitchKountSavedProfile(profile: {
  id: string;
  state: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): PitchKountSavedPlayer | null {
  const state = normalizePitchKountState(parsePitchKountStatePayload(profile.state));
  if (!state) return null;
  return {
    id: profile.id,
    state,
    createdAt: new Date(profile.createdAt).getTime(),
    updatedAt: new Date(profile.updatedAt).getTime(),
  };
}

function parsePitchKountStatePayload(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
      id: { in: excess.map((entry: { id: string }) => entry.id) },
      ownerUserId,
    },
  });
}
