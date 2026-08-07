import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, isSuperUser, requireApiUser } from '@/lib/auth';
import { getRequestIp, writeAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, requireJson } from '@/lib/request-security';

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  if (!isSuperUser(auth)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { email: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { devices: true } },
    },
  });
  return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  if (!isSuperUser(auth)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  const limited = enforceRateLimit(request, 'admin-create-user', 20, 60 * 60 * 1000);
  if (limited) return limited;
  const invalidContentType = requireJson(request);
  if (invalidContentType) return invalidContentType;

  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || '').trim() || null;
  const role = body.role === 'super' ? 'super' : 'user';
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  if (password.length < 12) return NextResponse.json({ error: 'Temporary password must be at least 12 characters' }, { status: 400 });

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        name,
        role,
        isActive: true,
        mustChangePassword: true,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true },
    });
    await writeAuditLog({
      actor: auth,
      action: 'admin.user_created',
      targetType: 'User',
      targetId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress: getRequestIp(request),
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    console.error('Failed to create user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
