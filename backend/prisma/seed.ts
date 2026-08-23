// Seeds the Plan table and PlatformSettings with the launch defaults agreed
// in the requirements document. Run with: npx ts-node prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  await prisma.plan.upsert({
    where: { code: 'FREE' },
    create: { code: 'FREE', name: 'Free', dailyLimit: 5, cycleLimit: null },
    update: {},
  });
  await prisma.plan.upsert({
    where: { code: 'PLAN_20' },
    create: { code: 'PLAN_20', name: 'Plan 20', dailyLimit: null, cycleLimit: 600, cycleDays: 30 },
    update: {},
  });
  await prisma.plan.upsert({
    where: { code: 'PLAN_50' },
    create: { code: 'PLAN_50', name: 'Plan 50', dailyLimit: null, cycleLimit: 1500, cycleDays: 30 },
    update: {},
  });

  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' }, // all fields have defaults matching the requirements doc
    update: {},
  });

  // Seed a first Super Admin so there's a way into the admin panel on a fresh DB.
  // CHANGE THIS PASSWORD before deploying anywhere real.
  const existingSuperAdmin = await prisma.staffUser.findUnique({ where: { email: 'admin@ponna.in' } });
  if (!existingSuperAdmin) {
    await prisma.staffUser.create({
      data: {
        email: 'admin@ponna.in',
        passwordHash: await bcrypt.hash('changeme123', 10),
        role: 'SUPER_ADMIN',
      },
    });
    console.log('Seeded Super Admin: admin@ponna.in / changeme123 — CHANGE THIS PASSWORD');
  }

  console.log('Seed complete.');
}

main().finally(() => prisma.$disconnect());
