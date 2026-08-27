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

  // Renames a Purpose in place if it exists under an old name (avoids
  // creating a duplicate row via @unique(name) upsert-by-new-name), or
  // creates it fresh on a first deploy. Also keeps nameTa/config in sync on
  // every re-run.
  async function renameOrCreatePurpose(newName: string, oldName: string | null, nameTa: string, allowMultipleAuthorities: boolean) {
    let purpose = await prisma.examPurpose.findUnique({ where: { name: newName } });
    if (!purpose && oldName) {
      const old = await prisma.examPurpose.findUnique({ where: { name: oldName } });
      if (old) purpose = await prisma.examPurpose.update({ where: { id: old.id }, data: { name: newName } });
    }
    if (!purpose) {
      return prisma.examPurpose.create({ data: { name: newName, nameTa, allowMultipleAuthorities } });
    }
    return prisma.examPurpose.update({ where: { id: purpose.id }, data: { nameTa, allowMultipleAuthorities } });
  }

  const employmentPurpose = await renameOrCreatePurpose(
    'Competitive / Employment Exams',
    'Employment / Recruitment Exams',
    'போட்டி / வேலைவாய்ப்புத் தேர்வுகள்',
    true, // multiple Authorities allowed (e.g. TNPSC + UPSC together)
  );
  const educationPurpose = await renameOrCreatePurpose(
    'Higher Education / Entrance Exams',
    'Higher Education / Admission Exams',
    'உயர்கல்வி / நுழைவுத் தேர்வுகள்',
    false, // one Authority only — different entrance exams have unrelated syllabi
  );
  const eligibilityPurpose = await renameOrCreatePurpose(
    'Eligibility / Qualification Exams',
    'Eligibility / Qualification Exams', // name unchanged, still routed through the same helper for consistency
    'தகுதி / அருகதைத் தேர்வுகள்',
    false, // one Authority only, for now
  );

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

  // Rename "Teacher Eligibility" → "TNTET" IN PLACE (finalized requirement —
  // this specifically means Tamil Nadu TET, not a generic authority; renaming
  // in place, rather than creating a new row, keeps its existing Paper I/II
  // categories and any already-uploaded questions intact).
  const existingTeacherEligibility = await prisma.examAuthority.findUnique({
    where: { purposeId_name: { purposeId: eligibilityPurpose.id, name: 'Teacher Eligibility' } },
  });
  if (existingTeacherEligibility) {
    await prisma.examAuthority.update({ where: { id: existingTeacherEligibility.id }, data: { name: 'TNTET' } });
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

  // Employment / Recruitment — TRB gets its full category structure (finalized
  // requirement §2); UPSC/SSC/Railway/Banking/TNUSRB stay name-only for now,
  // their categories/sub-categories to be added from the admin panel as
  // question upload for them begins.
  for (const name of ['UPSC', 'SSC', 'Railway / RRB', 'Banking', 'TNUSRB']) {
    await seedAuthority(employmentPurpose.id, name);
  }
  const trb = await seedAuthority(employmentPurpose.id, 'TRB');
  await seedCategory(trb.id, 'Secondary Grade / BT Assistant', []);
  await seedCategory(trb.id, 'PG Assistant', []);
  await seedCategory(trb.id, 'Assistant Professor', []);
  await seedCategory(trb.id, 'Computer Instructor', []);
  await seedCategory(trb.id, 'Agricultural Instructor', []);
  await seedCategory(trb.id, 'Special Teacher', []);
  await seedCategory(trb.id, 'Polytechnic Lecturer', []);
  await seedCategory(trb.id, 'Engineering College Lecturer', []);
  // TRB recruitment is difficulty-relevant like TNPSC/UPSC/SSC — defaults (true/true) are correct, no override needed.

  // Higher Education / Entrance — NEET: "All Subjects" required, Difficulty not applicable (finalized requirement §2, §4)
  const neet = await seedAuthority(educationPurpose.id, 'NEET');
  await prisma.examAuthority.update({ where: { id: neet.id }, data: { allowAllCategories: true, difficultyEnabled: false } });
  await seedCategory(neet.id, 'Physics', []);
  await seedCategory(neet.id, 'Chemistry', []);
  await seedCategory(neet.id, 'Biology', []);

  // Higher Education / Entrance — remaining exams seeded name-only for now
  // (finalized requirement): Categories/Sub-Categories get added from the
  // admin panel once question content for each actually begins. Difficulty
  // disabled across this Purpose per the finalized spec.
  for (const name of ['JEE Main', 'JEE Advanced', 'BITSAT', 'CUET UG', 'CLAT', 'IPMAT', 'NIFT Entrance', 'NID DAT', 'GATE']) {
    const authority = await seedAuthority(educationPurpose.id, name);
    await prisma.examAuthority.update({ where: { id: authority.id }, data: { difficultyEnabled: false } });
  }

  // Eligibility / Qualification — TNTET: no "All Papers" option, Difficulty not applicable (finalized requirement §2, §4)
  const tntet = await seedAuthority(eligibilityPurpose.id, 'TNTET');
  await prisma.examAuthority.update({ where: { id: tntet.id }, data: { allowAllCategories: false, difficultyEnabled: false } });
  await seedCategory(tntet.id, 'Paper I', []);
  await seedCategory(tntet.id, 'Paper II', []);

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
