import type { AuthUser } from './auth';
import { prisma } from './prisma';

interface AuditInput {
  actor?: AuthUser | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actor?.id || null,
        actorEmail: input.actor?.email || null,
        action: input.action,
        targetType: input.targetType || null,
        targetId: input.targetId || null,
        details: input.details ? JSON.stringify(input.details) : null,
        ipAddress: input.ipAddress || null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || null;
}
