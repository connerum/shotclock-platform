// Prisma seed script for Shotclock Platform

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Demo Organization',
      slug: 'demo-org',
    },
  });
  console.log('Created organization:', org.name);

  // Create Venue
  const venue = await prisma.venue.create({
    data: {
      name: 'Main Gym',
      slug: 'main-gym',
      address: '123 Sports Way',
      organizationId: org.id,
    },
  });
  console.log('Created venue:', venue.name);

  // Create Device (unpaired)
  const device = await prisma.device.create({
    data: {
      name: 'Shotclock Display 1',
      deviceId: 'device-' + Math.random().toString(36).substring(7),
      pairingCode: '123456',
      pairingCodeExp: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      firmwareVersion: '0.1.0',
      controllerType: 'generic',
      displayProfile: JSON.stringify({
        id: 'default-generic',
        name: 'Default Generic Display',
        controllerType: 'generic',
        viewport: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0, scaleX: 1, scaleY: 1 },
        safeZone: { top: 40, right: 40, bottom: 40, left: 40 },
        fontSize: { shotClock: 200, gameClock: 120, score: 150, period: 80, label: 40 },
        colors: {
          background: '#000000',
          foreground: '#ffffff',
          accent: '#00ff00',
          homeTeam: '#ff0000',
          awayTeam: '#0000ff',
          warning: '#ffff00',
          danger: '#ff0000',
        },
      }),
      mode: 'pairing',
      status: 'offline',
      isOnline: false,
      capabilities: JSON.stringify(['shot-clock', 'scoreboard', 'timer', 'media']),
    },
  });
  console.log('Created device:', device.name, 'with pairing code:', device.pairingCode);

  // Create User
  const user = await prisma.user.create({
    data: {
      email: 'admin@shotclock.local',
      name: 'Admin User',
      role: 'admin',
      passwordHash: '$2b$10$placeholder', // Placeholder hash
      organizationId: org.id,
    },
  });
  console.log('Created user:', user.email);

  // Create initial DisplayState for the device
  await prisma.displayState.create({
    data: {
      deviceId: device.deviceId,
      mode: 'pairing',
      timerState: JSON.stringify({
        mode: 'stop',
        homeScore: 0,
        awayScore: 0,
        period: 1,
        shotClock: 24,
        gameClock: 720,
        isRunning: false,
        isPaused: false,
        lastUpdated: Date.now(),
      }),
    },
  });
  console.log('Created initial display state for device');

  // Create sample Firmware Release
  const release = await prisma.firmwareRelease.create({
    data: {
      version: '0.1.0',
      releaseDate: new Date(),
      downloadUrl: 'https://releases.shotclock.local/0.1.0',
      checksum: 'sha256:abc123',
      size: 52428800, // 50MB
      notes: 'Initial release',
      isMandatory: false,
      minServerVersion: '0.1.0',
    },
  });
  console.log('Created firmware release:', release.version);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
