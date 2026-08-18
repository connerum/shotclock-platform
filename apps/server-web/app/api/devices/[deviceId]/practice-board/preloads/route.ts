import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessDevice, requireApiUser } from '@/lib/auth';
import {
  type PracticeBoardAssignment,
  type PracticeBoardDrill,
  type PracticeBoardPosition,
  type PracticeBoardSavedPreload,
  type PracticeBoardState,
} from '@shotclock/shared/types';

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PRACTICE_BOARD_PRELOAD_LIMIT = 50;
const MAX_DRILLS_PER_UNIT = 12;
const MAX_ASSIGNMENTS_PER_DRILL = 12;
const PRACTICE_BOARD_POSITIONS: PracticeBoardPosition[] = ['ALL', 'QB', 'WR', 'RB', 'TE', 'OL', 'DL', 'LB', 'Safety', 'Nickel', 'Corner', 'Other'];

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;

    const { deviceId } = await params;
    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const preloads = await prisma.savedPracticeBoardPreload.findMany({
      where: { ownerUserId: auth.id },
      orderBy: { updatedAt: 'desc' },
      take: PRACTICE_BOARD_PRELOAD_LIMIT,
    });

    const normalized = preloads
      .map((preload: { id: string; name: string; board: string; createdAt: Date; updatedAt: Date }) => normalizePracticeBoardPreload(preload))
      .filter(
        (preload: PracticeBoardSavedPreload | null): preload is PracticeBoardSavedPreload => preload !== null
      );

    return NextResponse.json({ preloads: normalized });
  } catch (error) {
    console.error('Error fetching Practice Board preloads:', error);
    return NextResponse.json({ error: 'Failed to fetch Practice Board preloads' }, { status: 500 });
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

    const device = await prisma.device.findUnique({
      where: { deviceId },
      select: { ownerUserId: true },
    });

    if (!device || !canAccessDevice(auth, device)) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const boardPayload = parsePreloadBoardPayload(body);
    if (!boardPayload) {
      return NextResponse.json({ error: 'Missing or invalid practice board' }, { status: 400 });
    }

    const preloadName = normalizePreloadName(body.name, boardPayload);

    const created = await prisma.savedPracticeBoardPreload.create({
      data: {
        ownerUserId: auth.id,
        name: preloadName,
        board: JSON.stringify(boardPayload),
      },
    });

    await prunePracticeBoardPreloads(auth.id);

    return NextResponse.json({
      success: true,
      preload: buildPracticeBoardPreloadPayload(created.id, preloadName, boardPayload, created.createdAt, created.updatedAt),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating Practice Board preload:', error);
    return NextResponse.json({ error: 'Failed to save Practice Board preload' }, { status: 500 });
  }
}

function parsePreloadBoardPayload(body: Record<string, unknown>): PracticeBoardState | null {
  const candidate = body.board ?? body.practiceBoard ?? body.state;
  return normalizePracticeBoardState(candidate) || normalizePracticeBoardState(body);
}

function normalizePreloadName(name: unknown, board: PracticeBoardState): string {
  if (typeof name === 'string') {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (trimmed) return trimmed.slice(0, 64);
  }

  const periodCount = board.drills.length;
  return `Practice board · ${periodCount} period${periodCount === 1 ? '' : 's'}`.slice(0, 64);
}

function normalizePracticeBoardPreload(preload: {
  id: string;
  name: string;
  board: string;
  createdAt: Date;
  updatedAt: Date;
}): PracticeBoardSavedPreload | null {
  const parsedBoard = parsePracticeBoardPayload(preload.board);
  if (!parsedBoard) return null;

  return {
    id: preload.id,
    name: preload.name.trim(),
    board: parsedBoard,
    createdAt: preload.createdAt.getTime(),
    updatedAt: preload.updatedAt.getTime(),
  };
}

function parsePracticeBoardPayload(raw: string): PracticeBoardState | null;
function parsePracticeBoardPayload(raw: unknown): PracticeBoardState | null {
  if (typeof raw === 'string') {
    return parseJsonToPracticeBoard(raw);
  }
  return normalizePracticeBoardState(raw);
}

function parseJsonToPracticeBoard(raw: string): PracticeBoardState | null {
  const parsed = parseJson(raw);
  return parsed ? normalizePracticeBoardState(parsed) : null;
}

function normalizePracticeBoardState(value: unknown): PracticeBoardState | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const rawDrills = Array.isArray(raw.drills) ? raw.drills : [];
  const drills = normalizePracticeDrills(rawDrills);

  const timerStatus = raw.timerStatus === 'running' || raw.timerStatus === 'paused' || raw.timerStatus === 'complete'
    ? raw.timerStatus
    : 'idle';
  const remainingSeconds = normalizePracticeDuration(raw.remainingSeconds);
  const activeDrillId = typeof raw.activeDrillId === 'string' && raw.activeDrillId
    ? raw.activeDrillId
    : undefined;
  const startedAt = normalizePracticeTimestamp(raw.startedAt);
  const overviewUntil = normalizePracticeTimestamp(raw.overviewUntil);

  const normalized: PracticeBoardState = {
    drills,
    timerStatus,
    remainingSeconds,
    ...(activeDrillId && drills.some((drill) => drill.id === activeDrillId) ? { activeDrillId } : {}),
    ...(typeof startedAt === 'number' ? { startedAt } : {}),
    ...(typeof overviewUntil === 'number' ? { overviewUntil } : {}),
    ...(typeof raw.schoolLogoUrl === 'string' && raw.schoolLogoUrl.trim()
      ? { schoolLogoUrl: raw.schoolLogoUrl.trim().slice(0, 512) }
      : {}),
    ...(raw.weather ? { weather: normalizePracticeWeather(raw.weather) } : {}),
  };

  if (normalized.weather === undefined) {
    delete (normalized as { weather?: PracticeBoardState['weather'] }).weather;
  }

  return normalized;
}

function normalizePracticeDrills(rawDrills: unknown[]): PracticeBoardDrill[] {
  if (!Array.isArray(rawDrills)) return [];

  const mapped = rawDrills
    .map((item, index) => normalizePracticeDrill(item, index))
    .filter((drill): drill is PracticeBoardDrill => drill !== null);

  const offense = mapped.filter((drill) => drill.unit === 'offense').slice(0, MAX_DRILLS_PER_UNIT);
  const defense = mapped.filter((drill) => drill.unit === 'defense').slice(0, MAX_DRILLS_PER_UNIT);

  return [...offense, ...defense];
}

function normalizePracticeDrill(raw: unknown, fallbackIndex: number): PracticeBoardDrill | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawDrill = raw as Record<string, unknown>;

  const id = normalizePracticeBoardString(rawDrill.id, 64) || `drill-${fallbackIndex + 1}`;
  const title = normalizePracticeBoardString(rawDrill.title, 48);
  const durationSeconds = normalizePracticeDuration(rawDrill.durationSeconds);
  const unit = rawDrill.unit === 'defense' ? 'defense' : 'offense';
  const assignments = normalizePracticeAssignments(rawDrill.assignments);

  return {
    id,
    unit,
    title,
    durationSeconds,
    assignments,
  };
}

function normalizePracticeAssignments(rawAssignments: unknown): PracticeBoardAssignment[] {
  if (!Array.isArray(rawAssignments)) return [];

  return rawAssignments
    .map((rawAssignment, index) => normalizePracticeAssignment(rawAssignment, index))
    .filter((assignment): assignment is PracticeBoardAssignment => assignment !== null)
    .slice(0, MAX_ASSIGNMENTS_PER_DRILL);
}

function normalizePracticeAssignment(raw: unknown, fallbackIndex: number): PracticeBoardAssignment | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawAssignment = raw as Record<string, unknown>;

  const candidatePosition = rawAssignment.position as PracticeBoardPosition;
  const position = PRACTICE_BOARD_POSITIONS.includes(candidatePosition) ? candidatePosition : 'ALL';
  const drillName = normalizePracticeBoardString(rawAssignment.drillName, 64);
  const customPosition = position === 'Other' ? normalizePracticeBoardString(rawAssignment.customPosition, 16) : undefined;

  return {
    id: normalizePracticeBoardString(rawAssignment.id, 64) || `assignment-${fallbackIndex + 1}`,
    position,
    ...(customPosition ? { customPosition } : {}),
    drillName,
  };
}

function normalizePracticeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : undefined;
}

function normalizePracticeDuration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(99 * 60 + 59, Math.round(value)));
}

function normalizePracticeBoardString(value: unknown, maxLength = 1_000): string {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function normalizePracticeWeather(value: unknown): PracticeBoardState['weather'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;

  const locationLabel = normalizePracticeBoardString(raw.locationLabel, 64);
  const temperatureF = typeof raw.temperatureF === 'number' && Number.isFinite(raw.temperatureF)
    ? raw.temperatureF
    : NaN;
  const wetBulbF = typeof raw.wetBulbF === 'number' && Number.isFinite(raw.wetBulbF)
    ? raw.wetBulbF
    : NaN;
  const description = normalizePracticeBoardString(raw.description, 64);
  const weatherCode = typeof raw.weatherCode === 'number' && Number.isFinite(raw.weatherCode)
    ? Math.trunc(raw.weatherCode)
    : NaN;
  const observedAt = normalizePracticeBoardString(raw.observedAt, 80);

  if (
    !locationLabel ||
    !description ||
    !Number.isFinite(temperatureF) ||
    !Number.isFinite(wetBulbF) ||
    !Number.isFinite(weatherCode) ||
    !observedAt
  ) {
    return undefined;
  }

  return {
    locationLabel,
    timezone: normalizePracticeBoardString(raw.timezone, 64) || 'UTC',
    temperatureF,
    wetBulbF,
    description,
    weatherCode,
    observedAt,
  };
}

function parseJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildPracticeBoardPreloadPayload(
  id: string,
  name: string,
  board: PracticeBoardState,
  createdAt: Date,
  updatedAt: Date,
): PracticeBoardSavedPreload {
  return {
    id,
    name,
    board,
    createdAt: createdAt.getTime(),
    updatedAt: updatedAt.getTime(),
  };
}

async function prunePracticeBoardPreloads(ownerUserId: string) {
  const excess = await prisma.savedPracticeBoardPreload.findMany({
    where: { ownerUserId },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    skip: PRACTICE_BOARD_PRELOAD_LIMIT,
  });

  if (!excess.length) return;

  await prisma.savedPracticeBoardPreload.deleteMany({
    where: {
      ownerUserId,
      id: { in: excess.map((entry: { id: string }) => entry.id) },
    },
  });
}
