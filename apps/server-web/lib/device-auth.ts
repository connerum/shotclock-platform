import { timingSafeEqual } from 'crypto';
import { hashDeviceToken } from './auth';

export function getBearerToken(request: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  const token = match?.[1]?.trim() || '';
  return token.length >= 32 && token.length <= 512 ? token : null;
}

export function tokenMatchesHash(token: string | null, expectedHash: string | null | undefined): boolean {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashDeviceToken(token));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
