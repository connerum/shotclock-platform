import { NextResponse } from 'next/server';
import { stat } from 'fs/promises';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';

    const backupStatusFile = process.env.BACKUP_STATUS_FILE;
    if (backupStatusFile) {
      const status = await stat(backupStatusFile);
      const ageHours = (Date.now() - status.mtimeMs) / 3_600_000;
      if (ageHours > 36) throw new Error(`latest backup is ${ageHours.toFixed(1)} hours old`);
      checks.backup = 'ok';
    } else {
      checks.backup = 'not-configured';
    }

    return NextResponse.json({ status: 'ready', checks }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'readiness check failed';
    return NextResponse.json({ status: 'not-ready', checks, error: message }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
