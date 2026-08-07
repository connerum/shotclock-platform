import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const deviceId = String(process.env.DEVICE_ID || '').trim();
  const token = String(process.env.DEVICE_AUTH_TOKEN || '');
  if (!/^shotclock-[a-zA-Z0-9_-]{4,64}$/.test(deviceId)) throw new Error('DEVICE_ID is invalid');
  if (token.length < 32) throw new Error('DEVICE_AUTH_TOKEN must be at least 32 characters');
  const authTokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
  const device = await prisma.device.update({
    where: { deviceId },
    data: { authTokenHash },
    select: { deviceId: true, name: true },
  });
  console.log(JSON.stringify(device));
}

main().finally(() => prisma.$disconnect());
