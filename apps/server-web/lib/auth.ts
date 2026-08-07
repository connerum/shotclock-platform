import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { prisma } from './prisma';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'courtcast_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const DEVELOPMENT_SESSION_SECRET = 'courtcast-local-development-session-secret-change-me';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  mustChangePassword: boolean;
}

interface SessionClaims {
  userId: string;
  expiresAt: number;
  sessionVersion: number;
}

export function isSuperUser(user: AuthUser | null | undefined): boolean {
  return user?.role === 'super';
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, passwordHash: string | null): Promise<boolean> {
  if (!passwordHash) return false;

  const [scheme, salt, expectedHex] = passwordHash.split('$');
  if (scheme !== 'scrypt' || !salt || !/^[a-f0-9]+$/i.test(expectedHex || '')) return false;

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true, isActive: true },
  });
  if (!user?.isActive) throw new Error('Cannot create a session for an inactive user');

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${userId}.${expiresAt}.${user.sessionVersion}`;
  const signature = sign(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: 'high',
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    priority: 'high',
  });
}

export async function authenticateSessionValue(session: string | undefined): Promise<AuthUser | null> {
  const claims = verifySession(session);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      sessionVersion: true,
    },
  });

  if (!user?.isActive || user.sessionVersion !== claims.sessionVersion) return null;
  const { isActive: _isActive, sessionVersion: _sessionVersion, ...authUser } = user;
  return authUser;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return authenticateSessionValue(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireApiUser(): Promise<AuthUser | Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'Authentication required' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return user;
}

export function canAccessDevice(user: AuthUser, device: { ownerUserId: string | null }): boolean {
  return isSuperUser(user) || device.ownerUserId === user.id;
}

export function scopedDeviceWhere(user: AuthUser) {
  return isSuperUser(user) ? {} : { ownerUserId: user.id };
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function verifyDeviceToken(token: string, expectedHash: string | null | undefined): boolean {
  if (!token || !expectedHash) return false;
  return safeEqual(hashDeviceToken(token), expectedHash);
}

export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    if (name === SESSION_COOKIE) return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return undefined;
}

function verifySession(session: string | undefined): SessionClaims | null {
  if (!session) return null;

  const parts = session.split('.');
  if (parts.length !== 4) return null;

  const [userId, expiresAtRaw, sessionVersionRaw, signature] = parts;
  const payload = `${userId}.${expiresAtRaw}.${sessionVersionRaw}`;
  if (!safeEqual(signature, sign(payload))) return null;

  const expiresAt = Number(expiresAtRaw);
  const sessionVersion = Number(sessionVersionRaw);
  if (!userId || !Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;
  if (!Number.isInteger(sessionVersion) || sessionVersion < 1) return null;

  return { userId, expiresAt, sessionVersion };
}

function sign(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function getSessionSecret(): string {
  const configured = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== 'production') return DEVELOPMENT_SESSION_SECRET;
  throw new Error('AUTH_SECRET must be set to at least 32 characters in production');
}
