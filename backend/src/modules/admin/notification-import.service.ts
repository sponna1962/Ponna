// Official Data Import Workflow (Ask Ponna Master Requirement, Spec v5
// Refinement 3, BINDING). Admin pastes a notification's text; simple
// pattern-matching suggests candidate VerifiedExamFact rows; admin
// reviews and approves each one (or all) before it becomes real
// verified data. Nothing here is EVER treated as verified PONNA
// knowledge until explicitly approved -- admin approval remains the
// sole authority, exactly as specified.

import { VerifiedExamFactType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// Simple anchor-word pattern matching -- assistive only, never
// auto-published. Each pattern's captured group becomes a suggested
// value for admin to review/edit/discard.
const PATTERNS: { factType: VerifiedExamFactType; regex: RegExp }[] = [
  { factType: 'APPLICATION_START_DATE', regex: /application\s+(?:will\s+)?(?:start|begin|open)s?\s+(?:on\s+)?([^\n.,]+)/i },
  { factType: 'APPLICATION_END_DATE', regex: /(?:last\s+date|closing\s+date|application\s+(?:will\s+)?close)s?\s*(?:to\s+apply\s*)?:?\s*(?:is\s+)?(?:on\s+)?([^\n.,]+)/i },
  { factType: 'EXAM_DATE', regex: /exam(?:ination)?\s+(?:will\s+be\s+)?(?:held|conducted|scheduled)\s+(?:on\s+)?([^\n.,]+)/i },
  { factType: 'VACANCY_COUNT', regex: /(?:total\s+)?vacan(?:cy|cies)\s*:?\s*(\d[\d,]*)/i },
  { factType: 'AGE_LIMIT', regex: /age\s+limit\s*:?\s*([^\n.,]+)/i },
  { factType: 'ELIGIBILITY', regex: /eligibilit(?:y|ies)\s*:?\s*([^\n.]+)/i },
];

export class NotificationImportService {
  async createImport(subCategoryId: string, rawText: string, sourceUrl?: string) {
    const importRow = await prisma.notificationImport.create({
      data: { subCategoryId, rawText, sourceUrl: sourceUrl?.trim() || null },
    });

    const candidates: { suggestedFactType: VerifiedExamFactType; suggestedValue: string }[] = [];
    for (const { factType, regex } of PATTERNS) {
      const match = rawText.match(regex);
      if (match && match[1]) {
        candidates.push({ suggestedFactType: factType, suggestedValue: match[1].trim() });
      }
    }

    if (candidates.length > 0) {
      await prisma.notificationImportCandidateFact.createMany({
        data: candidates.map((c) => ({ importId: importRow.id, ...c })),
      });
    }

    return this.getImport(importRow.id);
  }

  async getImport(id: string) {
    return prisma.notificationImport.findUniqueOrThrow({ where: { id }, include: { candidates: true } });
  }

  async listPending() {
    return prisma.notificationImport.findMany({ where: { status: 'PENDING' }, orderBy: { importedAt: 'desc' } });
  }

  /** Admin edits a candidate's suggested value/type before approving --
   * never auto-applied verbatim from the pattern match. */
  async updateCandidate(candidateId: string, data: { suggestedValue?: string; suggestedFactType?: VerifiedExamFactType }) {
    return prisma.notificationImportCandidateFact.update({ where: { id: candidateId }, data });
  }

  /** The only path that ever creates a real VerifiedExamFact from an
   * import -- explicit admin action, one row at a time (or looped for
   * "approve all" from the frontend). isOfficialConfirmed defaults true
   * here since this workflow is specifically for official notifications
   * -- admin can still edit it after if the source turns out to be
   * tentative. */
  async approveCandidate(candidateId: string, verifiedAt: string) {
    const candidate = await prisma.notificationImportCandidateFact.findUniqueOrThrow({ where: { id: candidateId } });
    if (candidate.approved) return candidate;

    const importRow = await prisma.notificationImport.findUniqueOrThrow({ where: { id: candidate.importId } });

    const fact = await prisma.verifiedExamFact.create({
      data: {
        subCategoryId: importRow.subCategoryId,
        factType: candidate.suggestedFactType,
        value: candidate.suggestedValue,
        sourceUrl: importRow.sourceUrl,
        isOfficialConfirmed: true,
        verifiedAt: new Date(verifiedAt),
      },
    });

    await prisma.notificationImportCandidateFact.update({
      where: { id: candidateId },
      data: { approved: true, resultingFactId: fact.id },
    });

    return fact;
  }

  async discardCandidate(candidateId: string) {
    await prisma.notificationImportCandidateFact.delete({ where: { id: candidateId } });
  }

  async markReviewed(importId: string) {
    await prisma.notificationImport.update({ where: { id: importId }, data: { status: 'REVIEWED', reviewedAt: new Date() } });
  }
}
