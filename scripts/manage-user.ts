import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'crypto';
import { promisify } from 'util';

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}

async function main() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = String(process.env.ADMIN_NAME || 'CourtCast Administrator').trim();
  const role = process.env.ADMIN_ROLE === 'user' ? 'user' : 'super';
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('ADMIN_EMAIL must be a valid email');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: await hashPassword(password),
      name,
      role,
      isActive: true,
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
    create: {
      email,
      passwordHash: await hashPassword(password),
      name,
      role,
      isActive: true,
      mustChangePassword: true,
    },
    select: { id: true, email: true, role: true, isActive: true },
  });
  console.log(JSON.stringify(user));
}

main().finally(() => prisma.$disconnect());
