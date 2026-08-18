import { normalizePitchKountState, type PitchKountSavedPlayer, type PitchKountState } from '@shotclock/shared/types';

export const PITCHKOUNT_PLAYERS_STORAGE_KEY = 'pitchKountPlayers';
export const PITCHKOUNT_PLAYERS_LIMIT = 50;

interface RawPitchKountSavedPlayer {
  id?: unknown;
  state?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function parsePitchKountDisplayState(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function serializePitchKountDisplayState(state: Record<string, unknown>): string {
  return JSON.stringify(state);
}

export function extractPitchKountPlayers(displayState: Record<string, unknown> | null): PitchKountSavedPlayer[] {
  return normalizePitchKountSavedPlayers(displayState?.[PITCHKOUNT_PLAYERS_STORAGE_KEY], Date.now());
}

export function normalizePitchKountSavedPlayers(
  value: unknown,
  now = Date.now()
): PitchKountSavedPlayer[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw, index) => normalizePitchKountSavedPlayer(raw, now, index))
    .filter((player): player is PitchKountSavedPlayer => player !== null);
}

export function normalizePitchKountSavedPlayer(
  value: unknown,
  now = Date.now(),
  fallbackIndex = 0
): PitchKountSavedPlayer | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as RawPitchKountSavedPlayer;
  const normalizedState = normalizePitchKountState(raw.state as unknown);
  const id = normalizePitchKountPlayerId(raw.id);

  const fallbackId = `legacy-player-${now}-${fallbackIndex}`;

  if (!id) return {
    id: fallbackId,
    state: normalizedState,
    createdAt: normalizeTimestamp(raw.createdAt, now),
    updatedAt: normalizeTimestamp(raw.updatedAt, now),
  };

  return {
    id,
    state: normalizedState,
    createdAt: normalizeTimestamp(raw.createdAt, now),
    updatedAt: normalizeTimestamp(raw.updatedAt, now),
  };
}

export function clampPitchKountPlayers(players: PitchKountSavedPlayer[]): PitchKountSavedPlayer[] {
  return players
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, PITCHKOUNT_PLAYERS_LIMIT);
}

export function buildPitchKountPlayerPayload(
  state: PitchKountState,
  now = Date.now(),
  id?: string
): PitchKountSavedPlayer {
  const playerState = normalizePitchKountState(state);
  return {
    id: id || `player-${now}-${Math.floor(Math.random() * 10000)}`,
    state: playerState,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergePitchKountDisplayState(
  current: Record<string, unknown> | null,
  next: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(current ?? {}),
    ...next,
  };
}

function normalizePitchKountPlayerId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return id.length > 0 && id.length <= 128 ? id : null;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized < 0 ? fallback : normalized;
}
