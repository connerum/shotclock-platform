import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.SHOTCLOCK_VERSION || '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
