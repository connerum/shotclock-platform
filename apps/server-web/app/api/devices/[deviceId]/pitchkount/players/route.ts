import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { canAccessDevice, requireApiUser } from '@/lib/auth';
import {
  buildPitchKountPlayerPayload,
  clampPitchKountPlayers,
  mergePitchKountDisplayState,
  normalizePitchKountSavedPlayers,
  parsePitchKountDisplayState,
  serializePitchKountDisplayState,
  PITCHKOUNT_PLAYERS_STORAGE_KEY,
} from '@/lib/pitchkount-players';
import { normalizePitchKountState, type PitchKountState } from '@shotclock/shared/types';

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

    const displayState = parsePitchKountDisplayState(device.displayState);
    const players = normalizePitchKountSavedPlayers(displayState?.[PITCHKOUNT_PLAYERS_STORAGE_KEY], Date.now());

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
      select: { ownerUserId: true, displayState: true },
    });

    if (!existing || !canAccessDevice(auth, existing)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const normalizedState = parsePlayerPayloadState(body);
    if (!normalizedState) {
      return NextResponse.json({ error: 'Missing or invalid pitcher state' }, { status: 400 });
    }

    const displayState = parsePitchKountDisplayState(existing.displayState);
    const now = Date.now();
    const players = clampPitchKountPlayers(normalizePitchKountSavedPlayers(displayState?.[PITCHKOUNT_PLAYERS_STORAGE_KEY], now));
    const nextPlayer = buildPitchKountPlayerPayload(normalizedState, now, randomUUID());
    const updatedPlayers = [nextPlayer, ...players];

    const nextDisplayState = mergePitchKountDisplayState(
      displayState,
      { [PITCHKOUNT_PLAYERS_STORAGE_KEY]: updatedPlayers }
    );

    await prisma.device.update({
      where: { deviceId },
      data: {
        displayState: serializePitchKountDisplayState(nextDisplayState),
      },
    });

    return NextResponse.json({ success: true, player: nextPlayer }, { status: 201 });
  } catch (error) {
    console.error('Error creating PitchKount player:', error);
    return NextResponse.json({ error: 'Failed to save PitchKount player' }, { status: 500 });
  }
}

function parsePlayerPayloadState(rawBody: { [key: string]: unknown }): PitchKountState | null {
  const state = normalizePitchKountState(rawBody.state ?? rawBody.pitchKount);
  return state ? state : null;
}
