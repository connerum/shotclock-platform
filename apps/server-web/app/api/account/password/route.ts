import { NextRequest, NextResponse } from 'next/server';
import { createSession, hashPassword, requireApiUser, verifyPassword } from '@/lib/auth';
import { getRequestIp, writeAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, requireJson } from '@/lib/request-security';

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const limited = enforceRateLimit(request, 'password-change', 5, 15 * 60 * 1000);
  if (limited) return limited;
  const invalidContentType = requireJson(request);
  if (invalidContentType) return invalidContentType;

  const body = await request.json();
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  if (newPassword.length < 12) {
    return NextResponse.json({ error: 'New password must be at least 12 characters' }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'New password must be different' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: auth.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });
  await createSession(auth.id);
  await writeAuditLog({
    actor: auth,
    action: 'account.password_changed',
    targetType: 'User',
    targetId: auth.id,
    ipAddress: getRequestIp(request),
  });
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
