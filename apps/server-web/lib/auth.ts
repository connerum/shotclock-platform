import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { prisma } from './prisma';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'courtcast_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const SUPER_EMAIL = 'conner@two-a-days.com';
const SUPER_PASSWORD_HASH = 'scrypt$c08bb51ccf775ce870a35aa319ee64ab$2280386d0fec5f8a509f56ede73cb3886124483e35873a091c45aedab4774a1bf0f201b17165bf46fd59eb9194e58b41b55641a71b90688495af2e5bcdd5870b';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
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
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function ensureSuperUser(): Promise<void> {
  await prisma.user.upsert({
    where: { email: SUPER_EMAIL },
    update: {
      passwordHash: SUPER_PASSWORD_HASH,
      name: 'CourtCast Super Admin',
      role: 'super',
    },
    create: {
      email: SUPER_EMAIL,
      passwordHash: SUPER_PASSWORD_HASH,
      name: 'CourtCast Super Admin',
      role: 'super',
    },
  });
}

export async function createSession(userId: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const signature = sign(payload);

  cookies().set(SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSession(): void {
  cookies().set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  await ensureSuperUser();

  const session = cookies().get(SESSION_COOKIE)?.value;
  const userId = verifySession(session);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });

  return user;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requireApiUser(): Promise<AuthUser | Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }
  return user;
}

export function canAccessDevice(user: AuthUser, device: { ownerUserId: string | null }): boolean {
  return isSuperUser(user) || device.ownerUserId === user.id;
}

export function scopedDeviceWhere(user: AuthUser) {
  return isSuperUser(user) ? {} : { ownerUserId: user.id };
}

function verifySession(session: string | undefined): string | null {
  if (!session) return null;

  const parts = session.split('.');
  if (parts.length !== 3) return null;

  const [userId, expiresAtRaw, signature] = parts;
  const payload = `${userId}.${expiresAtRaw}`;
  const expected = sign(payload);

  if (!safeEqual(signature, expected)) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;

  return userId;
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
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.SERVER_URL || 'courtcast-dev-session-secret';
}
