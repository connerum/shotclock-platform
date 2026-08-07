import { NextRequest, NextResponse } from 'next/server';
import { createSession, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRequestIp, writeAuditLog } from '@/lib/audit';
import { enforceRateLimit, requireJson } from '@/lib/request-security';

const DUMMY_PASSWORD_HASH = 'scrypt$0bb9970ab817401bd2ece1a2ae30d497$5ce60fb4ff2bb50ae0cf19987fa047dda32b1d85b8ec598bdf1250950b955ea4f6f497024325dc5f6dac96704c54679502b87b2ce6701ae987a68064820dc360';

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, 'login', 8, 15 * 60 * 1000);
    if (limited) return limited;
    const invalidContentType = requireJson(request);
    if (invalidContentType) return invalidContentType;

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const validPassword = await verifyPassword(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
    if (!user?.isActive || !validPassword) {
      await writeAuditLog({
        action: 'auth.login_failed',
        targetType: 'User',
        details: { email },
        ipAddress: getRequestIp(request),
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user.id);
    await writeAuditLog({
      actor: { ...user, mustChangePassword: user.mustChangePassword },
      action: 'auth.login_succeeded',
      targetType: 'User',
      targetId: user.id,
      ipAddress: getRequestIp(request),
    });
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Failed to log in' }, { status: 500 });
  }
}
