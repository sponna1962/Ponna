// Seeds the Plan table and PlatformSettings with the launch defaults agreed
// in the requirements document. Run with: npx ts-node prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  // Plan seeding moved below — after the Exam Taxonomy is created, since
  // paid Plans need real Purpose/Authority ids for their scope. See
  // "Annual Plans" block near the end of this function.

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
  // JEE Main + JEE Advanced are the one finalized exception to this
  // Purpose's single-select rule — same non-null selectionGroup lets a
  // student pick either or both together; everything else here stays
  // selectionGroup: null (standalone, the Prisma default).
  const selectionGroupByName: Record<string, string> = {
    'JEE Main': 'JEE',
    'JEE Advanced': 'JEE',
  };
  const entranceAuthorityIdByName: Record<string, string> = {};
  for (const name of ['JEE Main', 'JEE Advanced', 'BITSAT', 'CUET UG', 'CLAT', 'IPMAT', 'NIFT Entrance', 'NID DAT', 'GATE']) {
    const authority = await seedAuthority(educationPurpose.id, name);
    await prisma.examAuthority.update({
      where: { id: authority.id },
      data: { difficultyEnabled: false, selectionGroup: selectionGroupByName[name] ?? null },
    });
    entranceAuthorityIdByName[name] = authority.id;
  }

  // Eligibility / Qualification — TNTET: no "All Papers" option, Difficulty not applicable (finalized requirement §2, §4)
  const tntet = await seedAuthority(eligibilityPurpose.id, 'TNTET');
  await prisma.examAuthority.update({ where: { id: tntet.id }, data: { allowAllCategories: false, difficultyEnabled: false } });
  await seedCategory(tntet.id, 'Paper I', []);
  await seedCategory(tntet.id, 'Paper II', []);

  // ── Annual Plans (finalized commercial model) ────────────────────────────
  // Free fallback — used whenever a student's selection isn't covered by any
  // of their active paid Plans. Found by isFree, never by a hardcoded id/name.
  await prisma.plan.upsert({
    where: { name: 'Free' },
    create: { name: 'Free', isFree: true, dailyLimit: 5, active: true },
    update: { dailyLimit: 5 },
  });

  async function seedPurposePlan(name: string, purposeId: string, regularPrice: number, launchPrice: number) {
    const plan = await prisma.plan.upsert({
      where: { name },
      create: { name, purposeId, cycleDays: 365, regularPrice, launchPrice, active: true },
      update: { purposeId, cycleDays: 365, regularPrice, launchPrice },
    });
    return plan;
  }

  async function seedAuthorityPlan(name: string, authorityIds: string[], regularPrice: number, launchPrice: number) {
    const plan = await prisma.plan.upsert({
      where: { name },
      create: { name, cycleDays: 365, regularPrice, launchPrice, active: true },
      update: { cycleDays: 365, regularPrice, launchPrice },
    });
    // Rebuild the scope links every run so removing an authority from the
    // list here correctly removes its access too, not just adding new ones.
    await prisma.planAuthorityScope.deleteMany({ where: { planId: plan.id } });
    for (const authorityId of authorityIds) {
      await prisma.planAuthorityScope.upsert({
        where: { planId_authorityId: { planId: plan.id, authorityId } },
        create: { planId: plan.id, authorityId },
        update: {},
      });
    }
    return plan;
  }

  // Competitive / Employment — ONE plan covers the whole Purpose (TNPSC,
  // UPSC, SSC, Railway/RRB, Banking, TNUSRB, TRB, Other — including any
  // future Authority added under this Purpose, automatically).
  await seedPurposePlan('Competitive / Employment Annual Plan', employmentPurpose.id, 2999, 999);

  // Higher Education / Entrance — exam-specific plans only (finalized
  // requirement: never a single Purpose-wide plan for this group).
  await seedAuthorityPlan('NEET Annual Plan', [neet.id], 4999, 2999);
  await seedAuthorityPlan(
    'JEE Annual Plan',
    [entranceAuthorityIdByName['JEE Main'], entranceAuthorityIdByName['JEE Advanced']],
    4999,
    2999,
  );
  // "Other Entrance Exams" is a UI grouping only (finalized requirement) —
  // each of these is its own separate commercial Plan underneath it.
  for (const name of ['CUET UG', 'CLAT', 'BITSAT', 'IPMAT', 'NIFT Entrance', 'NID DAT', 'GATE']) {
    await seedAuthorityPlan(`${name} Annual Plan`, [entranceAuthorityIdByName[name]], 3999, 1999);
  }

  // Eligibility / Qualification — TNTET: one plan, Paper I/II stay practice
  // selections inside it, never separate paid products.
  await seedAuthorityPlan('TNTET Annual Plan', [tntet.id], 2999, 1999);

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
