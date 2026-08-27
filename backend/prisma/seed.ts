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

  // ── Exam Taxonomy: Purpose → Authority → Category → Sub-Category ────────
  // Purposes keep unrelated exam families apart (finalized requirement) — an
  // "All" chosen inside one Purpose never pulls in Authorities from another.
  // TNPSC gets the full Category/Sub-Category structure since that's where
  // question upload starts; every other Authority is seeded by name only —
  // their Categories/Sub-Categories get added from the admin panel once
  // questions for them start being added (no schema change needed then).

  const employmentPurpose = await prisma.examPurpose.upsert({
    where: { name: 'Employment / Recruitment Exams' },
    create: { name: 'Employment / Recruitment Exams', nameTa: 'வேலைவாய்ப்பு / ஆட்சேர்ப்புத் தேர்வுகள்' },
    update: {},
  });
  const educationPurpose = await prisma.examPurpose.upsert({
    where: { name: 'Higher Education / Admission Exams' },
    create: { name: 'Higher Education / Admission Exams', nameTa: 'உயர்கல்வி / சேர்க்கைத் தேர்வுகள்' },
    update: {},
  });
  const eligibilityPurpose = await prisma.examPurpose.upsert({
    where: { name: 'Eligibility / Qualification Exams' },
    create: { name: 'Eligibility / Qualification Exams', nameTa: 'தகுதி / அருகதைத் தேர்வுகள்' },
    update: {},
  });

  // One-time backfill: Authorities created before ExamPurpose existed have
  // purposeId = null. Assign each to the right Purpose by name so the
  // upserts below find and update them in place, instead of creating
  // duplicate rows alongside the old orphaned ones.
  const purposeForExistingAuthority: Record<string, string> = {
    NEET: educationPurpose.id,
    'Teacher Eligibility': eligibilityPurpose.id,
    // everything else (TNPSC, UPSC, SSC, Railway / RRB, Banking, TNUSRB, TRB, Other) → Employment/Recruitment
  };
  const orphanedAuthorities = await prisma.examAuthority.findMany({ where: { purposeId: null } });
  for (const orphan of orphanedAuthorities) {
    const targetPurposeId = purposeForExistingAuthority[orphan.name] ?? employmentPurpose.id;
    await prisma.examAuthority.update({ where: { id: orphan.id }, data: { purposeId: targetPurposeId } });
  }

  async function seedAuthority(purposeId: string, name: string) {
    return prisma.examAuthority.upsert({
      where: { purposeId_name: { purposeId, name } },
      create: { purposeId, name },
      update: {},
    });
  }

  const tnpsc = await seedAuthority(employmentPurpose.id, 'TNPSC');

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

  // Employment / Recruitment — name-only for now
  for (const name of ['UPSC', 'SSC', 'Railway / RRB', 'Banking', 'TNUSRB', 'TRB']) {
    await seedAuthority(employmentPurpose.id, name);
  }
  // Higher Education / Admission
  await seedAuthority(educationPurpose.id, 'NEET');
  // Eligibility / Qualification
  await seedAuthority(eligibilityPurpose.id, 'Teacher Eligibility');

  // Mark the QA/testing phone number as a Test Account — bypasses quota,
  // excluded from rankings. Safe to re-run: no-op if the user hasn't logged
  // in yet (created on first Firebase login, not here), and idempotent
  // once they have.
  await prisma.user.updateMany({
    where: { phone: '+919489000123' },
    data: { isTestAccount: true },
  });

  console.log('Seed complete.');
}

main().finally(() => prisma.$disconnect());
