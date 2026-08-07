import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, isSuperUser, requireApiUser } from '@/lib/auth';
import { getRequestIp, writeAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, requireJson } from '@/lib/request-security';

interface RouteParams { params: Promise<{ userId: string }> }

export async function PATCH(request: NextRequest, context: RouteParams) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  if (!isSuperUser(auth)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  const limited = enforceRateLimit(request, 'admin-update-user', 30, 60 * 60 * 1000);
  if (limited) return limited;
  const invalidContentType = requireJson(request);
  if (invalidContentType) return invalidContentType;

  const { userId } = await context.params;
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const body = await request.json();
  const action = String(body.action || '');

  if (action === 'reset-password') {
    const password = String(body.password || '');
    if (password.length < 12) return NextResponse.json({ error: 'Temporary password must be at least 12 characters' }, { status: 400 });
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        isActive: true,
        sessionVersion: { increment: 1 },
      },
    });
  } else if (action === 'disable') {
    if (userId === auth.id) return NextResponse.json({ error: 'You cannot disable your own account' }, { status: 400 });
    if (target.role === 'super') {
      const activeAdmins = await prisma.user.count({ where: { role: 'super', isActive: true } });
      if (activeAdmins <= 1) return NextResponse.json({ error: 'The last active administrator cannot be disabled' }, { status: 400 });
    }
    await prisma.user.update({ where: { id: userId }, data: { isActive: false, sessionVersion: { increment: 1 } } });
  } else if (action === 'enable') {
    await prisma.user.update({ where: { id: userId }, data: { isActive: true, sessionVersion: { increment: 1 } } });
  } else {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  await writeAuditLog({
    actor: auth,
    action: `admin.user_${action.replace('-', '_')}`,
    targetType: 'User',
    targetId: userId,
    details: { email: target.email },
    ipAddress: getRequestIp(request),
  });
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
