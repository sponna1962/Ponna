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

  // ── Exam Taxonomy: Authority → Category → Sub-Category ──────────────────
  // TNPSC gets the full structure since that's where question upload starts;
  // every other Authority is seeded by name only — their Categories/
  // Sub-Categories get added from the admin panel once questions for them
  // start being added (no schema change needed when that happens).

  const tnpsc = await prisma.examAuthority.upsert({
    where: { name: 'TNPSC' },
    create: { name: 'TNPSC' },
    update: {},
  });

  async function seedCategory(authorityId: string, categoryName: string, subCategoryNames: string[]) {
    const category = await prisma.examCategory.upsert({
      where: { authorityId_name: { authorityId, name: categoryName } },
      create: { authorityId, name: categoryName },
      update: {},
    });
    for (const subName of subCategoryNames) {
      await prisma.examSubCategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: subName } },
        create: { categoryId: category.id, name: subName },
        update: {},
      });
    }
  }

  await seedCategory(tnpsc.id, 'Group Examinations', [
    'Group I', 'Group I-B', 'Group I-C', 'Group II', 'Group IIA', 'Group III', 'Group IV',
  ]);
  await seedCategory(tnpsc.id, 'Technical Services', [
    'Interview Posts', 'Non-Interview Posts', 'Diploma / ITI Level',
  ]);
  await seedCategory(tnpsc.id, 'Other / Special Examinations', []); // Sub-Category optional here — exact exam via examName field instead

  const otherAuthorities = [
    'UPSC', 'SSC', 'Railway / RRB', 'Banking', 'TNUSRB', 'TRB', 'NEET', 'Teacher Eligibility', 'Other',
  ];
  for (const name of otherAuthorities) {
    await prisma.examAuthority.upsert({ where: { name }, create: { name }, update: {} });
  }

  console.log('Seed complete.');
}

main().finally(() => prisma.$disconnect());
