import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Production-safe by design: never create shared passwords, predictable pairing
  // codes, fake devices, or invalid release records. Bootstrap an administrator
  // explicitly with `pnpm user:manage` and environment-provided credentials.
  await prisma.$queryRaw`SELECT 1`;
  console.log('Database is reachable. No default users or devices were created.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
