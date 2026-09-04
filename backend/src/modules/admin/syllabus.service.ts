// TNPSC Subject & Topic Preference — Master Structure (finalized
// requirement). Manages the SyllabusSubject/SyllabusTopic hierarchy,
// scoped per exam (ExamSubCategory — "Group I", "Group IV", etc.).
// Admin-only for now — no student-preference or allocation-weighting
// logic here; this is purely the master data the next phase will connect
// to.

import { prisma } from '../../lib/prisma';

export class SyllabusService {
  /** Every ExamSubCategory under TNPSC's "Group Examinations" category —
   * the list of exams this whole feature is scoped to (finalized
   * requirement: "Group I, Group II/IIA, ... other TNPSC examinations as
   * applicable"). Admin picks one of these to manage its syllabus. */
  async listTnpscExams() {
    return prisma.examSubCategory.findMany({
      where: { category: { authority: { name: 'TNPSC' } } },
      select: { id: true, name: true, _count: { select: { syllabusSubjects: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getSyllabus(subCategoryId: string) {
    return prisma.syllabusSubject.findMany({
      where: { subCategoryId },
      include: { topics: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createSubject(subCategoryId: string, name: string) {
    return prisma.syllabusSubject.create({ data: { subCategoryId, name: name.trim() } });
  }

  async renameSubject(id: string, name: string) {
    return prisma.syllabusSubject.update({ where: { id }, data: { name: name.trim() } });
  }

  async deleteSubject(id: string) {
    await prisma.syllabusTopic.deleteMany({ where: { subjectId: id } });
    await prisma.syllabusSubject.delete({ where: { id } });
  }

  async createTopic(subjectId: string, name: string) {
    return prisma.syllabusTopic.create({ data: { subjectId, name: name.trim() } });
  }

  /** Bulk-add many topic names to one Subject in one call — the seed
   * script and the admin "paste a list" convenience both use this rather
   * than one create() per topic. Skips any name already present under
   * this Subject rather than erroring, so it's safe to re-run. */
  async createTopicsBulk(subjectId: string, names: string[]) {
    const existing = await prisma.syllabusTopic.findMany({ where: { subjectId }, select: { name: true } });
    const existingNames = new Set(existing.map((t) => t.name));
    const toCreate = names.map((n) => n.trim()).filter((n) => n && !existingNames.has(n));
    if (toCreate.length === 0) return { created: 0 };
    await prisma.syllabusTopic.createMany({ data: toCreate.map((name) => ({ subjectId, name })) });
    return { created: toCreate.length };
  }

  async renameTopic(id: string, name: string) {
    return prisma.syllabusTopic.update({ where: { id }, data: { name: name.trim() } });
  }

  async deleteTopic(id: string) {
    await prisma.syllabusTopic.delete({ where: { id } });
  }
}
