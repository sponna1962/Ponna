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
    'Group I', 'Group I-A', 'Group I-B', 'Group I-C', 'Group II', 'Group IIA', 'Group III',
    'Group V', 'Group V-A', 'Group VI', 'Group VII', 'Group VIII',
  ]);
  await seedCategory(tnpsc.id, 'Technical Services', [
    'Interview Posts', 'Non-Interview Posts', 'Diploma / ITI Level',
  ]);
  await seedCategory(tnpsc.id, 'Other / Special Examinations', []); // Sub-Category optional here — exact exam via examName field instead

  // ── TNPSC Subject & Topic Preference — Master Structure (finalized
  // requirement) — each Group's own official syllabus, seeded once. Real,
  // verified content for Group I and Group IV (sourced from TNPSC's own
  // published 2026 syllabus); the other Groups get their Subject headers
  // seeded now with topics left for the admin to fill in via the new
  // Subject & Topic admin page — a reasonable starting structure rather
  // than guessed/incomplete topic lists for syllabi not yet verified here.
  const groupExamsCategory = await prisma.examCategory.findUniqueOrThrow({
    where: { authorityId_name: { authorityId: tnpsc.id, name: 'Group Examinations' } },
  });

  // Sept 2026 (BINDING, bugfix) — 'Group IV' is deliberately NOT in the
  // fixed seedCategory list above anymore. Once the Group 4 - VAO merge
  // further below renames it to the canonical name, this fixed-list
  // upsert would otherwise recreate a fresh, empty 'Group IV' row on
  // every later deploy (upsert's `create` branch fires because no row
  // named 'Group IV' exists post-rename) — which then collides with the
  // merge's own rename attempt (P2002 unique constraint on
  // categoryId+name, since the canonical name is already taken by the
  // real, question-holding row). Only create 'Group IV' here if the
  // canonical row doesn't exist yet — i.e. the merge hasn't run yet.
  // Sept 2026 (BINDING, bugfix) — checks BOTH the current canonical name
  // ('Group - IV') and the old one ('குரூப் 4 - வி.ஏ.ஓ.', renamed away by
  // the correction further below on its first post-rename run) — either
  // one existing means the merge has already happened, so don't
  // recreate an empty 'Group IV' row (see the long-standing P2002
  // collision this guards against, explained in the merge function
  // itself further below).
  const group4VaoAlreadyMerged =
    (await prisma.examSubCategory.findUnique({
      where: { categoryId_name: { categoryId: groupExamsCategory.id, name: 'Group - IV' } },
    })) ??
    (await prisma.examSubCategory.findUnique({
      where: { categoryId_name: { categoryId: groupExamsCategory.id, name: 'குரூப் 4 - வி.ஏ.ஓ.' } },
    }));
  if (!group4VaoAlreadyMerged) {
    await prisma.examSubCategory.upsert({
      where: { categoryId_name: { categoryId: groupExamsCategory.id, name: 'Group IV' } },
      create: { categoryId: groupExamsCategory.id, name: 'Group IV' },
      update: {},
    });
  }

  async function seedSyllabusSubject(subCategoryName: string, subjectName: string, topics: string[]) {
    const subCategory = await prisma.examSubCategory.findUnique({
      where: { categoryId_name: { categoryId: groupExamsCategory.id, name: subCategoryName } },
    });
    if (!subCategory) return; // shouldn't happen given seedCategory above already created every name in the list
    const subject = await prisma.syllabusSubject.upsert({
      where: { subCategoryId_name: { subCategoryId: subCategory.id, name: subjectName } },
      create: { subCategoryId: subCategory.id, name: subjectName },
      update: {},
    });
    for (const topicName of topics) {
      await prisma.syllabusTopic.upsert({
        where: { subjectId_name: { subjectId: subject.id, name: topicName } },
        create: { subjectId: subject.id, name: topicName },
        update: {},
      });
    }
  }

  // Group I — Prelims General Studies (6 units) + Aptitude & Mental Ability.
  await seedSyllabusSubject('Group I', 'General Science', [
    'Scientific Temper, Reasoning & Nature of Science',
    'Physics — Mechanics, Electricity, Magnetism, Light, Sound, Heat, Nuclear Physics, Electronics',
    'Chemistry — Elements, Compounds, Acids, Bases, Salts, Petroleum Products, Fertilizers, Pesticides',
    'Life Science — Classification, Evolution, Genetics, Physiology, Nutrition, Health & Hygiene, Human Diseases',
    'Environment and Ecology',
    'Latest Inventions in Science & Technology',
    'Current Affairs (Science)',
  ]);
  await seedSyllabusSubject('Group I', 'Geography of India', [
    'Location, Physical Features, Monsoon, Rainfall, Weather and Climate',
    'Water Resources, Rivers, Soil, Minerals and Natural Resources',
    'Forest and Wildlife, Agricultural Pattern',
    'Transport and Communication',
    'Social Geography — Population Density, Distribution, Racial and Linguistic Groups, Major Tribes',
    'Natural Calamity and Disaster Management',
    'Environmental Pollution, Climate Change, Green Energy, Geographical Landmarks',
  ]);
  await seedSyllabusSubject('Group I', 'History, Culture of India, and Indian National Movement', [
    'Indus Valley Civilization, Guptas, Delhi Sultans, Mughals, Marathas, Vijayanagaram and Bahmani Kingdoms, South Indian History',
    'National Renaissance and Early Uprisings Against British Rule',
    'Indian National Congress and Emergence of National Leaders',
    'Modes of Agitation — Satyagraha and Militant Movements, Communalism and Partition',
    'Characteristics of Indian Culture, Unity in Diversity',
    'India as a Secular State, Social Harmony, Prominent Personalities',
    'National Symbols, Eminent Personalities, Sports, Books and Authors',
  ]);
  await seedSyllabusSubject('Group I', 'Indian Polity', [
    'Constitution of India — Preamble and Salient Features',
    'Union, State and Union Territory',
    'Citizenship, Fundamental Rights, Fundamental Duties, Directive Principles',
    'Union Executive, Union Legislature, State Executive, State Legislature, Local Government, Panchayat Raj',
    'Federalism — Centre-State Relationships',
    'Elections, Judiciary in India, Rule of Law',
    'Corruption in Public Life, Anti-Corruption Measures, Lokpal and Lokayukta, Right to Information',
    'Political Parties and Political System in India',
  ]);
  await seedSyllabusSubject('Group I', 'Indian Economy and Development Administration in Tamil Nadu', [
    'Nature of Indian Economy, Five-Year Plan Models, Planning Commission and NITI Aayog',
    'Sources of Revenue, RBI, Fiscal and Monetary Policy, Finance Commission, GST',
    'Structure of Indian Economy, Employment Generation, Land Reforms and Agriculture',
    'Industrial Growth, Rural Welfare Programmes, Population, Education, Health, Poverty',
    'Human Development Indicators in Tamil Nadu',
    'Geography of Tamil Nadu and its Impact on Economic Growth',
    'e-Governance in Tamil Nadu, Public Awareness and General Administration',
  ]);
  await seedSyllabusSubject('Group I', 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu', [
    'History of Tamil Society, Archaeological Discoveries, Tamil Literature from Sangam Age to Contemporary Times',
    'Thirukkural — Significance, Universal Values, Relevance to Socio-Political-Economic Affairs',
    'Role of Tamil Nadu in the Freedom Struggle, Role of Women',
    '19th and 20th Century Socio-Political Movements — Justice Party, Self-Respect Movement, Dravidian Movement',
  ]);
  await seedSyllabusSubject('Group I', 'Aptitude & Mental Ability', [
    'Simplification', 'Percentage', 'HCF and LCM', 'Ratio and Proportion',
    'Simple Interest', 'Compound Interest', 'Area', 'Volume', 'Time and Work',
    'Logical Reasoning', 'Puzzles', 'Dice', 'Visual Reasoning', 'Alphanumeric Reasoning', 'Number Series',
  ]);

  // Group IV — General Studies, Indian Polity, Indian Economy, Indian
  // National Movement, Aptitude, General Tamil/English (shorter syllabus
  // than Group I, but its own distinct subject set — never shares Group I's).
  await seedSyllabusSubject('Group IV', 'General Science', [
    'Physics', 'Chemistry', 'Botany', 'Zoology', 'Current Events in Science',
  ]);
  await seedSyllabusSubject('Group IV', 'Geography', [
    'Earth and Universe, Solar System', 'Monsoon, Rainfall, Weather and Climate',
    'Water Resources — Rivers in India', 'Soil, Minerals and Natural Resources',
    'Forest and Wildlife, Agricultural Pattern', 'Transport and Communication',
    'Social Geography — Population Density and Distribution', 'Natural Calamities and Disaster Management',
  ]);
  await seedSyllabusSubject('Group IV', 'History and Culture of India and Tamil Nadu', [
    'Indus Valley Civilization, Guptas, Delhi Sultans, Mughals and Marathas',
    'Age of Vijayanagaram and the Bahmanis, South Indian History',
    'Culture and Heritage of Tamil People, India Since Independence',
    'Characteristics of Indian Culture, Unity in Diversity',
    'Growth of Rationalism and the Dravidian Movement in Tamil Nadu',
    'Political Parties and Populist Schemes',
  ]);
  await seedSyllabusSubject('Group IV', 'Indian Polity', [
    'Constitution of India — Preamble, Citizenship, Salient Features',
    'Fundamental Rights, Fundamental Duties, Human Rights Charter',
    'Parliament, Union and State Legislature, Local Government, Panchayat Raj',
    'Judiciary in India, Rule of Law, Elections',
    'Corruption in Public Life and Anti-Corruption Measures',
    'Right to Information, Empowerment of Women, Consumer Protection Forums',
  ]);
  await seedSyllabusSubject('Group IV', 'Indian Economy', [
    'Nature of Indian Economy, Five-Year Plan Models',
    'Land Reforms and Agriculture, Application of Science in Agriculture',
    'Industrial Growth, Rural Welfare Programmes',
    'Social Sector Problems — Population, Education, Health, Employment, Poverty',
    'Economic Trends in Tamil Nadu',
  ]);
  await seedSyllabusSubject('Group IV', 'Indian National Movement', [
    'National Renaissance, Emergence of National Leaders',
    'Role of Tamil Nadu in the Freedom Struggle',
    'Different Modes of Agitation',
  ]);
  await seedSyllabusSubject('Group IV', 'Aptitude & Mental Ability', [
    'Conversion of Information to Data, Collection, Compilation and Presentation of Data',
    'Tables, Graphs, Diagrams, Analytical Interpretation of Data',
    'Simplification', 'HCF and LCM', 'Percentage', 'Ratio and Proportion',
    'Simple Interest', 'Compound Interest', 'Area', 'Volume', 'Time and Work',
    'Puzzles', 'Number Series', 'Dice', 'Logical Reasoning', 'Visual Reasoning', 'Alphanumeric Reasoning',
  ]);
  await seedSyllabusSubject('Group IV', 'General English', [
    'Grammar — Phrases and Meanings, Synonyms and Antonyms, Prefix and Suffix, Articles, Preposition, Tense, Voice',
    'Comprehension, Sentence Structure, Degree, Compound Words',
    'Literature — Poetry Appreciation, Figures of Speech, Prose, Biography',
    'Authors and their Literary Works',
  ]);

  // Sept 2026 (BINDING) — TNPSC itself publishes ONE combined syllabus
  // for "Combined Civil Services Examination-IV (Group-IV and VAO)": this
  // is ONE exam/preparation scope, never two. The "Group IV" Sub-Category
  // above already holds the real, verified syllabus + question bank, so
  // it is RENAMED in place to the canonical student-facing name — same
  // id, same Questions, zero data movement. Any separate earlier
  // VAO-lineage row (from before this correction, under any prior name)
  // is retired: any real Question/tag data on it is reassigned onto
  // Group IV first (never a duplicate question pool, never silently
  // dropped), then it's hidden (studentVisible=false) rather than
  // deleted — ExamSubCategory has many dependent relations, and this
  // schema's own established rule is "never delete, only hide" (see the
  // studentVisible field's own doc comment). Idempotent: safe to re-run
  // on every deploy, whichever of these states the DB is currently in.
  async function mergeGroup4Vao(categoryId: string) {
    // Sept 2026 (URGENT FIX) — this row was later renamed a SECOND time,
    // from this function's own canonicalName ('குரூப் 4 - வி.ஏ.ஓ.') to the
    // real final name 'Group - IV' (the separate rename step right after
    // this function's call site, further below). This function itself
    // was never updated to know about that -- so once the row no longer
    // has EITHER old name, every subsequent deploy crashed at
    // findUniqueOrThrow('Group IV') below (P2025, confirmed from a real
    // Render deploy log). This check makes that final state -- the one
    // that will be true on every deploy from now on -- an immediate,
    // safe no-op, exactly like the pre-existing steady-state check just
    // below it.
    const finalRow = await prisma.examSubCategory.findUnique({
      where: { categoryId_name: { categoryId, name: 'Group - IV' } },
    });
    if (finalRow) return finalRow;

    const canonicalName = 'குரூப் 4 - வி.ஏ.ஓ.';

    const canonicalRow = await prisma.examSubCategory.findUnique({
      where: { categoryId_name: { categoryId, name: canonicalName } },
    });
    const oldGroup4Row = await prisma.examSubCategory.findUnique({
      where: { categoryId_name: { categoryId, name: 'Group IV' } },
    });

    // Steady state after a successful earlier run — nothing left to do.
    if (canonicalRow && !oldGroup4Row) return canonicalRow;

    // Recovery case (bugfix): a stray/empty 'Group IV' row exists
    // ALONGSIDE the already-merged canonical row — this can only happen
    // from a deploy that crashed after re-creating 'Group IV' but before
    // this function's own bugfix (see the conditional creation just
    // above this function's call site) started preventing that
    // recreation. The canonical row is the real content-holder; retire
    // the stray rather than treat it as authoritative.
    if (canonicalRow && oldGroup4Row) {
      await prisma.question.updateMany({ where: { subCategoryId: oldGroup4Row.id }, data: { subCategoryId: canonicalRow.id } });
      await prisma.questionTaxonomyTag.updateMany({ where: { subCategoryId: oldGroup4Row.id }, data: { subCategoryId: canonicalRow.id } });
      await prisma.planSubCategoryScope.deleteMany({ where: { subCategoryId: oldGroup4Row.id } });
      await prisma.examSubCategory.update({
        where: { id: oldGroup4Row.id },
        data: { studentVisible: false, name: `Group IV (stray, merged into ${canonicalName})` },
      });
      return canonicalRow;
    }

    // First-ever run — 'Group IV' holds the real content, nothing merged yet.
    const group4 = await prisma.examSubCategory.findUniqueOrThrow({
      where: { categoryId_name: { categoryId, name: 'Group IV' } },
    });

    const priorNames = ['VAO', 'Group 4 & VAO', 'Group IV & VAO'];
    for (const priorName of priorNames) {
      const stray = await prisma.examSubCategory.findUnique({ where: { categoryId_name: { categoryId, name: priorName } } });
      if (!stray || stray.id === group4.id) continue;
      await prisma.question.updateMany({ where: { subCategoryId: stray.id }, data: { subCategoryId: group4.id } });
      await prisma.questionTaxonomyTag.updateMany({ where: { subCategoryId: stray.id }, data: { subCategoryId: group4.id } });
      await prisma.planSubCategoryScope.deleteMany({ where: { subCategoryId: stray.id } });
      await prisma.examSubCategory.update({
        where: { id: stray.id },
        data: { studentVisible: false, name: `${priorName} (merged into ${canonicalName})` },
      });
    }

    return prisma.examSubCategory.update({ where: { id: group4.id }, data: { name: canonicalName } });
  }

  const group4Vao = await mergeGroup4Vao(groupExamsCategory.id);

  // Sept 2026 (correction) — the merge above canonically named this row
  // 'குரூப் 4 - வி.ஏ.ஓ.' (Tamil), inconsistent with every sibling Group's
  // English canonical name ('Group I', 'Group II', ...). Renamed in
  // place to match that sibling convention -- same id, same Questions,
  // zero data movement. Idempotent: a no-op once already renamed (the
  // old-named row no longer exists to find).
  const staleVaoNamedRow = await prisma.examSubCategory.findUnique({
    where: { categoryId_name: { categoryId: groupExamsCategory.id, name: 'குரூப் 4 - வி.ஏ.ஓ.' } },
  });
  if (staleVaoNamedRow) {
    await prisma.examSubCategory.update({ where: { id: staleVaoNamedRow.id }, data: { name: 'Group - IV' } });
  }

  // Group I-B, Group I-C — posts within the same Combined Civil Services
  // Examination-I (Group I) notification, sharing Group I's own Prelims
  // syllabus (verified above) rather than a separate one.
  // Group I-A, I-B, I-C, and VI share ONE Common Preliminary Examination
  // per TNPSC's own published Scheme of Examination ("Combined Civil
  // Services (Preliminary) Examination (Group IA,IB,IC and VI)") — same
  // Prelims content as Group I; their Mains papers differ by service
  // (not modeled here, Mains structure isn't part of this Subject/Topic
  // Preference master data).
  for (const groupName of ['Group I-A', 'Group I-B', 'Group I-C', 'Group VI']) {
    await seedSyllabusSubject(groupName, 'General Science', [
      'Scientific Temper, Reasoning & Nature of Science',
      'Physics — Mechanics, Electricity, Magnetism, Light, Sound, Heat, Nuclear Physics, Electronics',
      'Chemistry — Elements, Compounds, Acids, Bases, Salts, Petroleum Products, Fertilizers, Pesticides',
      'Life Science — Classification, Evolution, Genetics, Physiology, Nutrition, Health & Hygiene, Human Diseases',
      'Environment and Ecology',
      'Latest Inventions in Science & Technology',
      'Current Affairs (Science)',
    ]);
    await seedSyllabusSubject(groupName, 'Geography of India', [
      'Location, Physical Features, Monsoon, Rainfall, Weather and Climate',
      'Water Resources, Rivers, Soil, Minerals and Natural Resources',
      'Forest and Wildlife, Agricultural Pattern',
      'Transport and Communication',
      'Social Geography — Population Density, Distribution, Racial and Linguistic Groups, Major Tribes',
      'Natural Calamity and Disaster Management',
      'Environmental Pollution, Climate Change, Green Energy, Geographical Landmarks',
    ]);
    await seedSyllabusSubject(groupName, 'History, Culture of India, and Indian National Movement', [
      'Indus Valley Civilization, Guptas, Delhi Sultans, Mughals, Marathas, Vijayanagaram and Bahmani Kingdoms, South Indian History',
      'National Renaissance and Early Uprisings Against British Rule',
      'Indian National Congress and Emergence of National Leaders',
      'Modes of Agitation — Satyagraha and Militant Movements, Communalism and Partition',
      'Characteristics of Indian Culture, Unity in Diversity',
      'India as a Secular State, Social Harmony, Prominent Personalities',
      'National Symbols, Eminent Personalities, Sports, Books and Authors',
    ]);
    await seedSyllabusSubject(groupName, 'Indian Polity', [
      'Constitution of India — Preamble and Salient Features',
      'Union, State and Union Territory',
      'Citizenship, Fundamental Rights, Fundamental Duties, Directive Principles',
      'Union Executive, Union Legislature, State Executive, State Legislature, Local Government, Panchayat Raj',
      'Federalism — Centre-State Relationships',
      'Elections, Judiciary in India, Rule of Law',
      'Corruption in Public Life, Anti-Corruption Measures, Lokpal and Lokayukta, Right to Information',
      'Political Parties and Political System in India',
    ]);
    await seedSyllabusSubject(groupName, 'Indian Economy and Development Administration in Tamil Nadu', [
      'Nature of Indian Economy, Five-Year Plan Models, Planning Commission and NITI Aayog',
      'Sources of Revenue, RBI, Fiscal and Monetary Policy, Finance Commission, GST',
      'Structure of Indian Economy, Employment Generation, Land Reforms and Agriculture',
      'Industrial Growth, Rural Welfare Programmes, Population, Education, Health, Poverty',
      'Human Development Indicators in Tamil Nadu',
      'Geography of Tamil Nadu and its Impact on Economic Growth',
      'e-Governance in Tamil Nadu, Public Awareness and General Administration',
    ]);
    await seedSyllabusSubject(groupName, 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu', [
      'History of Tamil Society, Archaeological Discoveries, Tamil Literature from Sangam Age to Contemporary Times',
      'Thirukkural — Significance, Universal Values, Relevance to Socio-Political-Economic Affairs',
      'Role of Tamil Nadu in the Freedom Struggle, Role of Women',
      '19th and 20th Century Socio-Political Movements — Justice Party, Self-Respect Movement, Dravidian Movement',
    ]);
    await seedSyllabusSubject(groupName, 'Aptitude & Mental Ability', [
      'Simplification', 'Percentage', 'HCF and LCM', 'Ratio and Proportion',
      'Simple Interest', 'Compound Interest', 'Area', 'Volume', 'Time and Work',
      'Logical Reasoning', 'Puzzles', 'Dice', 'Visual Reasoning', 'Alphanumeric Reasoning', 'Number Series',
    ]);
  }

  // Group II and Group IIA — Combined Civil Services Examination-II
  // (CCSE-II), share ONE Common Preliminary Examination; verified
  // question-count weightage per subject from TNPSC's own syllabus
  // documents (codes 495/469/583).
  for (const groupName of ['Group II', 'Group IIA']) {
    await seedSyllabusSubject(groupName, 'General Science', ['Physics', 'Chemistry', 'Botany', 'Zoology', 'Current Events in Science']);
    await seedSyllabusSubject(groupName, 'Geography of India', [
      'Location, Physical Features, Monsoon, Rainfall, Weather and Climate',
      'Water Resources, Rivers, Soil, Minerals and Natural Resources',
      'Forest and Wildlife, Agricultural Pattern',
      'Social Geography — Population, Natural Calamities and Disaster Management',
    ]);
    await seedSyllabusSubject(groupName, 'History and Indian National Movement', [
      'Indus Valley Civilization, Guptas, Delhi Sultans, Mughals, Marathas, South Indian History',
      'National Renaissance, Early Uprisings, Indian National Congress and National Leaders',
      'Modes of Agitation, Communalism and Partition',
    ]);
    await seedSyllabusSubject(groupName, 'Indian Polity', [
      'Constitution of India — Preamble and Salient Features, Citizenship',
      'Fundamental Rights, Fundamental Duties, Directive Principles',
      'Union and State Executive/Legislature, Local Government, Panchayat Raj',
      'Judiciary, Elections, Rule of Law',
      'Anti-Corruption Measures, Right to Information, Empowerment of Women',
    ]);
    await seedSyllabusSubject(groupName, 'Indian Economy and Tamil Nadu Development', [
      'Nature of Indian Economy, Five-Year Plans, Planning Commission and NITI Aayog',
      'RBI, Fiscal and Monetary Policy, GST',
      'Land Reforms and Agriculture, Industrial Growth, Rural Welfare Programmes',
      'Human Development Indicators and Economic Trends in Tamil Nadu',
      'e-Governance in Tamil Nadu',
    ]);
    await seedSyllabusSubject(groupName, 'History, Culture and Socio-Political Movements of Tamil Nadu', [
      'Tamil Society, Sangam Literature, Culture and Heritage of Tamil People',
      'Thirukkural — Significance and Universal Values',
      'Role of Tamil Nadu in the Freedom Struggle',
      'Self-Respect Movement and Dravidian Movement',
    ]);
    await seedSyllabusSubject(groupName, 'Aptitude & Mental Ability', [
      'Simplification', 'Percentage', 'HCF and LCM', 'Ratio and Proportion',
      'Simple Interest', 'Compound Interest', 'Area', 'Volume', 'Time and Work',
      'Logical Reasoning', 'Puzzles', 'Number Series', 'Dice', 'Visual and Alphanumeric Reasoning',
    ]);
    await seedSyllabusSubject(groupName, 'General Tamil / General English', [
      'Grammar — Articles, Prepositions, Tense, Voice, Question Tags',
      'Comprehension and Sentence Structure',
      'Literature — Poetry Appreciation, Prose, Figures of Speech',
      'Authors and their Literary Works',
    ]);
  }

  // Group III — Tamil Language/General English (SSLC), General Studies
  // (Higher Secondary level, includes a dedicated Tamil Nadu History/
  // Culture unit), Aptitude & Mental Ability (SSLC).
  await seedSyllabusSubject('Group III', 'General Studies', [
    'General Science and Current Events',
    'Geography of India and Tamil Nadu',
    'History and Culture of India and Tamil Nadu',
    'Indian Polity — Constitution, Rights, Duties, Governance',
    'Indian Economy and Social Issues in Tamil Nadu',
    'History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu',
  ]);
  await seedSyllabusSubject('Group III', 'Aptitude & Mental Ability', [
    'Simplification', 'Percentage', 'HCF and LCM', 'Ratio and Proportion',
    'Simple Interest', 'Compound Interest', 'Area', 'Volume', 'Time and Work',
    'Logical Reasoning', 'Number Series', 'Puzzles', 'Visual and Alphanumeric Reasoning',
  ]);
  await seedSyllabusSubject('Group III', 'General Tamil / General English', [
    'Grammar — Articles, Prepositions, Tense, Voice',
    'Comprehension, Synonyms and Antonyms, Prefix and Suffix',
    'Prescribed Prose and Poetry',
  ]);

  // Group V-A Service — verified official, but a COMPLETELY DIFFERENT
  // structure from every other Group above ("Combined Civil Services
  // Examination (Group - V.A Service)" per TNPSC's Scheme of
  // Examination): just two Degree-standard, Descriptive papers, General
  // Tamil and General English — no common General Studies/Aptitude
  // pattern reused here, since that's genuinely not what this exam tests.
  await seedSyllabusSubject('Group V-A', 'General Tamil', [
    'Essay Writing', 'Précis Writing', 'Letter Writing', 'Translation — English to Tamil', 'Grammar and Composition',
  ]);
  await seedSyllabusSubject('Group V-A', 'General English', [
    'Essay Writing', 'Précis Writing', 'Letter Writing', 'Translation — Tamil to English', 'Grammar and Composition',
  ]);

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

  // ── September 15 launch — student-facing visibility (finalized
  // requirement, one-time only — see PlatformSettings.launchVisibilityApplied) ──
  // Only TNPSC (Competitive/Employment) and TNTET (Eligibility) are visible
  // to students at launch; every other Authority in those two Purposes is
  // hidden, and Higher Education/Entrance is hidden entirely. Purely a
  // display/selection gate — no data is touched, and an admin can flip any
  // of this back on later from the Exam Taxonomy page without a deploy.
  const platformSettings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
  if (!platformSettings.launchVisibilityApplied) {
    await prisma.examAuthority.updateMany({
      where: { purposeId: employmentPurpose.id, name: { not: 'TNPSC' } },
      data: { studentVisible: false },
    });
    await prisma.examAuthority.updateMany({
      where: { purposeId: eligibilityPurpose.id, name: { not: 'TNTET' } },
      data: { studentVisible: false },
    });
    await prisma.examPurpose.update({
      where: { id: educationPurpose.id },
      data: { studentVisible: false },
    });
    await prisma.platformSettings.update({ where: { id: 'singleton' }, data: { launchVisibilityApplied: true } });
  }

  // TNPSC exam-group visibility cleanup (finalized requirement) — Group V
  // (generic, superseded by the correctly-named Group V-A seeded above),
  // Group VII, and Group VIII are NOT confirmed as officially-defined
  // standalone TNPSC exams against TNPSC's own published Scheme of
  // Examination (its official Groups are I, IA, IB, IC, VI, II, IIA, III,
  // IV, and V-A Service specifically) — hidden from student-facing
  // Practice Setup rather than deleted, in case any are confirmed real
  // later (admin can re-enable via the Exam Taxonomy page's "Visible to
  // students" toggle, no deploy needed). One-time only — never re-applied
  // on a later deploy, so it can never fight that toggle once an admin
  // has used it.
  if (!platformSettings.tnpscGroupsVisibilityCleanupApplied) {
    await prisma.examSubCategory.updateMany({
      where: { categoryId: groupExamsCategory.id, name: { in: ['Group V', 'Group VII', 'Group VIII'] } },
      data: { studentVisible: false },
    });
    await prisma.platformSettings.update({ where: { id: 'singleton' }, data: { tnpscGroupsVisibilityCleanupApplied: true } });
  }

  // ── Annual Plans (finalized commercial model) ────────────────────────────
  // Free fallback — used whenever a student's selection isn't covered by any
  // of their active paid Plans. Found by isFree, never by a hardcoded id/name.
  await prisma.plan.upsert({
    where: { name: 'Free' },
    create: { name: 'Free', isFree: true, dailyLimit: 5, active: true, sortOrder: 0 },
    // isFree explicitly re-asserted here too (not just in create) — this
    // row pre-dates the isFree column (from before the Annual Plan
    // redesign), so the schema migration that added the column defaulted
    // it to false on the existing row, and every deploy since only patched
    // dailyLimit/sortOrder without ever correcting it. That silently made
    // the Free plan look like a "paid" plan everywhere isFree is checked —
    // e.g. it showed up in "Active Plans" with its internal +100-year
    // placeholder expiry. Self-heals on the next deploy now.
    update: { isFree: true, dailyLimit: 5, sortOrder: 0 },
  });

  // Legacy Plan 20 / Plan 50 (pre-Annual-Plan model) — finalized requirement
  // is that these are no longer active products, not merely hidden from the
  // frontend. Deactivated rather than deleted: any historical Subscription
  // rows referencing them (from before this redesign) must stay intact for
  // that student's purchase history, but the plan itself must never be
  // purchasable or shown again.
  await prisma.plan.updateMany({
    where: { name: { in: ['Plan 20', 'Plan 50'] } },
    data: { active: false },
  });

  async function seedPurposePlan(name: string, purposeId: string, regularPrice: number, launchPrice: number, sortOrder: number) {
    const plan = await prisma.plan.upsert({
      where: { name },
      create: { name, purposeId, cycleDays: 365, regularPrice, launchPrice, active: true, sortOrder },
      update: { purposeId, cycleDays: 365, regularPrice, launchPrice, sortOrder },
    });
    return plan;
  }

  async function seedAuthorityPlan(name: string, authorityIds: string[], regularPrice: number, launchPrice: number, sortOrder: number) {
    const plan = await prisma.plan.upsert({
      where: { name },
      create: { name, cycleDays: 365, regularPrice, launchPrice, active: true, sortOrder },
      update: { cycleDays: 365, regularPrice, launchPrice, sortOrder },
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

  // Sept 2026 — TNPSC குரூப் 4 - வி.ஏ.ஓ. Pass (BINDING, finalized
  // requirement): an exclusive/restricted plan — see Plan.restrictToScope.
  // cycleDays is just an initial validity window; the real cutoff is
  // Plan.manualExpiryOverride, set by admin from the admin panel once the
  // actual exam date is confirmed (see PATCH /admin/plans/:id/expiry-override
  // ) — never hardcoded here. Renames in place (see priorNames) rather than
  // upserting a fresh row under a new name, so an earlier-named row (and
  // any Subscriptions already pointing at it) is never orphaned.
  async function seedRestrictedSubCategoryPlan(
    canonicalName: string,
    priorNames: string[],
    subCategoryIds: string[],
    regularPrice: number,
    sortOrder: number,
  ) {
    const data = { cycleDays: 365, regularPrice, active: true, sortOrder, restrictToScope: true };
    let plan = await prisma.plan.findUnique({ where: { name: canonicalName } });
    if (!plan) {
      for (const priorName of priorNames) {
        const existing = await prisma.plan.findUnique({ where: { name: priorName } });
        if (existing) {
          plan = await prisma.plan.update({ where: { id: existing.id }, data: { name: canonicalName, ...data } });
          break;
        }
      }
    }
    if (!plan) {
      plan = await prisma.plan.create({ data: { name: canonicalName, ...data } });
    } else if (plan.sortOrder !== sortOrder || Number(plan.regularPrice) !== regularPrice) {
      plan = await prisma.plan.update({ where: { id: plan.id }, data });
    }
    await prisma.planSubCategoryScope.deleteMany({ where: { planId: plan.id } });
    for (const subCategoryId of subCategoryIds) {
      await prisma.planSubCategoryScope.upsert({
        where: { planId_subCategoryId: { planId: plan.id, subCategoryId } },
        create: { planId: plan.id, subCategoryId },
        update: {},
      });
    }
    return plan;
  }

  // Competitive / Employment — ONE plan covers the whole Purpose (TNPSC,
  // UPSC, SSC, Railway/RRB, Banking, TNUSRB, TRB, Other — including any
  // future Authority added under this Purpose, automatically).
  await seedPurposePlan('Competitive / Employment Annual Plan', employmentPurpose.id, 2999, 999, 1);

  // TNPSC குரூப் 4 - வி.ஏ.ஓ. Pass — exam-specific, restricted plan, sortOrder 0
  // so it shows BEFORE the TNPSC Annual Pass on the student Plans page,
  // per the finalized requirement. Sept 2026 (BINDING, confirmed against
  // TNPSC's own published Scheme): ONE Sub-Category, ONE scope —
  // group4Vao above (the merged/renamed former "Group IV" row) already IS
  // the single preparation scope for this Pass. Official syllabus-based
  // question mapping (which questions are actually relevant, once TNPSC's
  // syllabus structure is entered) is a separate, not-yet-built layer —
  // this Plan's SCOPE (which exam a student may select) is unaffected by
  // that.
  await seedRestrictedSubCategoryPlan(
    'TNPSC குரூப்-4 Pass',
    ['TNPSC Group IV & VAO Pass', 'TNPSC குரூப் 4 - வி.ஏ.ஓ. Pass'],
    [group4Vao.id],
    499,
    0,
  );

  // Higher Education / Entrance — exam-specific plans only (finalized
  // requirement: never a single Purpose-wide plan for this group).
  await seedAuthorityPlan('NEET Annual Plan', [neet.id], 4999, 2999, 2);
  await seedAuthorityPlan(
    'JEE Annual Plan',
    [entranceAuthorityIdByName['JEE Main'], entranceAuthorityIdByName['JEE Advanced']],
    4999,
    2999,
    3,
  );
  // Eligibility / Qualification — TNTET: one plan, Paper I/II stay practice
  // selections inside it, never separate paid products.
  await seedAuthorityPlan('TNTET Annual Plan', [tntet.id], 2999, 1999, 4);

  // "Other Entrance Exams" is a UI grouping only (finalized requirement) —
  // each of these is its own separate commercial Plan underneath it.
  const otherEntranceOrder: Record<string, number> = {
    'CUET UG': 5, CLAT: 6, BITSAT: 7, IPMAT: 8, 'NIFT Entrance': 9, 'NID DAT': 10, GATE: 11,
  };
  for (const name of ['CUET UG', 'CLAT', 'BITSAT', 'IPMAT', 'NIFT Entrance', 'NID DAT', 'GATE']) {
    await seedAuthorityPlan(`${name} Annual Plan`, [entranceAuthorityIdByName[name]], 3999, 1999, otherEntranceOrder[name]);
  }

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
