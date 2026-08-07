import { NextRequest, NextResponse } from 'next/server';
import { createSession, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, requireJson } from '@/lib/request-security';

export async function POST(request: NextRequest) {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      return NextResponse.json({ error: 'Public registration is disabled. Contact an administrator.' }, { status: 403 });
    }
    const limited = enforceRateLimit(request, 'register', 3, 60 * 60 * 1000);
    if (limited) return limited;
    const invalidContentType = requireJson(request);
    if (invalidContentType) return invalidContentType;

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim() || null;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 12) {
      return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'user',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    await createSession(user.id);
    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'An account already exists for that email' }, { status: 409 });
    }

    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
